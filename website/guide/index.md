---
title: Introduction to Native Collapsible Tabs for React Native
description: Native collapsible tabs for React Native, a collapsing header with a pinned tab bar over a swipeable pager, driven by UIKit and ViewPager2 so the header and list move in the same frame.
---

# Introduction

Native **collapsible tabs** for React Native: a collapsing header with a pinned tab bar over a swipeable tab pager, the Instagram and Twitter profile layout, where the collapse is driven by **native code** (UIKit on iOS, `ViewPager2` on Android), not by a JS or Reanimated worklet.

Because the header is translated inside the same native scroll callback that moves the list, the header, tab bar and list content always move **in the same frame**. There is no per-frame JS work in the scroll path, so heavy JS load cannot desynchronise them.

Your header, tab bar and tab pages are ordinary React components. The native side only owns geometry and gestures.

## React Native collapsible tabs for Instagram-style profiles

This layout is the top of Instagram, Twitter/X and LinkedIn profiles, and of most feeds: a profile header collapses as the content scrolls, the tab bar stays pinned under it, and each tab keeps its own scroll position while neighbouring tabs are aligned to the header as you swipe. That whole behaviour is what the shell owns; you supply the header, the tabs and the lists. See the [collapsible header guide](/guide/collapsible-header) for the header side and the [FlashList guide](/guide/flashlist) for the lists.

## What it does

- Collapsing header + pinned tab bar over a native horizontal pager, in frame-perfect sync with the active list (native `UIScrollViewDelegate` / `View.OnScrollChangeListener`). The tab bar can also collapse away with the header (`pinTabBar={false}`).
- Any vertical list that renders a React Native `ScrollView` works as a tab page: `ScrollView`, `FlatList`, `SectionList`, [FlashList](https://github.com/Shopify/flash-list), [LegendList](https://github.com/LegendApp/legend-list), wrapped with [`createTabList`](/api/create-tab-list) so its content is padded under the header.
- Vertical drags on the header (or tab bar) scroll the active page, with a display-link-driven fling on iOS and native event forwarding on Android. Horizontal lists inside the bands, a chip row in the header, the tab strip itself, keep their own sideways gestures, while their vertical drags still scroll the page.
- Swipe between tabs; a tab page mounts the moment it peeks into view (not when the swipe settles), and a freshly-mounted or neighbouring page is aligned to the current header offset before it becomes visible.
- Opt-in per-frame events, meant for Reanimated worklets so the JS thread does nothing per frame: the pager's swipe position (`onPageScroll`), the bands' offset (`onHeaderOffsetChange`) and the active list's own offset (`onScrollOffsetChange`). See [Per-frame events](/guide/events).
- Tabs with little or no content (an empty state, one row) still scroll the header away, because native gives those pages exactly the scroll range they lack (`allowFullCollapse`, on by default).
- Container-level pull-to-refresh (`refreshing` / `onRefresh`): the scroll view bounce on iOS, `SwipeRefreshLayout` on Android. Threshold, resting offset, colours and size are props, and the native spinner can be hidden for a custom one.
- `onCollapsedChange` fires once per threshold crossing (not per frame). Use it to swap fixed chrome, e.g. reveal a title in your own top bar.
- An imperative [`ref`](/api/ref): `scrollToTop`, `setIndex`, `collapse`, `expand`, for "tap the active tab again" and friends.
- A header that reacts to its own collapse (`onHeaderOffsetChange` as a Reanimated worklet: avatar shrink, title fade, parallax, on the UI thread), and a pinned bottom strip (`headerMinHeight`).
- Presses under a finger that scrolled are cancelled correctly: a swipe that ends on a `Pressable` does not trigger it; a deliberate tap does.
- A minimal default [`TabBar`](/api/tab-bar) whose underline tracks the finger during a swipe, or bring your own with `renderTabBar`.
- TypeScript types throughout.

## What it does not do

Read [Limitations & compatibility](/guide/limitations) before choosing the library. In short: Fabric only, React Native ≥ 0.80, no web or Expo Go, no synchronous "read the position now" call, and the platform's own refresh indicator. If you are weighing it against a JS or Reanimated implementation, [Alternatives](/guide/alternatives) lays out the trade-off.

## Where it is used

The library is the profile shell of the [Currently](https://currently.club) iOS app, where the profile header, tab bar and FlashList pages have been on it since it was extracted. Most of the edge-case handling came from real users hitting it there.
