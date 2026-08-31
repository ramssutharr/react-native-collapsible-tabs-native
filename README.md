# react-native-collapsible-tabs-native

Native **collapsible tabs** for React Native: a collapsing header with a
pinned tab bar over a swipeable tab pager — the Instagram / Twitter profile
layout — where the collapse is driven by **native code** (UIKit on iOS,
`ViewPager2` on Android), not by a JS or Reanimated worklet.

Because the header is translated inside the same native scroll callback that
moves the list, the header, tab bar and list content always move **in the
same frame**. There is no per-frame JS work in the scroll path, so heavy JS
load cannot desynchronise them.

Your header, tab bar and tab pages are ordinary React components. The native
side only owns geometry and gestures.

<p>
  <a href="https://www.npmjs.com/package/react-native-collapsible-tabs-native"><img src="https://img.shields.io/npm/v/react-native-collapsible-tabs-native.svg" alt="npm version" /></a>
  <a href="https://github.com/ramssutharr/react-native-collapsible-tabs-native/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/react-native-collapsible-tabs-native.svg" alt="license" /></a>
</p>

## Why not a JS implementation?

JS collapsible-tab libraries (including ones built on Reanimated) move the
list content from the native scroll view but move the header from an
animation callback fed by that scroll's *event*. Two update paths mean the
header runs at least one frame behind the list — visible as a gap opening
between the tab bar and the content on a fast fling, worst on Android and on
iOS whenever the JS thread is busy. This library removes the second update
path instead of trying to keep up with it.

## What it does

- Collapsing header + pinned tab bar over a native horizontal pager, in
  frame-perfect sync with the active list (native
  `UIScrollViewDelegate` / `View.OnScrollChangeListener`).
- Any vertical list that renders a React Native `ScrollView` works as a tab
  page: `ScrollView`, `FlatList`, `SectionList`,
  [FlashList](https://github.com/Shopify/flash-list),
  [LegendList](https://github.com/LegendApp/legend-list) — wrapped with
  `createTabList` so its content is padded under the header.
- Vertical drags on the header (or tab bar) scroll the active page, with a
  display-link-driven fling on iOS and native event forwarding on Android.
- Swipe between tabs; tab pages mount lazily on first visit; a
  freshly-mounted or neighbouring page is aligned to the current header
  offset before it becomes visible.
- Optional `allowFullCollapse`: tabs with little or no content (an empty
  state, one row) still scroll the header away, because native gives those
  pages exactly the scroll range they lack.
- Container-level pull-to-refresh (`refreshing` / `onRefresh`): the scroll
  view bounce on iOS, `SwipeRefreshLayout` on Android.
- `onCollapsedChange` fires once per threshold crossing (not per frame) — use
  it to swap fixed chrome, e.g. reveal a title in your own top bar.
- Presses under a finger that scrolled are cancelled correctly: a swipe that
  ends on a `Pressable` does not trigger it; a deliberate tap does.
- A minimal default `TabBar` (equal-width labels + underline, colours via
  props), or bring your own with `renderTabBar`.
- TypeScript types throughout.

## What it does **not** do

Read this before choosing the library — these are real constraints, not
roadmap fine print:

- **New Architecture (Fabric) only.** No Paper support. React Native ≥ 0.76
  (developed and tested on RN 0.83).
- The pager's swipe **position is not exposed to JS**, so a custom tab
  indicator cannot track the finger mid-swipe; it can only animate when the
  index settles (the default `TabBar` moves its underline instantly).
- No scroll-position events to JS. You get `onPageSelected` and the
  `onCollapsedChange` crossing — nothing per-frame (that's the point).
- No min-header / sticky-segment support: the header collapses fully as one
  band (choose `collapseMode` for when it comes back).
- Horizontal swipes that start **on the header** are deliberately inert (they
  neither page nor scroll). Swipe on the content or use the tab strip. The
  tab-bar band scrolls its own content horizontally if you render one that
  does.
- By default, a tab whose content is too short to hold the current collapse
  offset eases the header back to the offset that tab can hold once the
  switch settles (Twitter-style). Set `allowFullCollapse` to give short pages
  the missing scroll range instead, so every tab collapses alike.
- Pull-to-refresh thresholds are fixed (≈70 pt pull, 60 pt spinner band on
  iOS; platform defaults on Android) and the spinner is not customisable yet.
- Pages stay mounted once visited (`lazy` only defers the first mount).
- No web / Expo Go support (native code; works in Expo dev clients / prebuild).

## Install

```sh
yarn add react-native-collapsible-tabs-native
cd ios && pod install
```

Autolinked on both platforms. New Architecture must be enabled (default since
RN 0.76).

## Usage

```tsx
import { useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import {
  CollapsibleTabView,
  createTabList,
  TabScrollView,
} from 'react-native-collapsible-tabs-native';

const TabFlashList = createTabList(FlashList);

const routes = [
  { key: 'posts', title: 'Posts' },
  { key: 'about', title: 'About' },
];

function Profile() {
  const [index, setIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <TopBar title={collapsed ? user.name : undefined} />
      <CollapsibleTabView
        navigationState={{ index, routes }}
        onIndexChange={setIndex}
        renderHeader={() => <ProfileHeader user={user} />}
        renderScene={({ route }) =>
          route.key === 'posts' ? (
            <TabFlashList data={posts} renderItem={renderPost} numColumns={3} />
          ) : (
            <TabScrollView>
              <About user={user} />
            </TabScrollView>
          )
        }
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await reload();
          setRefreshing(false);
        }}
        collapseThreshold={120}
        onCollapsedChange={setCollapsed}
        tabBarProps={{ activeColor: '#fff', inactiveColor: '#888', indicatorColor: '#BAFF11' }}
      />
    </>
  );
}
```

### The one rule

Tab bodies **must** pad their content by the header + tab-bar height — the
bands are overlaid on the pager, not stacked above it. `createTabList` (and
the bundled `TabScrollView` / `TabFlatList`) do this for you; or read
`useCollapsibleTabs().contentPaddingTop` and apply it yourself.

## API

### `<CollapsibleTabView>`

| prop | type | notes |
| --- | --- | --- |
| `navigationState` | `{ index, routes }` | routes are `{ key, title }` (`react-native-tab-view` shape) |
| `renderScene` | `({ route }) => ReactNode` | one page per route |
| `onIndexChange` | `(index) => void` | tab press or swipe settled |
| `renderHeader` | `() => ReactNode` | the collapsing header |
| `renderTabBar` | `({ routes, index, onIndexChange }) => ReactNode` | defaults to `TabBar`; return `null` to put your tabs inside the header instead |
| `tabBarProps` | `TabBarProps` | colours/`onTabPress` for the default `TabBar`; ignored with `renderTabBar` |
| `refreshing` / `onRefresh` | `boolean` / `() => void` | container-level pull-to-refresh; keep `refreshing` true until done |
| `collapseThreshold` | `number` (dp) | crossing point for `onCollapsedChange` |
| `collapseMode` | `'classic' \| 'direction'` | `'classic'` (default): header returns as content nears the top. `'direction'`: any up-scroll reveals it, any down-scroll hides it |
| `allowFullCollapse` | `boolean` | default `false`. Let tabs too short to scroll collapse the header anyway — native gives such a page exactly the scroll range it lacks (bottom inset / padding); tabs with enough content are untouched |
| `onCollapsedChange` | `(collapsed) => void` | fires on crossings only |
| `swipeEnabled` | `boolean` | default `true` |
| `lazy` | `boolean` | default `true`; mount a page on first visit |
| `style` | `ViewStyle` | shell container style |

### `createTabList(List)`

Wraps any list component that renders an RN `ScrollView` and forwards
`contentContainerStyle`, adding the shell's top padding. `TabScrollView` and
`TabFlatList` ship prebuilt:

```ts
const TabFlashList = createTabList(FlashList);
const TabLegendList = createTabList(LegendList);
```

### `<TabBar>`

The default strip: equal-width labels with an underline.
Props: `routes`, `index`, `onIndexChange`, `onTabPress?`, `activeColor?`,
`inactiveColor?`, `indicatorColor?`, `backgroundColor?`, `style?`.

### `<CollapsibleTabsShell>`

The lower-level primitive if you don't want the tab-view-shaped API:
`header` / `tabBar` / `pages[]` / `index` / `onIndexChange` plus the same
collapse/refresh props.

### `useCollapsibleTabs()`

`{ isNativeShell, contentPaddingTop, activeIndex }` — for custom tab bodies.

## How it works

Fabric mounts your header, tab bar and pages as children of the native view;
the native side re-parents them by `nativeID` into slots: a header band and a
tab-bar band drawn above a horizontal pager (paging `UIScrollView` on iOS,
`ViewPager2` on Android). The active page's vertical scroll view is located
and observed natively; its offset, clamped to the header height, becomes the
bands' translation — applied in the same callback that moved the content.
Neighbouring pages are pre-aligned during a swipe, and pages that mount late
are aligned as their content grows. When the shell takes over a gesture it
cancels React's in-flight touch, so buttons under the finger don't fire.

The native code is small and commented —
[`ios/NativeCollapsibleTabsContent.swift`](ios/NativeCollapsibleTabsContent.swift)
and
[`android/src/main/java/com/collapsibletabs/ui/CollapsibleTabsHostView.kt`](android/src/main/java/com/collapsibletabs/ui/CollapsibleTabsHostView.kt)
are the two files that matter.

## FAQ

**Is this a drop-in replacement for react-native-collapsible-tab-view or
react-native-tab-view?**
No. The `navigationState` / `renderScene` shape is intentionally similar so
migration is mechanical, but the props are not identical and scroll-position
values are not exposed to JS.

**Does it work with react-native-screens / React Navigation?**
Yes — it's a regular view; render it inside any screen.

**Sticky items inside the header?**
Not supported. The header collapses as one band; the tab bar is the only
pinned element (and you can move your tabs *into* the header and pin
nothing).

## Keywords

react-native collapsible tabs · collapsing header · sticky tab bar · profile
header tabs · tab view · FlashList · Fabric · new architecture · UIScrollView
· ViewPager2

## License

MIT © Ram Suthar
