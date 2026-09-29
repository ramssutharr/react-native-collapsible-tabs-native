---
title: CollapsibleTabView, React Native Collapsible Tabs API
description: Props reference for CollapsibleTabView, the main component for a native collapsible header, pinned tab bar and swipeable tab pages in React Native.
---

# `CollapsibleTabView`: React Native collapsible tabs API

`CollapsibleTabView` is the main component for building a native collapsible header, pinned tab bar and swipeable tab layout in React Native. It has a `react-native-tab-view`-like API and accepts a [`ref`](/api/ref) of type `CollapsibleTabsRef`. Start with [Usage](/guide/usage) if you have not used it yet; the [FlashList guide](/guide/flashlist) covers the list side.

```tsx
import { CollapsibleTabView } from 'react-native-collapsible-tabs-native';
```

## Layout

| prop | type | notes |
| --- | --- | --- |
| `navigationState` | `{ index, routes }` | routes are `{ key, title }` (`react-native-tab-view` shape) |
| `renderScene` | `({ route }) => ReactNode` | one page per route; its body must pad by the header height, see [`createTabList`](/api/create-tab-list) |
| `onIndexChange` | `(index) => void` | tab press or swipe settled. The pager settling on the already-selected index is not reported |
| `renderHeader` | `() => ReactNode` | the collapsing header |
| `renderTabBar` | `({ routes, index, onIndexChange }) => ReactNode` | defaults to [`TabBar`](/api/tab-bar). Want the tabs to scroll away with the header? Keep them here and pass `pinTabBar={false}`; don't move them into `renderHeader` (pages clear the tab-bar band's height either way, and an empty band gives the shell nowhere to put the tabs back without landing on content) |
| `tabBarProps` | `TabBarProps` | colours / `onTabPress` for the default `TabBar`; ignored with `renderTabBar` |
| `lazy` | `boolean` | default `true`; mount a page on first visit (a page mounts as soon as it peeks into view during a swipe) |
| `swipeEnabled` | `boolean` | default `true` |
| `style` | `ViewStyle` | shell container style |
| `ref` | `CollapsibleTabsRef` | imperative surface, see [ref](/api/ref) |

## Collapse

| prop | type | notes |
| --- | --- | --- |
| `collapseMode` | `'classic' \| 'direction'` | `'classic'` (default): header returns as content nears the top. `'direction'`: any up-scroll reveals it, any down-scroll hides it |
| `pinTabBar` | `boolean` | default **`true`**: the tab bar stays pinned at the top once the header is gone. `false`: the whole band, tabs included, collapses as part of the header |
| `headerMinHeight` | `number` (dp) | default `0`. Bottom strip of the header that stays pinned above the tab bar (a search bar, a filter row) instead of scrolling away. The tab bar necessarily stays too, so `pinTabBar={false}` is ignored while this is > 0 |
| `allowFullCollapse` | `boolean` | default **`true`**. Tabs too short to scroll collapse the header anyway; native gives such a page exactly the scroll range it lacks; tabs with enough content are untouched. `false` restores the Twitter-style ease-back |
| `collapseThreshold` | `number` (dp) | crossing point for `onCollapsedChange` |
| `onCollapsedChange` | `(collapsed) => void` | fires on crossings only, never per frame |

## Pull-to-refresh

| prop | type | notes |
| --- | --- | --- |
| `refreshing` / `onRefresh` | `boolean` / `() => void` | container-level pull-to-refresh; keep `refreshing` true until done. Without `onRefresh` the pull gesture is not armed at all |
| `refreshThreshold` | `number` (dp) | pull distance that triggers a refresh on release. Default `70` |
| `refreshIndicatorOffset` | `number` (dp) | how far below the top the spinner rests while refreshing. Default `60` |
| `refreshTintColor` / `refreshBackgroundColor` | `ColorValue` | spinner colour, and the disc behind it (Android's native look, drawn on iOS too) |
| `refreshIndicatorSize` | `'default' \| 'large'` | spinner size |
| `refreshIndicatorHidden` | `boolean` | hide the native spinner and draw your own from `onHeaderOffsetChange`'s `pull`; the header band itself translates by the pull, so anything positioned above its top edge rides into view. iOS; on Android the spinner is invisible but there is no pull value. The gesture and `onRefresh` still fire |

## Per-frame events

Each accepts a Reanimated `useEvent` worklet or a plain `(e) => void`, and is emitted only while a handler is set. See [Per-frame events](/guide/events) for the worklet contract.

| prop | payload | notes |
| --- | --- | --- |
| `onPageScroll` | `{ position, offset }` | the pager's live swipe position, for a tab indicator that tracks the finger. The bundled `TabBar` already uses it: a plain function of yours is chained; a worklet takes the event over and the bundled indicator falls back to animating on settle |
| `onHeaderOffsetChange` | `{ offset, collapsibleHeight, pull }` (dp) | the bands' live offset while they move; `offset / collapsibleHeight` is the 0..1 progress. For a header that reacts to its own collapse (avatar shrink, title fade, cover parallax). Emitted only on change |
| `onScrollOffsetChange` | `{ index, offset }` (dp) | the active list's live scroll offset from its content top (0 = header open, `collapsibleHeight` = collapsed, larger = scrolled on; negative on an over-drag), per frame while it moves and once when the active page changes. For parallax deeper in the page, a scroll-to-top pill, a progress bar |

## Types

```ts
import type {
  CollapsibleTabViewProps,
  CollapsibleTabsRef,
  Route,
  TabBarProps,
  PageScrollHandler,
  HeaderOffsetHandler,
  ScrollOffsetHandler,
} from 'react-native-collapsible-tabs-native';
```
