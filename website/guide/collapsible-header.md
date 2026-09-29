---
title: React Native Collapsible Header
description: Build a collapsible header in React Native that scrolls away above a pinned tab bar, with a pinned bottom strip, Reanimated header animations, parallax and a stretch on over-pull, driven natively.
---

# React Native Collapsible Header

A **collapsible header** scrolls away as the content below it scrolls up and comes back as the content returns, leaving a pinned tab bar or title in its place. It is the top of every Instagram, Twitter and LinkedIn profile, and of most feeds. This page covers how this library handles the header: what collapses, what pins, and how to animate the header from its own collapse without touching the JS thread.

## What is a collapsible header?

Three parts move together: the header band, the tab bar under it, and the active page's list. As the list scrolls by `y`, the header translates up by `min(y, headerHeight)`; when the list is at its top the header is fully open. What makes the effect hard is keeping the three in the same frame. A header translated from the list's scroll *event* through a separate animation path can lag behind the list on a fast fling, especially under JS-thread load, which shows as a gap under the tab bar. Here the header is moved inside the same native scroll callback that moved the list, so it cannot lag; see [How it works](/guide/how-it-works).

## The header is a plain component

```tsx
<CollapsibleTabView
  renderHeader={() => (
    <View style={styles.header}>
      <Image source={{ uri: user.cover }} style={styles.cover} />
      <Avatar uri={user.avatar} />
      <Text style={styles.name}>{user.name}</Text>
      <Text style={styles.bio}>{user.bio}</Text>
      <ChipRow chips={filters} />
    </View>
  )}
  …
/>
```

Anything goes in it: images, buttons, a horizontal chip row. The shell measures its height and pages pad by it automatically. Buttons keep working at any collapse offset, and a vertical drag on the header scrolls the page, while a horizontal list inside it keeps its own sideways gesture.

## The pinned tab bar

By default the tab bar stays pinned at the top once the header is gone (`pinTabBar`, default `true`). Pass `pinTabBar={false}` and the whole band, tabs included, collapses with the header; pages still clear its height. Keep the tabs in `renderTabBar` for this rather than moving them into the header, so the shell has a band to bring back.

## A pinned strip at the bottom of the header

`headerMinHeight` keeps the header's *bottom* strip on screen above the tab bar: a search bar, a filter row, a segmented control. The header then travels `headerHeight - headerMinHeight` and stops.

```tsx
const FILTER_ROW_HEIGHT = 56;

<CollapsibleTabView headerMinHeight={FILTER_ROW_HEIGHT} renderHeader={() => (
  <View>
    <ProfileInfo />
    <FilterRow style={{ height: FILTER_ROW_HEIGHT }} />  {/* the last 56 dp stay */}
  </View>
)} … />
```

The tab bar necessarily stays pinned too while this is greater than 0.

## Header animations from the collapse

The header can react to its own collapse without a JS frame. `onHeaderOffsetChange` reports `{ offset, collapsibleHeight, pull }` per frame; read it in a Reanimated worklet and drive styles from a shared value:

```tsx
import Animated, { useEvent, useSharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';

const progress = useSharedValue(0); // 0 open → 1 collapsed
const onHeaderOffsetChange = useEvent<{ offset: number; collapsibleHeight: number; pull: number }>(
  e => {
    'worklet';
    progress.value = e.offset / Math.max(1, e.collapsibleHeight);
  },
  ['topHeaderOffsetChange', 'onHeaderOffsetChange'],
);

function Header({ progress }) {
  const avatar = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 0.55], Extrapolation.CLAMP) }],
  }));
  const bio = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
  }));
  return (
    <View>
      <Animated.View style={[styles.avatar, avatar]} />
      <Animated.Text style={[styles.bio, bio]}>{user.bio}</Animated.Text>
    </View>
  );
}

<CollapsibleTabView onHeaderOffsetChange={onHeaderOffsetChange} renderHeader={() => <Header progress={progress} />} … />
```

Reanimated is an optional peer of the library; it is imported only when you pass a worklet.

### Parallax cover

Move a cover image at half the header's speed so it appears to sit behind the rest:

```tsx
const cover = useAnimatedStyle(() => ({
  transform: [{ translateY: progress.value * collapsibleHeight * 0.5 }],
}));
```

`collapsibleHeight` arrives in the same event; keep it in a second shared value if the header height can change.

### Stretch on over-pull (iOS)

`pull` is the over-drag past the top on iOS. The bands already follow it, so a cover that scales with `pull` stretches like the Twitter header:

```tsx
const cover = useAnimatedStyle(() => ({
  transform: [{ scale: 1 + pull.value / 300 }],
}));
```

On Android the refresh layout owns the over-drag and `pull` is 0.

## Revealing a title in your own top bar

Chrome that never moves (a navigation bar) belongs above the shell. `onCollapsedChange` fires once per crossing of `collapseThreshold`, so swapping the bar's contents costs one render per direction change:

```tsx
const [collapsed, setCollapsed] = useState(false);

<TopBar title={collapsed ? user.name : undefined} />
<CollapsibleTabView collapseThreshold={120} onCollapsedChange={setCollapsed} … />
```

## Direction mode

`collapseMode="direction"` makes the header follow the scroll *direction* rather than the position: any upward scroll brings it back, any downward scroll hides it, wherever the list is. The feed feel rather than the profile feel. [`expand()`](/api/ref) reveals the header in place in this mode.

## Header with FlashList pages

Nothing changes on the header side. Wrap the list with `createTabList` and it pads itself under the header; see [Collapsible tabs with FlashList](/guide/flashlist).

## See also

- [`CollapsibleTabView` API](/api/collapsible-tab-view)
- [Per-frame events](/guide/events)
- [Recipes](/guide/recipes)
