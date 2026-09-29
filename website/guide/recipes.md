---
title: Recipes
description: Tap-to-top, a pinned filter bar on one tab, sticky section headers in FlashList, a finger-tracking tab indicator and a shrinking avatar with React Native collapsible tabs.
---

# Recipes

## Tap the active tab again to scroll to top

The pager settling on the page you already selected is not reported as a change, so a same-index `onIndexChange` can only mean a re-tap:

```tsx
const tabs = useRef<CollapsibleTabsRef>(null);
const onIndexChange = (next: number) => {
  if (next === index) {
    tabs.current?.scrollToTop();
  }
  setIndex(next);
};

<CollapsibleTabView ref={tabs} navigationState={{ index, routes }} onIndexChange={onIndexChange} … />
```

## A count in the header that jumps to a tab and collapses

```tsx
<Pressable onPress={() => { setIndex(0); tabs.current?.collapse(); }}>
  <Text>{momentsCount} Moments</Text>
</Pressable>
```

`collapse()` scrolls the active list until the bands are gone, so the header follows the content rather than moving on its own.

## A filter bar pinned under the tab bar on one tab

Two ways, neither needs the list's sticky headers.

**In the tab-bar band.** `renderTabBar` can return more than the tabs. Render the bar under them only when that tab is active. The band is pinned natively, so the bar collapses, pins and takes presses exactly like the tabs, and pages re-pad automatically because the shell re-measures the band. The band's height changes when you switch to that tab, so content shifts by the bar's height at that moment.

```tsx
renderTabBar={({ routes, index, onIndexChange }) => (
  <View>
    <TabBar routes={routes} index={index} onIndexChange={onIndexChange} />
    {index === 1 && <FilterBar />}
  </View>
)}
```

**Overlaid inside the page, riding with the bands.** Position it at `contentPaddingTop`, translate it by the live header offset, and pad the list by the bar's height. `createTabList` adds your `paddingTop` to the header padding rather than replacing it.

```tsx
// screen: one shared value for the bands' offset
const bands = useSharedValue({ offset: 0, pull: 0 });
const onHeaderOffsetChange = useEvent(
  e => {
    'worklet';
    bands.value = { offset: e.offset, pull: e.pull };
  },
  ['topHeaderOffsetChange', 'onHeaderOffsetChange'],
);

// inside the tab's page (pass `bands` down via props or context)
const { contentPaddingTop } = useCollapsibleTabs();
const style = useAnimatedStyle(() => ({
  transform: [{ translateY: -bands.value.offset + bands.value.pull }],
}));

<View style={{ flex: 1 }}>
  <TabFlashList
    data={data}
    renderItem={renderItem}
    contentContainerStyle={{ paddingTop: FILTER_BAR_HEIGHT }}
  />
  <Animated.View style={[{ position: 'absolute', top: contentPaddingTop, left: 0, right: 0 }, style]}>
    <FilterBar />
  </Animated.View>
</View>
```

## Sticky section headers inside a list (dates, groups)

That is the list's job, and it works under the bands. With FlashList v2, pass `stickyHeaderIndices` and <code v-pre>stickyHeaderConfig={{ offset: contentPaddingTop }}</code> (from `useCollapsibleTabs()`), then render the `StickyHeader` target inside a Reanimated view translated by `-offset` from `onHeaderOffsetChange`. The pinned header rides up with the bands, so its pin line is always exactly the bands' bottom edge.

## A custom tab bar whose indicator follows the finger

Measure each tab's `x` and width on layout, read `onPageScroll` into a shared value, and interpolate:

```tsx
const progress = useSharedValue(0);
const onPageScroll = useEvent<{ position: number; offset: number }>(
  e => {
    'worklet';
    progress.value = e.position + e.offset;
  },
  ['topPageScroll', 'onPageScroll'],
);

// in the tab bar, with `layouts` = [{ x, width }, …] measured on layout
const indicator = useAnimatedStyle(() => {
  const i = Math.floor(progress.value);
  const t = progress.value - i;
  const a = layouts[i] ?? layouts[0];
  const b = layouts[i + 1] ?? a;
  return {
    transform: [{ translateX: a.x + (b.x - a.x) * t }],
    width: a.width + (b.width - a.width) * t,
  };
});
```

The bundled `TabBar` does the equivalent with an RN `Animated.Value` you can also feed yourself through its `position` prop.

## A header that shrinks its avatar

See [`onHeaderOffsetChange`](/guide/events#onheaderoffsetchange-reacting-to-the-collapse). The example app's header does exactly this: avatar scale and bio opacity from one shared value, no JS frame.

## Deep-linking to a non-zero tab

Pass the initial `index` from the first render. The shell activates that page as soon as it has a width, on both platforms, so the header follows it without a swipe away and back.
