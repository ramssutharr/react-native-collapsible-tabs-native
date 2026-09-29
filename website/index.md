---
layout: home
title: Native Collapsible Tabs for React Native
description: Native collapsible tabs for React Native with a collapsing header, pinned tab bar, swipeable pages and FlashList support, driven by UIKit and ViewPager2 so the header and list move in the same frame. iOS and Android, Fabric.

hero:
  name: React Native Collapsible Tabs
  text: Native scrolling that moves the header and list in the same frame.
  tagline: Native collapsible tabs for React Native with a collapsing header, pinned tab bar, swipeable pages and FlashList support, for iOS and Android.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API
      link: /api/collapsible-tab-view
    - theme: alt
      text: GitHub
      link: https://github.com/ramssutharr/react-native-collapsible-tabs-native

features:
  - title: Frame-perfect by construction
    details: The header is translated inside the same native scroll callback that moved the list. There is no second update path to fall behind.
  - title: Ordinary React children
    details: Your header, tab bar and pages are plain components. Native owns only geometry and gestures. Any list that renders an RN ScrollView works as a page, FlashList and LegendList included.
  - title: Per-frame events for worklets
    details: Swipe position, band offset and list offset are opt-in events meant for Reanimated useEvent, read on the UI thread. Nothing per frame reaches the JS thread unless you ask for it.
  - title: The long tail handled
    details: Pages pre-aligned during swipes, mount-on-peek, short tabs that still collapse, container pull-to-refresh, an imperative ref, presses that survive a scroll.
  - title: Measured, not asserted
    details: 0 % janky frames on a mid-range 120 Hz Android phone with the JS thread 60 % busy. The method and the device are in the benchmarks.
  - title: Fabric only, MIT
    details: React Native 0.80 and up with the New Architecture. iOS and Android. In production on the Currently iOS app.
---

<div class="demo-row">
  <figure>
    <img src="/demo-ios.gif" alt="iOS demo: collapsing header, tab swipes, short-tab collapse, pull-to-refresh" />
    <figcaption>iOS · paging UIScrollView</figcaption>
  </figure>
  <figure>
    <img src="/demo-android.gif" alt="Android demo: the same shell on ViewPager2" />
    <figcaption>Android · ViewPager2</figcaption>
  </figure>
</div>

A collapsing header and pinned tab bar over a native pager. The collapse is driven by UIKit and ViewPager2, not by JavaScript or a worklet, so a busy JS thread cannot pull the header away from the content.

## Why this library uses a native implementation

In implementations where the list moves natively while the header is updated through a separate animation path, fed by the scroll *event*, the two updates can become visibly unsynchronised during fast flings, particularly under JS-thread load. It shows as a gap opening between the tab bar and the content, most often on Android and on iOS whenever the JS thread is busy.

This library removes the second update path instead of trying to keep up with it: the header is moved inside the same native scroll callback that moved the list, so there is nothing to fall behind. Read [how it works](/guide/how-it-works) for the mechanism, the [comparison with JS and Reanimated approaches](/guide/alternatives), the [FlashList guide](/guide/flashlist), the [benchmarks](/benchmarks), and [what it does not do](/guide/limitations) before choosing it.

```sh
yarn add react-native-collapsible-tabs-native
cd ios && pod install
```
