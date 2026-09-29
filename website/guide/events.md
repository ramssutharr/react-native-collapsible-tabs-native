---
title: Per-frame Events for Reanimated Worklets
description: onPageScroll, onHeaderOffsetChange and onScrollOffsetChange, per-frame swipe, header and list positions read on the UI thread with Reanimated useEvent.
---

# Per-frame events

Three things move per frame: the pager during a swipe, the bands during a collapse, and the active list during a scroll. Each is exposed as an event that is **off unless a handler is set**, and each accepts two shapes:

- a **Reanimated `useEvent` worklet** (an object, not a function): the value is read on the UI thread and the JS thread does no per-frame work. This is the intended way to animate from them.
- a **plain function**: simple, but it runs on the JS thread once per frame of motion, which is the cost this library exists to avoid. Fine for coarse work; not for animation.

All three are written from the same native callback that moves the bands, so anything you derive from them moves in the same frame as the header.

::: warning `Animated.event` does not work here
RN `Animated.event` with `useNativeDriver: true` is deliberately not supported, and cannot be: on Fabric, native-driven animated events only reach the animated module through a deprecated back-channel that React Native special-cases for its own ScrollView and has marked for removal. Use a Reanimated worklet or accept a plain callback.
:::

`react-native-reanimated` is an optional peer. It is only required, and only imported, if you pass a worklet handler.

## `onPageScroll`: tracking the swipe

Reports the pager's position (`position` + `offset`, page index plus 0..1 towards the next) every frame while a handler is attached.

```tsx
import { useEvent, useSharedValue } from 'react-native-reanimated';

const progress = useSharedValue(-1); // -1 = the pager hasn't moved yet
const onPageScroll = useEvent<{ position: number; offset: number }>(
  event => {
    'worklet';
    progress.value = event.position + event.offset;
  },
  ['topPageScroll', 'onPageScroll'],
);

<CollapsibleTabView … onPageScroll={onPageScroll} renderTabBar={…} />
```

Your tab bar then interpolates a single indicator between measured tab positions from `progress`. The bundled [`TabBar`](/api/tab-bar) already does this: a plain-function `onPageScroll` of yours is chained with it, while a worklet takes the event over and the bundled indicator falls back to animating on settle.

## `onHeaderOffsetChange`: reacting to the collapse

`{ offset, collapsibleHeight, pull }` in dp. `offset / collapsibleHeight` is the 0..1 collapse progress. `pull` is the over-drag past the top on iOS (0 on Android, where the refresh layout owns it), for stretch effects.

```tsx
const progress = useSharedValue(0); // 0 open → 1 collapsed
const onHeaderOffsetChange = useEvent<{ offset: number; collapsibleHeight: number; pull: number }>(
  e => {
    'worklet';
    progress.value = e.offset / Math.max(1, e.collapsibleHeight);
  },
  ['topHeaderOffsetChange', 'onHeaderOffsetChange'],
);

<CollapsibleTabView onHeaderOffsetChange={onHeaderOffsetChange} renderHeader={() => <Header progress={progress} />} … />

// inside Header:
const avatarStyle = useAnimatedStyle(() => ({
  transform: [{ scale: interpolate(progress.value, [0, 1], [1, 0.55], Extrapolation.CLAMP) }],
}));
```

Emitted only on change, and once more when a handler arrives late, so a header mounted after the shell still gets the current value.

## `onScrollOffsetChange`: reading the list offset

`{ index, offset }`: the active list's own offset in dp from its content top. 0 means the header is open, `collapsibleHeight` means fully collapsed, larger means scrolled on past it, negative during an over-drag. Fires per frame while the list moves and once more whenever the active page changes, with that page's offset.

```tsx
const y = useSharedValue(0);
const onScrollOffsetChange = useEvent<{ index: number; offset: number }>(
  e => {
    'worklet';
    y.value = e.offset;
  },
  ['topScrollOffsetChange', 'onScrollOffsetChange'],
);
const pillStyle = useAnimatedStyle(() => ({
  opacity: interpolate(y.value, [400, 600], [0, 1], Extrapolation.CLAMP),
}));

<CollapsibleTabView onScrollOffsetChange={onScrollOffsetChange} … />
```

For parallax deeper in the page, a scroll-to-top pill, a reading-progress bar. There is no throttle to configure: native emits on every scroll callback and only skips frames where the value did not change.

## `onCollapsedChange`: not per frame

Fires once per crossing of `collapseThreshold`, in either direction. Use it to swap fixed chrome, such as revealing a title in your own top bar. It costs the JS thread exactly one render per direction change.
