package com.collapsibletabs.bridge

import android.view.View
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.NativeCollapsibleTabsManagerDelegate
import com.facebook.react.viewmanagers.NativeCollapsibleTabsManagerInterface
import com.collapsibletabs.ui.CollapsibleTabsHostView

/**
 * Fabric bridge for the shell:
 * codegen'd interface + delegate, `@ReactProp` kept alongside the overrides,
 * events resolved lazily per emit.
 */
@ReactModule(name = CollapsibleTabsViewManager.NAME)
class CollapsibleTabsViewManager(
    private val reactContext: ReactApplicationContext,
) : ViewGroupManager<CollapsibleTabsHostView>(),
    NativeCollapsibleTabsManagerInterface<CollapsibleTabsHostView> {

    private val delegate =
        NativeCollapsibleTabsManagerDelegate<CollapsibleTabsHostView, CollapsibleTabsViewManager>(this)

    override fun getName(): String = NAME

    override fun getDelegate(): ViewManagerDelegate<CollapsibleTabsHostView> = delegate

    override fun createViewInstance(context: ThemedReactContext): CollapsibleTabsHostView =
        CollapsibleTabsHostView(context).also { attachEvents(it) }

    private fun attachEvents(view: CollapsibleTabsHostView) {
        fun dispatcher() = UIManagerHelper.getEventDispatcherForReactTag(reactContext, view.id)
        fun surfaceId() = UIManagerHelper.getSurfaceId(view)

        view.onPageSelected = { index ->
            dispatcher()?.dispatchEvent(TabsPageSelectedEvent(surfaceId(), view.id, index))
        }
        view.onCollapsedChange = { collapsed ->
            dispatcher()?.dispatchEvent(
                TabsCollapsedChangeEvent(surfaceId(), view.id, collapsed),
            )
        }
        view.onRefresh = {
            dispatcher()?.dispatchEvent(TabsRefreshEvent(surfaceId(), view.id))
        }
    }

    override fun onAfterUpdateTransaction(view: CollapsibleTabsHostView) {
        super.onAfterUpdateTransaction(view)
        view.onPropsApplied()
    }

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
        mutableMapOf(
            TabsPageSelectedEvent.NAME to mapOf("registrationName" to "onPageSelected"),
            TabsCollapsedChangeEvent.NAME to mapOf("registrationName" to "onCollapsedChange"),
            TabsRefreshEvent.NAME to mapOf("registrationName" to "onRefresh"),
        )

    // MARK: - Props

    @ReactProp(name = "headerHeight")
    override fun setHeaderHeight(view: CollapsibleTabsHostView, value: Int) {
        view.setHeaderHeightDp(value)
    }

    @ReactProp(name = "tabBarHeight")
    override fun setTabBarHeight(view: CollapsibleTabsHostView, value: Int) {
        view.setTabBarHeightDp(value)
    }

    @ReactProp(name = "pageCount")
    override fun setPageCount(view: CollapsibleTabsHostView, value: Int) {
        view.setPageCount(value)
    }

    @ReactProp(name = "selectedIndex")
    override fun setSelectedIndex(view: CollapsibleTabsHostView, value: Int) {
        view.setSelectedIndex(value)
    }

    @ReactProp(name = "collapseThreshold")
    override fun setCollapseThreshold(view: CollapsibleTabsHostView, value: Int) {
        view.setCollapseThresholdDp(value)
    }

    @ReactProp(name = "collapseMode")
    override fun setCollapseMode(view: CollapsibleTabsHostView, value: String?) {
        view.setCollapseMode(value ?: "classic")
    }

    @ReactProp(name = "swipeEnabled")
    override fun setSwipeEnabled(view: CollapsibleTabsHostView, value: Boolean) {
        view.setSwipeEnabled(value)
    }

    @ReactProp(name = "refreshing")
    override fun setRefreshing(view: CollapsibleTabsHostView, value: Boolean) {
        view.setRefreshing(value)
    }

    // ── RN child mounting ──
    // Every RN child is re-parented into a native slot (header band, tab-bar
    // band, or a pager page) keyed by its nativeID. The ViewGroupManager child
    // API must describe ONLY what RN mounted, in RN's order — the host's real
    // child list also holds the pager and the two bands, which the shadow tree
    // knows nothing about (the shadow tree only knows RN's children).

    override fun addView(parent: CollapsibleTabsHostView, child: View, index: Int) {
        parent.mountReactChild(child, index)
    }

    override fun getChildCount(parent: CollapsibleTabsHostView): Int = parent.reactChildCount()

    override fun getChildAt(parent: CollapsibleTabsHostView, index: Int): View? =
        parent.reactChildAt(index)

    override fun removeViewAt(parent: CollapsibleTabsHostView, index: Int) {
        parent.unmountReactChildAt(index)
    }

    override fun removeAllViews(parent: CollapsibleTabsHostView) {
        parent.unmountAllReactChildren()
    }

    override fun needsCustomLayoutForChildren(): Boolean = false

    companion object {
        const val NAME = "NativeCollapsibleTabs"
    }
}
