---
title: React Native Collapsible Tabs Alternatives
description: How the approaches to a collapsible header with tabs in React Native differ, JS and Reanimated implementations versus a native shell, and when each makes sense.
---

# React Native Collapsible Tabs Alternatives

There are three ways to build a collapsing header over a tab pager in React Native, and they differ in one place: **what moves the header**. This page explains the trade-off so you can pick the right one, whether or not it is this library.

## The three approaches

| | Header synchronisation | JS in the scroll path | Reads the scroll position | Works on |
| --- | --- | --- | --- | --- |
| **JS-driven** (`Animated`, `onScroll`) | Animation fed by the scroll *event* | Every frame | Yes, in JS | Paper and Fabric |
| **Reanimated-driven** (`useAnimatedScrollHandler`) | Animation fed by the scroll event, on the UI thread | No, but the event still has to arrive | Yes, in a worklet | Paper and Fabric |
| **Native shell** (this library) | The same native callback that moved the list | None | Through opt-in per-frame events | Fabric only |

### JS-driven

The list is a native scroll view; its `onScroll` event reaches JS, and an `Animated.event` or a state update translates the header. Simple and dependency-free, but the header is at least one frame behind the list by construction, and any JS work (rendering rows, a network response) delays it further. On Android the event itself is throttled. You see it as a gap opening under the tab bar on a fast fling.

### Reanimated-driven

The most common approach today, and what [react-native-collapsible-tab-view](https://github.com/PedroBern/react-native-collapsible-tab-view) and most hand-rolled screens use. The scroll handler runs as a worklet on the UI thread, so a busy JS thread no longer delays the header, and the result is much smoother than the JS-driven version. The remaining gap is structural: the scroll view has already moved its content by the time the event exists, so the header's translation is applied one frame after the content moved. On a fast fling, on a 60 Hz Android device, or when the UI thread is contended, that frame is visible. Reanimated also becomes a hard dependency of the screen, and cross-tab scroll syncing has to be reimplemented in worklets.

### Native shell

The header, tab bar and pages are still ordinary React components, but a native view owns the geometry: a paging `UIScrollView` on iOS, `ViewPager2` on Android, with the header and tab bar drawn above it. The active list's native scroll callback (`UIScrollViewDelegate` / `View.OnScrollChangeListener`) writes the header's position **before** the frame that shows the new content offset. There is no second update path, so nothing can fall behind, and the JS thread does no per-frame work at all. The costs: it needs the New Architecture, it cannot run on web or in Expo Go, and it has to re-implement in native code the things a JS library gets for free from React (page alignment on tab switch, short-tab handling, gesture arbitration on the header). See [How it works](/guide/how-it-works).

## When each makes sense

**Use a JS or Reanimated implementation when:**

- you need Paper (the old architecture), web, or Expo Go;
- you already have Reanimated in the screen and want the header animation to live next to the rest of your animations;
- your tabs are light and the JS thread is idle while scrolling, so the one-frame lag never shows;
- you need to read the scroll position synchronously in JS.

**Use a native shell when:**

- the screen is a profile or feed where lists are heavy and the JS thread is busy while scrolling;
- you are on Fabric already (the default since React Native 0.76);
- you have seen the gap under the tab bar and want it gone rather than reduced;
- you want Reanimated to stay optional.

## What this library does not do that others do

This is the honest part of the comparison. Compared with a mature Reanimated-based library, this one does not offer:

- a synchronous scroll position you can read from JS (positions arrive as [per-frame events](/guide/events) meant for worklets);
- built-in save and restore of scroll positions across remounts;
- web support;
- a custom native-driven refresh indicator on Android (the platform's own `SwipeRefreshLayout` is used).

The full list is on [Limitations & compatibility](/guide/limitations).

## Measuring the difference

Rather than assert the frame-lag argument, the [benchmarks](/benchmarks) page records how to measure it: a 500-row list, the JS thread deliberately kept 60 % busy, a scripted fling, and `dumpsys gfxinfo` frame statistics on a mid-range 120 Hz Android phone. The same page lists what has not been measured yet, including a side-by-side column against a Reanimated implementation on identical content, which is the comparison that directly tests the claim. Run the script on your own device before trusting either number.

## See also

- [How it works](/guide/how-it-works)
- [Getting started](/guide/getting-started)
- [Limitations & compatibility](/guide/limitations)
