---
title: Limitations & Compatibility
description: What react-native-collapsible-tabs-native does not do, and which React Native versions, architectures, platforms and list components it supports.
---

# Limitations & compatibility

Read this before choosing the library. These are real constraints, not roadmap fine print.

## Compatibility

| | |
| --- | --- |
| React Native | ≥ 0.80 (developed and tested on 0.83) |
| Architecture | New Architecture (Fabric) only; no Paper |
| Platforms | iOS and Android. No web, no Expo Go; Expo dev clients and prebuild work |
| Lists | anything that renders an RN `ScrollView`: `ScrollView`, `FlatList`, `SectionList`, FlashList v2, LegendList |
| Reanimated | optional peer, only imported when you pass a worklet handler |
| TypeScript | types shipped; the package is untranspiled TS (add it to Jest's `transformIgnorePatterns`) |

## What it does not do

- **New Architecture (Fabric) only.** No Paper support. React Native ≥ 0.80 (developed and tested on RN 0.83).
- **Per-frame positions are opt-in and meant for a Reanimated worklet**: the pager's swipe position (`onPageScroll`), the bands' offset (`onHeaderOffsetChange`) and the active list's own offset (`onScrollOffsetChange`). Nothing per-frame reaches the JS thread unless you pass a plain function. There is no synchronous "read the position now" call, and no built-in save/restore across remounts yet; you can *drive* positions through the [`ref`](/api/ref).
- **`Animated.event` with `useNativeDriver: true` does not work**, and cannot: on Fabric, native-driven animated events only reach the animated module through a deprecated back-channel React Native special-cases for its own ScrollView and has marked for removal. Use a Reanimated `useEvent` worklet or accept a plain JS callback.
- **The header collapses as one band.** `headerMinHeight` keeps its bottom strip pinned above the tab bar, and `pinTabBar={false}` lets the tabs scroll away with it, but there is no arbitrary "this child pins at the top while the rest scrolls away" slot inside the header. Sticky section headers *inside a page's list* are a list feature and work under the bands; see [Recipes](/guide/recipes).
- **Horizontal swipes that start on the header are deliberately inert.** They neither page nor scroll. Swipe on the content or use the tab strip. The tab-bar band scrolls its own content horizontally if you render one that does.
- **Short tabs are given scroll range** (`allowFullCollapse`, on by default) so they collapse like any other. Set it to `false` for the Twitter-style alternative, where the header eases back to whatever offset that tab can hold, but note that a page with no scroll range at all then cannot be scrolled or collapsed, and drags in the blank area below its content do nothing.
- **Pull-to-refresh is the platform's own indicator** (a `UIActivityIndicatorView` on iOS, `SwipeRefreshLayout` on Android). Threshold, resting offset, colours and size are props; a fully custom indicator component driven natively is not supported yet. On iOS you can hide the native one and draw your own from `onHeaderOffsetChange`'s `pull`.
- **Pages stay mounted once visited** (`lazy` only defers the first mount). A page mounts as soon as any sliver of it peeks in during a swipe, not when the swipe settles, so its data fetch starts if you drag toward it and change your mind.
- **No web / Expo Go support.** Native code; works in Expo dev clients and prebuild.

If one of these rules you out, [Alternatives](/guide/alternatives) describes what a JS or Reanimated implementation offers instead.
