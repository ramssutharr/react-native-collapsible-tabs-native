---
title: React Native Collapsible Tabs with FlashList
description: Use Shopify's FlashList as a tab page under a native collapsing header and pinned tab bar in React Native. Setup with createTabList, configuration, common issues and performance notes.
---

# React Native Collapsible Tabs with FlashList

[FlashList](https://github.com/Shopify/flash-list) is the list most React Native apps reach for on a profile or feed screen, and it is the list this library was extracted from production with. Any list that renders a React Native `ScrollView` works as a tab page, so FlashList needs no adapter: wrap it once with `createTabList` and use it like the plain component.

## Why FlashList under a collapsible header

A collapsible header multiplies the cost of a slow list. Every fling moves the header, the tab bar and the content together, and a list that drops frames while recycling cells shows it as a stutter in the header too, even though the header itself is native here. FlashList's cell recycling keeps the list side cheap, and this library keeps the header side off the JS thread entirely, so the two do not compete for the same frame budget.

## Installation

```sh
yarn add react-native-collapsible-tabs-native @shopify/flash-list
cd ios && pod install
```

FlashList v2 is the version these docs assume. It needs the New Architecture, which this library needs anyway.

## Basic example

```tsx
import { useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { CollapsibleTabView, createTabList } from 'react-native-collapsible-tabs-native';

// Once, at module scope: the wrapped component is stable across renders.
const TabFlashList = createTabList(FlashList);

const routes = [
  { key: 'posts', title: 'Posts' },
  { key: 'tagged', title: 'Tagged' },
];

export function Profile({ posts, tagged }) {
  const [index, setIndex] = useState(0);

  return (
    <CollapsibleTabView
      navigationState={{ index, routes }}
      onIndexChange={setIndex}
      renderHeader={() => <ProfileHeader />}
      renderScene={({ route }) => (
        <TabFlashList
          data={route.key === 'posts' ? posts : tagged}
          renderItem={({ item }) => <PostCell post={item} />}
          keyExtractor={item => item.id}
          numColumns={3}
        />
      )}
    />
  );
}
```

## What `createTabList` does

The header and tab bar are overlaid on the pager, not stacked above it, so a page's content has to start below them. `createTabList` adds the shell's `contentPaddingTop` (header height + tab-bar height, measured live) to the list's `contentContainerStyle.paddingTop`. A `paddingTop` of your own is added on top, not replaced. It also forwards the ref and sets `scrollEventThrottle={16}` so your own `onScroll`, if any, still fires per frame.

See the [`createTabList` API](/api/create-tab-list) for the full contract, and [Usage](/guide/usage#the-one-rule) for why the padding is the one rule.

## FlashList configuration

- **`numColumns`**: works as normal. Grids are the common profile case.
- **`ListHeaderComponent`**: renders under the collapsing header, inside the scrolling content. Use it for per-tab content (a count row, a filter chip strip that scrolls away). For chrome that must stay pinned, see the [collapsible header guide](/guide/collapsible-header).
- **`ListEmptyComponent`**: a short or empty tab still collapses the header, because the shell gives the page the scroll range it lacks (`allowFullCollapse`, on by default). Give the empty state a fixed height so the page has a stable size.
- **`onEndReached`**: pagination works unchanged. Appending rows grows the content; the shell re-evaluates the page's range as it grows.
- **`refreshing` / `onRefresh`**: do not pass these to the list. Pull-to-refresh belongs to the container, so pass them to `CollapsibleTabView` instead; it arms only with the header fully open and the list at its top.
- **`stickyHeaderIndices`**: sticky section headers inside the list work under the bands. Pass <code v-pre>stickyHeaderConfig={{ offset: contentPaddingTop }}</code> so they pin at the tab bar's bottom edge, and translate the sticky element by the live header offset. See [Recipes](/guide/recipes#sticky-section-headers-inside-a-list-dates-groups).
- **Horizontal FlashList inside the header**: a chip row or story strip works. Sideways drags belong to it; vertical drags on it still scroll the page.

## Common issues

**The first rows are hidden under the header.** The list is not wrapped, or a plain `FlashList` slipped in through a shared component. Every tab body must go through `createTabList` or read `useCollapsibleTabs().contentPaddingTop` itself.

**A gap between the tab bar and the content when switching tabs.** The page's content was shorter than the collapse point and then grew. The shell hides such a page until it can hold the offset and retries as content arrives, so this resolves itself; if it stays, the list is probably not the outermost scroll view of the page.

**Jest cannot parse the package.** It ships untranspiled TypeScript. Add it to `transformIgnorePatterns`; see [Getting started](/guide/getting-started#jest).

**Two vertical scroll views in one page.** Native picks the outermost one to drive the header. A vertical list nested inside a cell is fine; a second top-level vertical scroll view next to the list is not.

## Performance

The header cost is fixed: one native transform per scroll callback, no JS. What is left is the list itself, so FlashList's own advice applies: stable `keyExtractor`, memoised `renderItem`, `getItemType` for mixed cells, images sized to their cells. The [benchmarks](/benchmarks) fling a 500-row list with the JS thread 60 % busy and record 0 % janky frames on a mid-range 120 Hz Android phone; that is the configuration a FlashList feed lands in when the JS thread is busy rendering new rows.

## Example project

The repository's [example app](https://github.com/ramssutharr/react-native-collapsible-tabs-native/tree/main/example) uses `TabFlatList` for its long and short tabs, and the same shell runs FlashList grids on the profile screen of the Currently iOS app. Swapping `FlatList` for `FlashList` in the example is one `createTabList` call.

## See also

- [`CollapsibleTabView` API](/api/collapsible-tab-view)
- [`createTabList` API](/api/create-tab-list)
- [How it works](/guide/how-it-works)
- [Benchmarks](/benchmarks)
