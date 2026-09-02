# Example app

Consumes the library **from the repo root** — no copy, no nested
`node_modules`: Metro resolves `react-native-collapsible-tabs-native` to
`../src` (watch mode included, so library edits hot-reload) and
`react-native.config.js` autolinks the native code from `..`.

```sh
cd example
yarn install

# iOS
cd ios && bundle install && bundle exec pod install && cd ..
yarn ios

# Android
yarn android
```

One screen exercises the whole surface: collapsing header with a horizontal
chip strip inside it (gesture arbitration), a long list, a short list
(`allowFullCollapse`), a ScrollView tab, pull-to-refresh, a
`collapseThreshold` chrome swap, and live toggles for `collapseMode`,
`pinTabBar` and `allowFullCollapse`.
