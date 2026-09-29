---
title: How Native Collapsible Tabs Work in React Native
description: The architecture of a native collapsible header in React Native, Fabric children re-parented into a UIScrollView or ViewPager2 shell whose native scroll callback moves the header in the same frame as the list.
---

# How native collapsible tabs work in React Native

```
React (your header, tab bar, pages)
        │  Fabric mounts them as children of one native view
        ▼
Native shell  ──  re-parents by nativeID into slots
        │
        ├── bands: header + tab bar in one RN ScrollView, drawn above the pager
        └── pager: paging UIScrollView (iOS) / ViewPager2 (Android)
                │
                ▼
        the active page's vertical scroll view, observed natively
                │  scrollViewDidScroll / OnScrollChangeListener
                ▼
        bands.contentOffset = clamp(list offset, 0, headerHeight)
        written in the same callback, before the frame is drawn
```

Fabric mounts your header, tab bar and pages as children of the native view. The native side re-parents them by `nativeID` into slots: the two bands (the header over the tab bar, inside one non-scrollable React Native `ScrollView`) drawn above a horizontal pager, which is a paging `UIScrollView` on iOS and a `ViewPager2` on Android.

The active page's vertical scroll view is located and observed natively. Its offset, clamped to the header height, becomes the bands' scroll offset, applied in the same callback that moved the content: `UIScrollViewDelegate.scrollViewDidScroll` on iOS, `View.OnScrollChangeListener` on Android. Both are invoked synchronously inside the content-offset change, so the band position is written before the frame that shows the new offset. Header and list cannot be a frame apart.

## Why the bands are a real scroll view

Driving a real RN scroll view rather than translating re-parented views is what keeps `Pressable`s in the bands working. `Pressable` decides "is the finger still on me?" from `measure()`, which on Fabric reads the shadow tree, and the shadow tree only learns native positions through ScrollView state, which React Native writes on every scroll. Moved any other way, a button in the bands drops every press that emits a touch-move: every hard press on a 3D Touch iPhone, or a slightly rolling finger, on both platforms.

## Neighbouring pages

Both pages that can be on screen during a swipe are aligned to the header offset before they are visible, so a swipe never reveals a neighbour whose content sits at the wrong height. A page that mounts late (lazy tabs) or whose content is still growing is hidden until it can hold the offset, then revealed; if it never can, the header eases to what that page can hold.

A tab page mounts the moment any sliver of it peeks in during a swipe, not when the swipe settles, so it is aligned while it is still sliding into view.

## Short pages

A page shorter than the viewport plus the header has nothing to scroll, so the header could not be pushed away on that tab. `allowFullCollapse` gives such a page exactly the range it is missing: a bottom `contentInset` on iOS, extra content height on Android, both of which the platform's own scrolling and clamping honour. Pages that already have the range get nothing.

## Gestures

Vertical drags on the bands scroll the active page: a display-link-driven fling on iOS, native event forwarding on Android. A horizontal list inside a band keeps its sideways gesture, decided once per gesture from the drag's translation. When the shell takes over a gesture it cancels React's in-flight touch, so buttons under the finger don't fire, while a deliberate tap still does.

## The code

The native code is small and commented. Two files matter:

- [`ios/NativeCollapsibleTabsContent.swift`](https://github.com/ramssutharr/react-native-collapsible-tabs-native/blob/main/ios/NativeCollapsibleTabsContent.swift)
- [`android/src/main/java/com/collapsibletabs/ui/CollapsibleTabsHostView.kt`](https://github.com/ramssutharr/react-native-collapsible-tabs-native/blob/main/android/src/main/java/com/collapsibletabs/ui/CollapsibleTabsHostView.kt)

Everything RN-specific on iOS (finding a page's `RCTScrollViewComponentView`, registering as its scroll listener) lives in the Objective-C++ bridge, so the Swift file stays plain UIKit.

## See also

- [Benchmarks](/benchmarks): the claim above, measured
- [Alternatives](/guide/alternatives): how JS and Reanimated implementations differ
- [Limitations & compatibility](/guide/limitations)
- [`CollapsibleTabView` API](/api/collapsible-tab-view)
