# Changelog

## 0.1.0 — 2026-08-29

Initial release.

- Native collapsible-tabs shell for React Native (Fabric / New Architecture).
- iOS (UIKit paging scroll view) and Android (ViewPager2) implementations;
  header, tab bar and pages stay React components, re-parented natively.
- Header and list translate from the same native scroll callback — no
  frame lag between them.
- `CollapsibleTabView` (tab-view-like API), `CollapsibleTabsShell`,
  `createTabList` (+ `TabScrollView`, `TabFlatList`), `TabBar`,
  `useCollapsibleTabs`.
- Drag the header to scroll; horizontal header swipes inert by design.
- Container-level pull-to-refresh; `onCollapsedChange` threshold event;
  lazy pages with offset sync.
