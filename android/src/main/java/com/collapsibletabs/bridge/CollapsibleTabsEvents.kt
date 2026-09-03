package com.collapsibletabs.bridge

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

/** The pager settled on a page (user swipe or programmatic). */
class TabsPageSelectedEvent(
    surfaceId: Int,
    viewTag: Int,
    private val index: Int,
) : Event<TabsPageSelectedEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = NAME
    override fun getEventData(): WritableMap = Arguments.createMap().apply {
        putInt("index", index)
    }

    companion object { const val NAME = "topPageSelected" }
}

/**
 * A page showed any part of itself for the first time. Emitted ONCE per page,
 * as soon as it peeks in during a swipe, so a lazy page can mount while it is
 * still sliding into view rather than after the swipe settles.
 */
class TabsPageRevealedEvent(
    surfaceId: Int,
    viewTag: Int,
    private val index: Int,
) : Event<TabsPageRevealedEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = NAME
    override fun getEventData(): WritableMap = Arguments.createMap().apply {
        putInt("index", index)
    }

    companion object { const val NAME = "topPageRevealed" }
}

/**
 * The pager's live swipe position. This is the ONE per-frame event here, and
 * it is emitted only while `pageScrollEnabled` — i.e. only when something is
 * listening — so a tab indicator can track the finger and nothing else pays
 * for it.
 */
class TabsPageScrollEvent(
    surfaceId: Int,
    viewTag: Int,
    private val position: Int,
    private val offset: Float,
) : Event<TabsPageScrollEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = NAME
    override fun canCoalesce(): Boolean = true
    override fun getEventData(): WritableMap = Arguments.createMap().apply {
        putInt("position", position)
        putDouble("offset", offset.toDouble())
    }

    companion object { const val NAME = "topPageScroll" }
}

/**
 * The bands' live offset (dp). Per frame while they move, only while
 * `headerOffsetEnabled`, and only on change — so a header can react to its
 * own collapse (avatar shrink, title fade) and nothing else pays for it.
 */
class TabsHeaderOffsetChangeEvent(
    surfaceId: Int,
    viewTag: Int,
    private val offset: Float,
    private val collapsibleHeight: Float,
    private val pull: Float,
) : Event<TabsHeaderOffsetChangeEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = NAME
    override fun canCoalesce(): Boolean = true
    override fun getEventData(): WritableMap = Arguments.createMap().apply {
        putDouble("offset", offset.toDouble())
        putDouble("collapsibleHeight", collapsibleHeight.toDouble())
        putDouble("pull", pull.toDouble())
    }

    companion object { const val NAME = "topHeaderOffsetChange" }
}

/** The user pulled to refresh from the top of the container. */
class TabsRefreshEvent(surfaceId: Int, viewTag: Int) :
    Event<TabsRefreshEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = NAME
    override fun getEventData(): WritableMap = Arguments.createMap()

    companion object { const val NAME = "topRefresh" }
}

/**
 * The header offset crossed `collapseThreshold`. Emitted on the crossing
 * only — never per frame — so the sticky bar's cross-fade costs the JS
 * thread exactly one render per direction change.
 */
class TabsCollapsedChangeEvent(
    surfaceId: Int,
    viewTag: Int,
    private val collapsed: Boolean,
) : Event<TabsCollapsedChangeEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = NAME
    override fun getEventData(): WritableMap = Arguments.createMap().apply {
        putBoolean("collapsed", collapsed)
    }

    companion object { const val NAME = "topCollapsedChange" }
}
