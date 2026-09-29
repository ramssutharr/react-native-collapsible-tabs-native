---
title: createTabList, FlashList and FlatList Integration
description: createTabList wraps FlashList, FlatList, SectionList, LegendList or ScrollView so it works as a tab page under a native collapsible header in React Native.
---

# `createTabList`: FlashList and FlatList integration

`createTabList` is how a list becomes a tab page. Wraps any list component that renders a React Native `ScrollView` so it works as a tab body: its `contentContainerStyle.paddingTop` is increased by the header + tab-bar height the shell reports, because the bands are overlaid on the pager rather than stacked above it. A `paddingTop` of your own is added on top, not replaced.

```ts
import { createTabList, TabScrollView, TabFlatList } from 'react-native-collapsible-tabs-native';
import { FlashList } from '@shopify/flash-list';
import { LegendList } from '@legendapp/list';

const TabFlashList = createTabList(FlashList);
const TabLegendList = createTabList(LegendList);
```

`TabScrollView` and `TabFlatList` ship prebuilt. The component must accept `contentContainerStyle` and `style`, which every RN list does (`ScrollView`, `FlatList`, `SectionList`, FlashList, LegendList).

The wrapper forwards the ref and sets `scrollEventThrottle={16}` so the list still reports per frame to JS consumers that want its own `onScroll`.

## Padding it yourself

If you cannot wrap the list, read the padding from the context and apply it:

```tsx
import { useCollapsibleTabs } from 'react-native-collapsible-tabs-native';

const { contentPaddingTop } = useCollapsibleTabs();
<MyList contentContainerStyle={{ paddingTop: contentPaddingTop }} />
```

## Which scroll view drives the collapse

Native finds the page's main vertical scroll view by walking the page's view tree breadth-first, so a nested vertical list inside a cell never wins, and a horizontal list (a carousel) is skipped. One vertical scroll view per page is the expectation; the outermost one drives the header.
