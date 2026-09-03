package com.collapsibletabs.ui

import android.animation.ValueAnimator
import android.content.Context
import android.util.Log
import android.util.SparseArray
import android.util.SparseIntArray
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.view.animation.DecelerateInterpolator
import androidx.core.util.forEach
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.viewpager2.widget.ViewPager2
import com.facebook.react.R
import com.facebook.react.uimanager.events.NativeGestureUtil
import com.facebook.react.views.scroll.ReactScrollView
import com.facebook.react.views.scroll.ReactScrollViewHelper
import com.facebook.react.views.scroll.ScrollEventType
import java.util.ArrayDeque
import java.util.Collections
import java.util.WeakHashMap

/**
 * The collapsible-tabs shell: collapsing header band + pinned tab-bar band over a
 * horizontal pager of React pages. Counterpart of the JS
 * `NativeCollapsibleTabs` spec — read that file's header for the why.
 *
 * Geometry (all in px, host-relative):
 *
 *   pager      : (0, 0, w, h)                — full host; pages pad their
 *                                              content by headerH + tabH
 *   headerSlot : (0, 0, w, headerH)          — translationY = -offset
 *   tabBarSlot : (0, headerH, w, headerH+tabH) — translationY = -offset
 *   offset     : clamp(activePage.scrollY, 0, headerH)
 *
 * The bands are ABOVE the pager in z, so with offset == headerH the tab bar
 * sits at y == 0 and the list scrolls under it — exactly the Instagram
 * profile screen. The single source of truth for `offset` is the active page's
 * ReactScrollView, read from `View.OnScrollChangeListener`, which Android
 * invokes synchronously inside `scrollTo` — the band translation is applied
 * before the frame that shows the new content offset, so header and list
 * can never be a frame apart.
 *
 * Android Fabric hazards handled here (see the comments below):
 * self-driven measure/layout because RN swallows
 * descendant `requestLayout()`; RN children measured only with EXACTLY
 * specs; RN children re-parented into slots keyed by `nativeID` while the
 * ViewGroupManager reports RN's own child list.
 */
class CollapsibleTabsHostView(context: Context) : ViewGroup(context) {

    var onPageSelected: ((index: Int) -> Unit)? = null
    /** A page showed any part of itself for the first time (see [revealPage]). */
    var onPageRevealed: ((index: Int) -> Unit)? = null
    /** Live swipe position, per frame, while [pageScrollEnabled]. */
    var onPageScroll: ((position: Int, offset: Float) -> Unit)? = null
    var onCollapsedChange: ((collapsed: Boolean) -> Unit)? = null
    var onRefresh: (() -> Unit)? = null

    private val density = context.resources.displayMetrics.density

    /**
     * Pull-to-refresh belongs to the container, not to a tab: one spinner under
     * the sticky bar, armed only when the header is fully expanded and the
     * active page is at its top (the same feel as the JS container's
     * `onStartRefresh`). SwipeRefreshLayout takes a single child, hence the
     * `content` group that owns the real geometry.
     */
    private val refreshLayout = SwipeRefreshLayout(context)
    private val content = ContentView(context)
    private val pager = ViewPager2(context)
    private val headerSlot = SlotView(context)
    private val tabBarSlot = SlotView(context)
    private val adapter = PagerAdapter()

    /** RN's ordered child list — what the ViewGroupManager reports back. */
    private val reactChildren = ArrayList<View>()
    private var headerChild: View? = null
    private var tabBarChild: View? = null
    private val pageChildren = SparseArray<View>()
    /** Bound page slots by position (the adapter keeps every page bound). */
    private val pageSlots = SparseArray<SlotView>()

    private var headerHeightPx = 0
    private var tabBarHeightPx = 0
    private var pageCount = 0
    private var selectedIndex = 0
    private var collapseThresholdPx = 0
    private var swipeEnabled = true
    /** False: the tab-bar band collapses with the header instead of pinning. */
    private var pinTabBar = true
    /** Give short pages the scroll range they lack (see [applyCollapseSlack]).
     *  On by default: a tab you cannot scroll is a tab whose header you cannot
     *  collapse, which reads as broken. */
    private var allowFullCollapse = true
    /** Arms the per-frame [onPageScroll]; off unless something is listening. */
    private var pageScrollEnabled = false

    private var pendingPageCount = -1
    private var pendingSelectedIndex = -1

    /**
     * How far the bands travel before they are gone. The tab bar is part of
     * that distance only when it is not pinned.
     */
    private val collapsibleHeightPx: Int
        get() = headerHeightPx + (if (pinTabBar) 0 else tabBarHeightPx)

    /** Current header offset, 0..collapsibleHeightPx. */
    private var headerOffset = 0
    /** 'direction' collapse mode: offset follows the scroll DELTA. */
    private var directionMode = false
    /** Last seen scrollY of the active page (delta source for direction mode). */
    private var lastActiveScrollY = 0
    private var collapsed = false
    private var activeIndex = 0
    private var lastEmittedIndex = -1
    /** Pages already announced to JS as visible — emitted ONCE per page. */
    private val revealedPages = HashSet<Int>()
    private var reconcileAnimator: ValueAnimator? = null
    /** True from the user's drag start until the pager settles. */
    private var userDragging = false
    /** `collapse()` in direction mode: a scroll only moves the header by its
     *  delta, so the engine lands exactly on the collapse point once the list
     *  reaches it. */
    private var pendingCollapse = false

    /** Latest touch seen by the shell — `notifyNativeGestureStarted` needs an
     *  event, and a pager drag begins inside ViewPager2 where we have none. */
    private var lastTouch: MotionEvent? = null

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        lastTouch?.recycle()
        lastTouch = MotionEvent.obtain(ev)
        // Fabric re-applies a view's padding on every layout update
        // (SurfaceMountingManager.updateLayout -> ViewManager.setPadding),
        // which silently drops the bottom padding allowFullCollapse adds to a
        // page. Re-assert it as the finger lands, before any scroll can be
        // clamped against a range that has quietly gone missing.
        if (allowFullCollapse && ev.actionMasked == MotionEvent.ACTION_DOWN) {
            activeScrollView()?.let { applyCollapseSlack(it) }
        }
        return super.dispatchTouchEvent(ev)
    }

    /**
     * React's JS touch dispatcher only cancels an in-flight press when a
     * native view reports that it started a gesture. Do that whenever the
     * shell (pager or band forwarding) takes over the touch stream.
     */
    fun notifyReactNativeGestureStarted(ev: MotionEvent? = lastTouch) {
        val event = ev ?: return
        try {
            NativeGestureUtil.notifyNativeGestureStarted(this, event)
        } catch (_: Throwable) {
            // Not under a React root (e.g. detached) — nothing to cancel.
        }
    }

    /** Re-pin the pager to JS's selection after anything that could have
     *  moved it without a user gesture (layout re-anchoring). */
    private fun pinPagerToSelection() {
        if (userDragging || pageCount == 0 || selectedIndex >= pageCount) return
        if (pager.currentItem != selectedIndex && pager.scrollState == ViewPager2.SCROLL_STATE_IDLE) {
            pager.setCurrentItem(selectedIndex, false)
        }
        if (activeIndex != selectedIndex && pager.currentItem == selectedIndex) {
            // Same ordering rule as onPageSelected: align the incoming page
            // before it becomes the active one.
            syncPageToHeader(selectedIndex)
            activeIndex = selectedIndex
            reconcileHeaderToActive()
        }
    }

    /** Discovered ReactScrollView per page; validated on use. */
    private val pageScrollViews = SparseArray<ReactScrollView>()
    /**
     * Offsets a page still has to reach. Pages mount lazily (first visit),
     * so the neighbour pre-sync often runs before the page has a scroll
     * view, and a fresh FlashList's content grows over several layouts —
     * a single scrollTo would clamp. Each content layout retries until the
     * offset is reached or the page gives up (see [giveUpSync]).
     */
    private val pendingSync = SparseIntArray()
    private val contentObserved: MutableSet<View> =
        Collections.newSetFromMap(WeakHashMap<View, Boolean>())
    private val observed: MutableSet<View> =
        Collections.newSetFromMap(WeakHashMap<View, Boolean>())
    /** Extra bottom padding this shell added per scroll view for
     *  [allowFullCollapse] — tracked so the view's own padding is restored. */
    private val collapseSlack = WeakHashMap<ReactScrollView, Int>()
    /** Height Fabric last laid a page's content view out at. */
    private val naturalContentHeight = WeakHashMap<View, Int>()
    /** True while this view is re-laying a content view out itself. */
    private var applyingSlack = false

    // MARK: - Props

    fun setHeaderHeightDp(dp: Int) {
        val px = (dp * density).toInt()
        if (px == headerHeightPx) return
        headerHeightPx = px
        resyncOffsetToActive()
        // The slack each page needs is measured against the header height.
        applyCollapseSlackToAll()
        requestLayout()
    }

    fun setPinTabBar(value: Boolean) {
        if (value == pinTabBar) return
        pinTabBar = value
        resyncOffsetToActive()
        applyCollapseSlackToAll()
        requestLayout()
    }

    fun setPageScrollEnabled(value: Boolean) {
        pageScrollEnabled = value
    }

    fun setAllowFullCollapse(value: Boolean) {
        if (value == allowFullCollapse) return
        allowFullCollapse = value
        applyCollapseSlackToAll()
    }

    fun setTabBarHeightDp(dp: Int) {
        val px = (dp * density).toInt()
        if (px == tabBarHeightPx) return
        tabBarHeightPx = px
        requestLayout()
    }

    /**
     * The header re-measured (content loaded, fonts settled…). Clamping the
     * old offset is not enough: pages re-pad to the NEW height while the
     * bands sit at an offset derived from the OLD one, which shows as a
     * phantom gap under the tab bar until the next scroll. Re-derive the
     * offset from the active list's actual position instead.
     */
    private fun resyncOffsetToActive() {
        val sv = activeScrollView()
        if (sv == null) {
            applyHeaderOffset(headerOffset.coerceIn(0, collapsibleHeightPx), animated = false)
            return
        }
        val y = sv.scrollY
        lastActiveScrollY = y
        val target = if (directionMode) {
            // Keep the delta-driven offset, but hold both invariants:
            // 0 <= offset <= min(y, headerHeightPx).
            minOf(headerOffset, collapsibleHeightPx, maxOf(y, 0))
        } else {
            y.coerceIn(0, collapsibleHeightPx)
        }
        applyHeaderOffset(target, animated = false)
    }

    fun setPageCount(value: Int) {
        pendingPageCount = value
    }

    fun setSelectedIndex(value: Int) {
        pendingSelectedIndex = value
    }

    fun setCollapseThresholdDp(dp: Int) {
        collapseThresholdPx = (dp * density).toInt()
        updateCollapsed()
    }

    fun setCollapseMode(value: String) {
        directionMode = value == "direction"
        // Re-anchor the delta tracker so the first scroll after a mode change
        // doesn't jump.
        lastActiveScrollY = activeScrollView()?.scrollY ?: 0
    }

    fun setSwipeEnabled(value: Boolean) {
        swipeEnabled = value
        pager.isUserInputEnabled = value
    }

    /** False when the screen provides no onRefresh — the pull gesture must
     *  not arm at all (nothing would ever clear the spinner). */
    fun setRefreshEnabled(value: Boolean) {
        refreshLayout.isEnabled = value
        if (!value && refreshLayout.isRefreshing) refreshLayout.isRefreshing = false
    }

    fun setRefreshing(value: Boolean) {
        if (refreshLayout.isRefreshing != value) refreshLayout.isRefreshing = value
    }

    // MARK: - Commands (imperative ref API)
    //
    // Every command goes THROUGH the collapse engine. The header is derived
    // from the active list's position, so moving it on its own would desync
    // it from the content; these move the list and let the engine follow.

    /** Scroll a page's list to its top (`page` < 0 = the active page). */
    fun scrollToTop(page: Int, animated: Boolean) {
        val target = if (page < 0) activeIndex else page
        val sv = scrollViewOf(target) ?: return
        if (target == activeIndex) reconcileAnimator?.cancel()
        pendingCollapse = false
        if (animated) sv.smoothScrollTo(0, 0) else sv.scrollTo(0, 0)
    }

    /**
     * Move the pager. `onPageSelected` fires the same way it does for a
     * swipe, so JS's controlled index catches up naturally — the selection
     * is recorded first, or the callback would discard the event as a
     * re-layout echo.
     */
    fun setIndex(index: Int, animated: Boolean) {
        if (index < 0 || index >= pageCount) return
        selectedIndex = index
        pendingSelectedIndex = -1
        if (pager.currentItem != index) pager.setCurrentItem(index, animated && isLaidOut && width > 0)
    }

    /** Scroll the active list until the bands are fully collapsed. */
    fun collapse(animated: Boolean) {
        val sv = activeScrollView() ?: return
        reconcileAnimator?.cancel()
        // The list must be able to hold the offset before anything scrolls it.
        applyCollapseSlack(sv)
        if (sv.scrollY >= collapsibleHeightPx) {
            // Already deep enough. Classic: the header mirrors it. Direction:
            // the bands may still be open (the offset is not tied to the
            // position there) — close them directly, which offset <= scrollY
            // permits.
            if (directionMode) applyHeaderOffset(collapsibleHeightPx, animated)
            return
        }
        pendingCollapse = directionMode
        val target = minOf(collapsibleHeightPx, contentRoom(sv).coerceAtLeast(0))
        if (animated) sv.smoothScrollTo(0, target) else sv.scrollTo(0, target)
    }

    /**
     * Bring the bands back. Classic: the header mirrors the list, so scroll
     * the list to its top. Direction: the header alone, which that mode
     * allows (offset 0 <= any scrollY).
     */
    fun expand(animated: Boolean) {
        pendingCollapse = false
        if (!directionMode) {
            scrollToTop(-1, animated)
            return
        }
        applyHeaderOffset(0, animated)
        // Re-anchor the delta tracker: the next scroll must be a delta from
        // the list's real position, not a phantom jump.
        activeScrollView()?.let { lastActiveScrollY = it.scrollY }
    }

    /**
     * Props land in arbitrary order within a commit; `pageCount` must be
     * applied before `selectedIndex` or the pager clamps the selection to
     * an empty adapter.
     */
    fun onPropsApplied() {
        if (pendingPageCount >= 0 && pendingPageCount != pageCount) {
            pageCount = pendingPageCount
            // Routes changed: an index no longer means the same page.
            revealedPages.retainAll { it < pageCount }
            pager.offscreenPageLimit = maxOf(1, pageCount)
            adapter.notifyDataSetChanged()
        }
        pendingPageCount = -1
        if (pendingSelectedIndex >= 0) {
            val target = pendingSelectedIndex
            pendingSelectedIndex = -1
            if (target != selectedIndex || target != pager.currentItem) {
                selectedIndex = target
                if (target < pageCount && pager.currentItem != target) {
                    pager.setCurrentItem(target, isLaidOut && width > 0)
                }
            }
        }
    }

    // MARK: - RN children

    fun mountReactChild(child: View, index: Int) {
        val at = index.coerceIn(0, reactChildren.size)
        reactChildren.add(at, child)
        assignRole(child, at)
    }

    fun reactChildCount(): Int = reactChildren.size

    fun reactChildAt(index: Int): View? = reactChildren.getOrNull(index)

    fun unmountReactChildAt(index: Int) {
        val child = reactChildren.getOrNull(index) ?: return
        reactChildren.removeAt(index)
        releaseRole(child)
    }

    fun unmountAllReactChildren() {
        val all = ArrayList(reactChildren)
        reactChildren.clear()
        all.forEach { releaseRole(it) }
    }

    private fun assignRole(child: View, index: Int) {
        val nativeId = child.getTag(R.id.view_tag_native_id) as? String
        when {
            nativeId == ID_HEADER -> {
                headerChild = child
                headerSlot.attach(child)
            }
            nativeId == ID_TABBAR -> {
                tabBarChild = child
                tabBarSlot.attach(child)
            }
            nativeId != null && nativeId.startsWith(ID_PAGE_PREFIX) -> {
                val page = nativeId.removePrefix(ID_PAGE_PREFIX).toIntOrNull()
                if (page == null) {
                    Log.w(TAG, "Unparseable page nativeID '$nativeId'")
                    return
                }
                pageChildren.put(page, child)
                pageSlots.get(page)?.attach(child)
                pageScrollViews.remove(page)
            }
            else -> {
                // No nativeID: positional fallback (header, tab bar, pages…).
                when (index) {
                    0 -> { headerChild = child; headerSlot.attach(child) }
                    1 -> { tabBarChild = child; tabBarSlot.attach(child) }
                    else -> {
                        val page = index - 2
                        pageChildren.put(page, child)
                        pageSlots.get(page)?.attach(child)
                    }
                }
            }
        }
    }

    private fun releaseRole(child: View) {
        if (headerChild === child) {
            headerChild = null
            headerSlot.detach()
            return
        }
        if (tabBarChild === child) {
            tabBarChild = null
            tabBarSlot.detach()
            return
        }
        var page = -1
        pageChildren.forEach { key, value -> if (value === child) page = key }
        if (page >= 0) {
            pageChildren.remove(page)
            pageSlots.get(page)?.let { slot -> if (slot.child === child) slot.detach() }
            pageScrollViews.remove(page)
        } else {
            (child.parent as? ViewGroup)?.removeView(child)
        }
    }

    // MARK: - Pager

    private inner class PagerAdapter : RecyclerView.Adapter<PageHolder>() {
        override fun getItemCount(): Int = pageCount

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PageHolder {
            val slot = SlotView(parent.context)
            slot.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            return PageHolder(slot)
        }

        override fun onBindViewHolder(holder: PageHolder, position: Int) {
            val slot = holder.itemView as SlotView
            // A recycled slot may still map to its previous position.
            var stale = -1
            pageSlots.forEach { key, value -> if (value === slot && key != position) stale = key }
            if (stale >= 0) pageSlots.remove(stale)
            pageSlots.put(position, slot)
            slot.translationY = 0f
            // A recycled slot carries the previous page's alpha.
            slot.alpha = if (pendingSync.indexOfKey(position) >= 0) 0f else 1f
            val child = pageChildren.get(position)
            if (child != null) slot.attach(child) else slot.detach()
        }

        override fun onViewRecycled(holder: PageHolder) {
            val slot = holder.itemView as SlotView
            var pos = -1
            pageSlots.forEach { key, value -> if (value === slot) pos = key }
            if (pos >= 0) pageSlots.remove(pos)
            slot.alpha = 1f
            slot.detach()
        }
    }

    private class PageHolder(view: View) : RecyclerView.ViewHolder(view)

    private val pageChangeCallback = object : ViewPager2.OnPageChangeCallback() {
        override fun onPageScrolled(position: Int, positionOffset: Float, positionOffsetPixels: Int) {
            // Both pages that can be on screen get their offsets aligned to
            // the header BEFORE they're visible, so a swipe never reveals a
            // neighbour whose content sits at the wrong height.
            syncPageToHeader(position)
            if (positionOffset > 0f) syncPageToHeader(position + 1)
            // Mount-on-peek: announce a page the instant any sliver of it is
            // on screen, so a lazy page mounts (and is aligned to the header)
            // while it is still sliding in rather than after the swipe
            // settles — which is what made a freshly opened tab paint at the
            // wrong offset first.
            revealPage(position)
            if (positionOffsetPixels > 0) revealPage(position + 1)
            // The one per-frame event here, and only when something is
            // listening: a tab indicator that tracks the finger needs the
            // position every frame, but nothing else does.
            if (pageScrollEnabled) onPageScroll?.invoke(position, positionOffset)
        }

        override fun onPageScrollStateChanged(state: Int) {
            if (state == ViewPager2.SCROLL_STATE_DRAGGING) {
                userDragging = true
                // ViewPager2 took the touch stream: tell React so the JS
                // responder (a Pressable under the finger) is cancelled —
                // RN's own ScrollView does this, ViewPager2 cannot.
                notifyReactNativeGestureStarted()
            }
            if (state == ViewPager2.SCROLL_STATE_IDLE) {
                userDragging = false
                pinPagerToSelection()
            }
        }

        override fun onPageSelected(position: Int) {
            // JS owns the selection unless the user is dragging: a RecyclerView
            // re-layout can re-anchor on a focused page and "select" it, and
            // echoing that to JS would make the tab jump for real.
            if (!userDragging && position != selectedIndex) return
            // A tab PRESS arrives here before the incoming page has been
            // aligned: ViewPager2 dispatches the selection at the START of a
            // programmatic scroll, so onPageScrolled has not run for it yet.
            // Align it now — while `activeIndex` is still the outgoing page,
            // because syncPageToHeader ignores the active one — or the
            // reconcile below would read a page still sitting at its own
            // scroll position and ease the header open. A swipe is already
            // aligned by onPageScrolled, which makes this a no-op.
            syncPageToHeader(position)
            activeIndex = position
            selectedIndex = position
            reconcileHeaderToActive()
            if (lastEmittedIndex != position) {
                lastEmittedIndex = position
                onPageSelected?.invoke(position)
            }
        }
    }

    // Kept after the callback declarations it references — Kotlin runs
    // property initializers and init blocks in textual order.
    init {
        pager.layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        pager.orientation = ViewPager2.ORIENTATION_HORIZONTAL
        pager.adapter = adapter
        // Every page stays bound: the React pages are mounted whether or not
        // they're visible, and re-binding a React subtree on recycle is a
        // re-parent the shadow tree never asked for.
        pager.offscreenPageLimit = 1
        pager.registerOnPageChangeCallback(pageChangeCallback)
        // ViewPager2 wraps a RecyclerView whose item animator would animate
        // page changes on notifyDataSetChanged.
        (pager.getChildAt(0) as? RecyclerView)?.let { rv ->
            rv.itemAnimator = null
        }

        content.addView(pager)
        content.addView(headerSlot)
        content.addView(tabBarSlot)
        refreshLayout.addView(content)
        refreshLayout.setOnRefreshListener { onRefresh?.invoke() }
        // A pull only starts from the very top: header expanded AND the
        // active page at scroll 0. Otherwise the gesture is a scroll.
        refreshLayout.setOnChildScrollUpCallback { _, _ ->
            headerOffset > 0 || (activeScrollView()?.scrollY ?: 0) > 0
        }
        addView(refreshLayout)
    }

    // MARK: - Collapse engine

    private val scrollChangeListener =
        View.OnScrollChangeListener { v, _, scrollY, _, _ ->
            if (v !== activeScrollView()) return@OnScrollChangeListener
            // A scroll the page could not currently hold is a LAYOUT CLAMP,
            // not the user: Fabric re-lays the content view out at its own
            // height (dropping the extension allowFullCollapse gave it) and
            // ReactScrollView.onLayout re-issues scrollTo, which clamps
            // against that shorter content. Following it here would spring the
            // header open the moment a tab's content mounts. Re-extend the
            // page and put the scroll back instead.
            val active = v as? ReactScrollView
            if (allowFullCollapse && active != null && scrollY < headerOffset &&
                contentRoom(active) < headerOffset
            ) {
                applyCollapseSlack(active)
                if (contentRoom(active) >= headerOffset) {
                    active.scrollTo(0, headerOffset)
                    return@OnScrollChangeListener
                }
            }
            var target = if (directionMode) {
                // Follow the scroll DELTA: any up-scroll reveals the header,
                // any down-scroll hides it; pinned open at the very top.
                // Because the offset only ever grows at the content's own
                // rate from the top, offset <= scrollY holds and the content
                // never leaves a gap under the tab bar.
                val dy = scrollY - lastActiveScrollY
                if (scrollY <= 0) 0
                else (headerOffset + dy).coerceIn(0, collapsibleHeightPx)
            } else {
                scrollY.coerceIn(0, collapsibleHeightPx)
            }
            lastActiveScrollY = scrollY
            // A programmatic collapse in direction mode: the delta alone would
            // leave the bands wherever they started plus the distance
            // scrolled; land them exactly once the list can hold the offset.
            if (pendingCollapse && scrollY >= collapsibleHeightPx) {
                pendingCollapse = false
                target = collapsibleHeightPx
            }
            // While the active page is still catching up to the header
            // (content mounting), a clamped scroll must not pop the header
            // open — only real user scrolls move it down.
            if (pendingSync.indexOfKey(activeIndex) >= 0 && target < headerOffset) {
                return@OnScrollChangeListener
            }
            reconcileAnimator?.cancel()
            applyHeaderOffset(target, animated = false)
        }

    /**
     * Discovery path for pages whose scroll view mounts after the page was
     * bound (lazy tab content): the first scroll of ANY ReactScrollView tells
     * us its instance; we resolve which page it belongs to and observe it.
     * `ReactScrollViewHelper` keeps only a weak reference — this field is
     * what keeps the listener alive.
     */
    private val discoveryListener = object : ReactScrollViewHelper.ScrollListener {
        override fun onScroll(
            scrollView: ViewGroup?,
            scrollEventType: ScrollEventType?,
            xVelocity: Float,
            yVelocity: Float,
        ) {
            val sv = scrollView as? ReactScrollView ?: return
            if (observed.contains(sv)) return
            val page = pageIndexOf(sv) ?: return
            observe(page, sv)
            if (pendingSync.indexOfKey(page) >= 0) trySync(page)
            if (page == activeIndex && pendingSync.indexOfKey(page) < 0) {
                applyHeaderOffset(sv.scrollY.coerceIn(0, collapsibleHeightPx), animated = false)
            }
        }

        override fun onLayout(scrollView: ViewGroup?) {
            val sv = scrollView as? ReactScrollView ?: return
            if (observed.contains(sv)) return
            val page = pageIndexOf(sv) ?: return
            observe(page, sv)
            if (pendingSync.indexOfKey(page) >= 0) trySync(page)
        }
    }

    private fun observe(page: Int, sv: ReactScrollView) {
        pageScrollViews.put(page, sv)
        if (observed.add(sv)) {
            sv.setOnScrollChangeListener(scrollChangeListener)
            // The viewport height is half of the slack equation.
            sv.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
                applyCollapseSlack(sv)
            }
        }
        val content = sv.getChildAt(0)
        if (content != null && contentObserved.add(content)) {
            content.addOnLayoutChangeListener { v, _, top, _, bottom, _, _, _, _ ->
                // Record what Fabric laid out, so the extension is always
                // measured from the content's own height instead of compounding.
                if (!applyingSlack) naturalContentHeight[v] = bottom - top
                // Content grew or shrank: so did the slack it needs.
                applyCollapseSlack(sv)
                val p = pageIndexOf(sv) ?: return@addOnLayoutChangeListener
                if (pendingSync.indexOfKey(p) >= 0) {
                    trySync(p)
                } else if (headerOffset > 0 && sv.scrollY < headerOffset &&
                    contentRoom(sv) >= headerOffset
                ) {
                    // The page was in sync, and this layout knocked it out:
                    // Fabric re-lays the content out at its own height and
                    // ReactScrollView.onLayout re-issues a scrollTo that clamps
                    // against it. Correct it HERE, inside the same layout pass,
                    // so the frame is never drawn with the content a header too
                    // low — waiting for the scroll callback is one frame late,
                    // which is the flicker.
                    sv.scrollTo(0, headerOffset)
                }
            }
        }
        content?.let { c ->
            if (!naturalContentHeight.containsKey(c)) naturalContentHeight[c] = c.height
        }
        applyCollapseSlack(sv)
        // Deliberately no trySync here: trySync → scrollViewOf → observe
        // would recurse. Callers that discover a view run the sync.
    }

    // MARK: - Full collapse on short pages

    /**
     * A page shorter than its viewport + the header has nothing to scroll, so
     * the header can't be pushed away on that tab (and pops back open when you
     * switch to it). Give it exactly the range it lacks as bottom padding:
     * `ReactScrollView.getMaxScrollY()` is `contentHeight - (height -
     * paddingTop - paddingBottom)`, so padding widens the scroll range that
     * every scroll, fling and overscroll path already clamps against — no
     * custom scrolling needed. `clipToPadding` must go off or the view would
     * clip the bottom of its own viewport. Pages that already have the range
     * get 0, and nothing moves until the user scrolls.
     */
    private fun applyCollapseSlack(sv: ReactScrollView) {
        val content = sv.getChildAt(0) ?: return
        if (sv.height <= 0) return
        val applied = collapseSlack[sv] ?: 0
        // Nothing to do, and nothing of ours to undo: never touch a page whose
        // screen does not use allowFullCollapse. This view re-lays the content
        // out, and doing that to a page we were never asked to extend can pin
        // it to a stale height and cost it its scroll range entirely.
        if (!allowFullCollapse && applied == 0) return
        // The content's own height, i.e. without the extension we gave it.
        // Fabric is the only thing that lays this view out (ReactScrollView
        // does not call super.onLayout), so the layout listener records the
        // height Fabric last set and every extension is measured from that.
        // With nothing applied the current height IS the natural one — trusting
        // it directly means a stale record can never outlive our own extension
        // (a list that remounts, say, gets a fresh content view whose recorded
        // height would otherwise never be refreshed).
        val natural =
            if (applied == 0) content.height
            else naturalContentHeight[content] ?: (content.height - applied)
        val room = natural - sv.height
        val needed = if (allowFullCollapse) (collapsibleHeightPx - room).coerceAtLeast(0) else 0
        if (needed == applied && content.height == natural + needed) return
        // Extend the CONTENT, not the ScrollView's padding: ScrollView refuses
        // to even begin a drag while `scrollY == 0 && !canScrollVertically(1)`,
        // and that check measures the child's bottom against the viewport —
        // bottom padding never moves the child's bottom, so a padded but short
        // page stays untouchable until something scrolls it programmatically.
        applyingSlack = true
        content.layout(content.left, content.top, content.right, content.top + natural + needed)
        applyingSlack = false
        if (needed == 0) collapseSlack.remove(sv) else collapseSlack[sv] = needed
    }

    /** How far this page can scroll right now. */
    private fun contentRoom(sv: ReactScrollView): Int =
        (sv.getChildAt(0)?.height ?: 0) - sv.height

    private fun applyCollapseSlackToAll() {
        pageScrollViews.forEach { _, sv -> applyCollapseSlack(sv) }
    }

    /**
     * A page that still owes a sync is NOT where the header says it is: its
     * content sits at its own scroll position, a header taller than it should
     * be. Showing it in that state is the flicker — with mount-on-peek the
     * page mounts while it is already sliding into view, so it would paint
     * low and jump up a frame later. Hide it while the sync is owed and
     * reveal it the moment it lands (or is conceded); a page in that state is
     * lazy-mounted and blank anyway, so nothing is lost.
     */
    private fun setPendingSync(page: Int, value: Int?) {
        if (value == null) pendingSync.delete(page) else pendingSync.put(page, value)
        pageSlots.get(page)?.alpha = if (value == null) 1f else 0f
        if (value != null) {
            // Safety valve: a page whose sync never completes — a tab with no
            // scroll view at all, say — must not stay invisible. Under
            // allowFullCollapse nothing concedes on a timer, so this is the
            // only thing that would ever reveal it. Showing it slightly out of
            // sync is bad; never showing it is worse.
            removeCallbacks(revealStuckPage)
            postDelayed(revealStuckPage, REVEAL_STUCK_MS)
        }
    }

    private val revealStuckPage: Runnable = Runnable {
        pageSlots.forEach { _, slot -> slot.alpha = 1f }
    }

    private fun trySync(page: Int) {
        val desired = pendingSync.get(page, -1)
        if (desired < 0) return
        val sv = scrollViewOf(page) ?: return
        applyCollapseSlack(sv)
        if (sv.scrollY < desired) sv.scrollTo(0, desired)
        if (sv.scrollY >= desired) {
            setPendingSync(page, null)
            if (page == activeIndex) removeCallbacks(giveUpSync)
        } else if (page == activeIndex && !allowFullCollapse) {
            // Content may still be growing; give it a beat before conceding.
            // Never under allowFullCollapse: that page is guaranteed the range
            // it needs, so it WILL hold the offset once it has mounted, and
            // the content-layout listener retries until it does. Conceding on
            // a timer would spring the header open on a tab opened for the
            // first time, which is exactly the collapse the user wants kept.
            removeCallbacks(giveUpSync)
            postDelayed(giveUpSync, SYNC_GIVE_UP_MS)
        }
    }

    /**
     * The active page still hasn't reached the header offset. Without
     * [allowFullCollapse] that means it is genuinely too short, so ease the
     * header to what it can hold (Twitter's behaviour). WITH it, every page is
     * guaranteed the range it needs, so a page that hasn't caught up is still
     * mounting — re-apply its slack and try again instead of conceding the
     * collapse the user already had.
     */
    // Explicit type: the body re-posts the runnable itself, which type
    // inference cannot resolve.
    /** The active page can't hold the header offset: ease the header to
     *  where it can (Twitter's behaviour for a short tab). */
    private val giveUpSync: Runnable = Runnable {
        setPendingSync(activeIndex, null)
        reconcileHeaderToActive()
    }

    /** Emitted once per page: JS only needs to learn that a page should mount. */
    private fun revealPage(page: Int) {
        if (page < 0 || page >= pageCount || !revealedPages.add(page)) return
        onPageRevealed?.invoke(page)
    }

    private fun pageIndexOf(view: View): Int? {
        var v: View? = view
        while (v != null && v !== this) {
            if (v is SlotView) {
                var found: Int? = null
                pageSlots.forEach { key, value -> if (value === v) found = key }
                return found
            }
            v = v.parent as? View
        }
        return null
    }

    private fun scrollViewOf(page: Int): ReactScrollView? {
        pageScrollViews.get(page)?.let { cached ->
            if (cached.isAttachedToWindow && pageIndexOf(cached) == page) return cached
            pageScrollViews.remove(page)
        }
        val root = pageChildren.get(page) ?: return null
        val found = findScrollView(root) ?: return null
        observe(page, found)
        if (pendingSync.indexOfKey(page) >= 0) post { trySync(page) }
        return found
    }

    private fun activeScrollView(): ReactScrollView? = scrollViewOf(activeIndex)

    /** Breadth-first so a nested vertical list inside a cell never wins. */
    private fun findScrollView(root: View): ReactScrollView? {
        val queue = ArrayDeque<View>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited < MAX_DISCOVERY_VISITS) {
            val v = queue.poll() ?: break
            visited++
            if (v is ReactScrollView) return v
            if (v is ViewGroup) for (i in 0 until v.childCount) queue.add(v.getChildAt(i))
        }
        return null
    }

    private fun applyHeaderOffset(offset: Int, animated: Boolean) {
        if (animated) {
            reconcileAnimator?.cancel()
            val from = headerOffset
            if (from == offset) return
            reconcileAnimator = ValueAnimator.ofInt(from, offset).apply {
                duration = 200
                interpolator = DecelerateInterpolator()
                addUpdateListener { setHeaderOffsetNow(it.animatedValue as Int) }
                start()
            }
            return
        }
        setHeaderOffsetNow(offset)
    }

    private fun setHeaderOffsetNow(offset: Int) {
        if (offset == headerOffset) return
        headerOffset = offset
        val ty = -offset.toFloat()
        headerSlot.translationY = ty
        tabBarSlot.translationY = ty
        updateCollapsed()
    }

    private fun updateCollapsed() {
        val next = headerOffset > collapseThresholdPx
        if (next == collapsed) return
        collapsed = next
        onCollapsedChange?.invoke(next)
    }

    /**
     * A neighbour must show its content at the same height the header is
     * at: header fully collapsed → the page's own scroll, but never above
     * the collapse point; otherwise exactly the header offset.
     */
    private fun syncPageToHeader(page: Int) {
        if (page < 0 || page >= pageCount || page == activeIndex) return
        val sv = scrollViewOf(page)
        if (sv == null) {
            // No scroll view yet (page content mounts on first visit): apply
            // once it appears.
            setPendingSync(page, headerOffset)
            return
        }
        // Before anything tries to scroll this page: give it the range it
        // needs. Otherwise the scrollTo below clamps to whatever range the
        // page happens to have, the sync stays pending, and the give-up
        // concedes the header open — losing the collapse exactly when
        // switching to a short tab.
        applyCollapseSlack(sv)
        // Direction mode: the header may sit anywhere relative to the page's
        // own scroll, so a page only ever needs to be at least `offset` deep
        // (never scrolled back up to match). Classic: exact match below the
        // full-collapse point.
        val desired = when {
            // Align to the header, do NOT keep a deeper scroll: the bands sit
            // at `offset`, so a page left scrolled past that shows its content
            // behind them — what returning to a scrolled tab looked like.
            directionMode -> headerOffset
            headerOffset >= collapsibleHeightPx -> maxOf(sv.scrollY, collapsibleHeightPx)
            else -> headerOffset
        }
        if (sv.scrollY != desired) sv.scrollTo(0, desired)
        setPendingSync(page, if (sv.scrollY < desired) desired else null)
    }

    /**
     * The page that just became active decides the header. Normally the
     * pre-sync above made this a no-op; when the page is too short to reach
     * the current offset, ease the header to where that page can hold it
     * (Twitter's behaviour) instead of snapping.
     */
    private fun reconcileHeaderToActive() {
        val sv = activeScrollView()
        if (sv == null) {
            // No page to measure yet: anchor the delta to the header itself, so
            // the first scroll that arrives is a delta of zero rather than the
            // distance from whatever the PREVIOUS tab was scrolled to.
            lastActiveScrollY = headerOffset
            // Content not mounted yet: hold the header and catch the page up
            // when it arrives instead of snapping the header open.
            if (headerOffset > 0) setPendingSync(activeIndex, headerOffset)
            return
        }
        // Re-anchor BEFORE the early return below. In 'direction' mode the
        // header follows the scroll DELTA, so a stale anchor from the tab you
        // just left turns the first scroll event on this tab into a large
        // phantom delta — revealing the header on top of content that is
        // already at the top.
        lastActiveScrollY = sv.scrollY
        if (pendingSync.indexOfKey(activeIndex) >= 0) {
            trySync(activeIndex)
            if (pendingSync.indexOfKey(activeIndex) >= 0) return
        }
        val target = if (directionMode) {
            // Only concede when the page cannot hold the current offset.
            if (sv.scrollY < headerOffset) sv.scrollY.coerceIn(0, collapsibleHeightPx) else headerOffset
        } else {
            sv.scrollY.coerceIn(0, collapsibleHeightPx)
        }
        if (target != headerOffset) applyHeaderOffset(target, animated = isLaidOut)
    }

    // MARK: - Measure / layout

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        val height = MeasureSpec.getSize(heightMeasureSpec)
        setMeasuredDimension(width, height)
        refreshLayout.measure(
            MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
        )
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        refreshLayout.layout(0, 0, r - l, b - t)
    }

    /**
     * Owns the shell geometry (pager under two translated bands) and lets a
     * vertical drag that starts on a band scroll the active page, the way
     * Instagram lets you drag the profile header. Horizontal swipes on the
     * header are intentionally inert (product decision).
     */
    private inner class ContentView(context: Context) : ViewGroup(context) {
        private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
        private var downX = 0f
        private var downY = 0f
        private var downOnBand = false
        private var downOnHorizontalScrollable = false
        private var forwarding = false

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            val width = MeasureSpec.getSize(widthMeasureSpec)
            val height = MeasureSpec.getSize(heightMeasureSpec)
            setMeasuredDimension(width, height)
            pager.measure(
                MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
            )
            headerSlot.measure(
                MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(headerHeightPx, MeasureSpec.EXACTLY),
            )
            tabBarSlot.measure(
                MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(tabBarHeightPx, MeasureSpec.EXACTLY),
            )
        }

        override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
            val w = r - l
            val h = b - t
            pager.layout(0, 0, w, h)
            headerSlot.layout(0, 0, w, headerHeightPx)
            tabBarSlot.layout(0, headerHeightPx, w, headerHeightPx + tabBarHeightPx)
            val ty = -headerOffset.toFloat()
            headerSlot.translationY = ty
            tabBarSlot.translationY = ty
        }

        /**
         * Both bands: a vertical drag anywhere on the header or tab strip
         * scrolls the active page (Instagram lets you drag the header).
         * Horizontal drags on the bands are deliberately NOT paged — the
         * header is not a swipe surface, and the tab strip scrolls itself.
         */
        private fun isOnBand(y: Float): Boolean =
            y < headerHeightPx + tabBarHeightPx - headerOffset

        private fun isOnHeader(y: Float): Boolean = y < headerHeightPx - headerOffset

        /** Depth-first hit test for a horizontally scrollable view under the
         *  point (coordinates local to [view]). */
        private fun horizontallyScrollableAt(view: View, x: Float, y: Float): Boolean {
            if (x < 0f || y < 0f || x > view.width || y > view.height) return false
            if (view.canScrollHorizontally(-1) || view.canScrollHorizontally(1)) return true
            if (view is android.widget.HorizontalScrollView) return true
            if (view !is ViewGroup) return false
            for (i in 0 until view.childCount) {
                val child = view.getChildAt(i)
                if (child.visibility != View.VISIBLE) continue
                val cx = x - child.left - child.translationX
                val cy = y - child.top - child.translationY
                if (horizontallyScrollableAt(child, cx, cy)) return true
            }
            return false
        }

        /** Where forwarded events go: the active page's scroll view, or null
         *  to swallow the gesture (horizontal drag on the header: inert by
         *  design, but it must still cancel the press under the finger). */
        private var forwardTarget: View? = null
        private val tmpLoc = IntArray(2)
        private val tmpLoc2 = IntArray(2)

        private fun forward(ev: MotionEvent, action: Int? = null) {
            val target = forwardTarget ?: return
            // Event coords are ours; translate into the target's frame.
            getLocationInWindow(tmpLoc)
            target.getLocationInWindow(tmpLoc2)
            val copy = MotionEvent.obtain(ev)
            copy.offsetLocation((tmpLoc[0] - tmpLoc2[0]).toFloat(), (tmpLoc[1] - tmpLoc2[1]).toFloat())
            if (action != null) copy.action = action
            target.dispatchTouchEvent(copy)
            copy.recycle()
        }

        override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = ev.x
                    downY = ev.y
                    downOnBand = isOnBand(ev.y)
                    // A horizontal list INSIDE the header (date pickers, chip
                    // rows…) owns its own horizontal gestures — never swallow
                    // those.
                    downOnHorizontalScrollable = isOnHeader(ev.y) &&
                        horizontallyScrollableAt(
                            headerSlot,
                            ev.x - headerSlot.left - headerSlot.translationX,
                            ev.y - headerSlot.top - headerSlot.translationY,
                        )
                    forwarding = false
                    forwardTarget = null
                }
                MotionEvent.ACTION_MOVE -> {
                    if (!downOnBand || forwarding) return forwarding
                    val dx = ev.x - downX
                    val dy = ev.y - downY
                    val vertical = kotlin.math.abs(dy) > touchSlop && kotlin.math.abs(dy) > kotlin.math.abs(dx) * 1.5f
                    val horizontal = kotlin.math.abs(dx) > touchSlop && kotlin.math.abs(dx) > kotlin.math.abs(dy) * 1.5f
                    val target: View? = if (vertical) activeScrollView() else null
                    val swallow = horizontal && isOnHeader(downY) && !downOnHorizontalScrollable
                    if (target != null || swallow) {
                        // Claim the gesture (band children get ACTION_CANCEL)
                        // and open it on the target with a synthetic DOWN at
                        // the original touch point so its own slop logic runs.
                        forwarding = true
                        forwardTarget = target
                        parent?.requestDisallowInterceptTouchEvent(true)
                        notifyReactNativeGestureStarted(ev)
                        if (target != null) {
                            val down = MotionEvent.obtain(ev)
                            down.setLocation(downX, downY)
                            forward(down, MotionEvent.ACTION_DOWN)
                            down.recycle()
                            forward(ev)
                        }
                        return true
                    }
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    downOnBand = false
                }
            }
            return false
        }

        override fun onTouchEvent(ev: MotionEvent): Boolean {
            if (!forwarding) return false
            forward(ev)
            if (ev.actionMasked == MotionEvent.ACTION_UP || ev.actionMasked == MotionEvent.ACTION_CANCEL) {
                forwarding = false
                downOnBand = false
                forwardTarget = null
                parent?.requestDisallowInterceptTouchEvent(false)
            }
            return true
        }
    }

    /**
     * React Native swallows descendant `requestLayout()` calls: drive our own pass.
     *
     * Only while attached: a `post` made before attachment lands in the
     * pre-attach run queue, which never fired for this view (the flag then
     * stayed set and every later request — the real header height — was
     * dropped). The first pass comes from Fabric's own `layout()` anyway.
     */
    override fun requestLayout() {
        super.requestLayout()
        if (!isAttachedToWindow || layoutPassScheduled) return
        layoutPassScheduled = true
        post(measureAndLayout)
    }

    private var layoutPassScheduled = false

    private val measureAndLayout = Runnable {
        layoutPassScheduled = false
        if (width == 0 || height == 0) return@Runnable
        // forceLayout down the owned subtree: a manual pass carries no
        // FORCE_LAYOUT flag, so a child whose box changed for an external
        // reason (the header height arriving) would otherwise keep its size.
        refreshLayout.forceLayout()
        content.forceLayout()
        pager.forceLayout()
        headerSlot.forceLayout()
        tabBarSlot.forceLayout()
        measure(
            MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
        )
        layout(left, top, right, bottom)
        pinPagerToSelection()
    }

    // MARK: - Lifecycle

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        ReactScrollViewHelper.addScrollListener(discoveryListener)
        // Anything requested while detached was intentionally not scheduled.
        layoutPassScheduled = false
        requestLayout()
        // Detach dropped the reveal-stuck fallback; a page still owing a sync
        // must not depend on that sync ever completing to become visible.
        if (pendingSync.size() > 0) {
            removeCallbacks(revealStuckPage)
            postDelayed(revealStuckPage, REVEAL_STUCK_MS)
        }
    }

    override fun onDetachedFromWindow() {
        ReactScrollViewHelper.removeScrollListener(discoveryListener)
        removeCallbacks(measureAndLayout)
        removeCallbacks(giveUpSync)
        removeCallbacks(revealStuckPage)
        lastTouch?.recycle()
        lastTouch = null
        layoutPassScheduled = false
        reconcileAnimator?.cancel()
        super.onDetachedFromWindow()
    }

    /**
     * Holds exactly one RN-managed view at (0,0) filling the slot. Measures
     * it with EXACTLY specs only — ReactViewGroup asserts on anything else —
     * and otherwise leaves its frame to Fabric.
     */
    class SlotView(context: Context) : ViewGroup(context) {
        var child: View? = null
            private set

        fun attach(view: View) {
            if (child === view) return
            detach()
            (view.parent as? ViewGroup)?.removeView(view)
            child = view
            addView(view)
            requestLayout()
        }

        fun detach() {
            val c = child ?: return
            child = null
            removeView(c)
        }

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            val w = MeasureSpec.getSize(widthMeasureSpec)
            val h = MeasureSpec.getSize(heightMeasureSpec)
            setMeasuredDimension(w, h)
            child?.measure(
                MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY),
            )
        }

        override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
            val c = child
            c?.layout(0, 0, r - l, b - t)
        }
    }

    companion object {
        private const val TAG = "CollapsibleTabsHostView"
        const val ID_HEADER = "tabs-header"
        const val ID_TABBAR = "tabs-tabbar"
        const val ID_PAGE_PREFIX = "tabs-page-"
        private const val MAX_DISCOVERY_VISITS = 4000
        private const val SYNC_GIVE_UP_MS = 400L
        private const val REVEAL_STUCK_MS = 1200L
    }
}
