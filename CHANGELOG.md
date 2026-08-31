# Changelog

## 0.2.0 — 2026-08-31

- New: `collapseMode?: 'classic' | 'direction'` (default `'classic'`).
  `'direction'` makes the header offset follow the scroll delta — any upward
  scroll reveals the header, any downward scroll hides it (home-feed feel),
  pinned open at the very top. Tab switches keep the header where it is and
  only concede when the incoming page cannot hold the current offset.
- Fix (Android): a horizontal list inside the header (date pickers, chip
  rows) could not be swiped — the header's horizontal-drag swallow now
  hit-tests for a horizontally scrollable view under the finger and leaves
  the gesture to it.

## 0.1.1 — 2026-08-29

- Fix: a swipe or drag that ended over a Pressable fired the press. The
  shell now cancels React's in-flight touch whenever it takes over the
  gesture — page-list scroll start, pager (tab) drag start, and header/tab
  strip drags — on iOS (`RCTSurfaceTouchHandler`) and Android
  (`NativeGestureUtil.notifyNativeGestureStarted`).
- Fix: horizontal drags on the header are now claimed (still inert) so the
  button under the finger doesn't fire on release.
- Fix (iOS): on a fresh launch the header didn't follow a plain list scroll
  until the header was touched once — the active page's scroll view is now
  discovered eagerly (with a short retry for lazily mounted lists).

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
