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
