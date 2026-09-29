---
title: Getting Started
description: Install react-native-collapsible-tabs-native, requirements (React Native 0.80+, Fabric), Jest setup and the example app.
---

# Getting started

## Requirements

- React Native **≥ 0.80** with the **New Architecture** enabled (the default since 0.76). Developed and tested on RN 0.83.
- iOS and Android. No web, no Expo Go. Works in Expo dev clients and prebuild.
- `react-native-reanimated` is an **optional** peer: it is only required (or even imported) if you pass a Reanimated `useEvent` worklet to one of the per-frame events.

## Install

```sh
yarn add react-native-collapsible-tabs-native
cd ios && pod install
```

Autolinked on both platforms. Nothing to register.

## Jest

The package ships untranspiled TypeScript, which Metro handles natively. **Jest does not.** If your tests import a screen that uses this package, allow it through `transformIgnorePatterns` in your Jest config:

```js
transformIgnorePatterns: [
  'node_modules/(?!(react-native|@react-native|react-native-collapsible-tabs-native)/)',
],
```

## Example app

The repository's [`example/`](https://github.com/ramssutharr/react-native-collapsible-tabs-native/tree/main/example) is a bare RN app wired straight to the repo's `src/` and native code (no copying):

```sh
cd example
yarn install

# iOS
cd ios && bundle install && bundle exec pod install && cd ..
yarn ios

# Android
yarn android
```

One screen exercises the whole surface: a collapsing header with a horizontal chip strip inside it, a long list, a short list, a ScrollView tab, pull-to-refresh, a `collapseThreshold` chrome swap, the `ref` buttons, a header that shrinks its avatar from `onHeaderOffsetChange`, a scroll-to-top pill from `onScrollOffsetChange`, and live toggles for `collapseMode`, `pinTabBar`, `allowFullCollapse` and `headerMinHeight`. It also hosts the [benchmark screen](/benchmarks).

Next: [Usage](/guide/usage).
