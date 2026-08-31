# Changelog

## Unreleased

- Fix (Android): pressing a tab while the header was collapsed sprang the
  header back open; swiping to the same tab did not. ViewPager2 dispatches
  `onPageSelected` at the *start* of a programmatic scroll, so the incoming
  page became active before anything had aligned it, and the header was then
  reconciled against a page still at its own scroll position. The incoming
  page is now aligned to the current header offset before it becomes active,
  so a pressed tab opens exactly as collapsed as the one you left.
- Fix (Android): `allowFullCollapse` gave a page its extra range as bottom
  padding on the ScrollView, which `getMaxScrollY()` honours — but not the
  check that decides whether a drag may *start*. `ScrollView.onInterceptTouchEvent`
  bails on `scrollY == 0 && !canScrollVertically(1)`, and that measures the
  content child's bottom against the viewport, where bottom padding does not
  count. A short tab was therefore untouchable until something scrolled it
  programmatically, and locked again the moment it returned to the top. The
  range is now added to the content view's height instead, which every path
  agrees on. (Fabric also re-applies a view's own padding on layout, so the
  padding was being wiped from under us as well.)
- Fix (iOS): with `allowFullCollapse`, dragging the blank area below a short
  tab's items did nothing. `RCTScrollViewComponentView` hit-tests only the
  subviews of its content container and returns its own wrapper for anything
  else — and that wrapper is the scroll view's parent, so such a touch never
  reaches the scroll view's pan recogniser. (Normally invisible: a list that
  short has nothing to scroll.) Those touches are now handed to the scroll
  view itself.
- Fix: a page's scroll being clamped by a layout pass is no longer mistaken
  for the user scrolling. When a tab's content mounts, Fabric re-lays it out
  at its natural height and `ReactScrollView.onLayout` re-issues a `scrollTo`
  that clamps against it — the header followed that to 0 and sprang open on
  the first visit to a tab. A scroll the page could not currently hold is now
  treated as a clamp: the page is re-extended and the offset restored.
- Fix: `allowFullCollapse` under-provisioned every page whose content was
  shorter than the viewport. The page's natural scroll range was clamped at
  zero before the shortfall was subtracted, so a page needing
  `headerHeight + |shortfall|` got only `headerHeight`. A tab that nearly
  filled the screen stopped just short of a full collapse, and a tab with one
  or two rows could not scroll at all — while a fully empty tab happened to
  work, because a fixed-height empty state puts its range near zero, where the
  old arithmetic was accidentally correct.
- Fix: with `allowFullCollapse`, a page was aligned to the header offset
  *before* it had been given its extra scroll range, so the alignment clamped
  to whatever range the page happened to have. A short tab then kept the last
  slice of the header on screen, and the give-up eased the header open a beat
  later. Pages now get their range before anything scrolls them.
- Fix: with `allowFullCollapse`, switching to a tab that had never been opened
  sprang the header open — the page was still mounting when the 400ms give-up
  fired, and an unmounted page reads as "too short to hold the offset". A page
  that has not caught up is now treated as still mounting: Android holds the
  header and aligns the page as soon as its content lands, and iOS retries the
  alignment before conceding.
- Fix (iOS): switching tabs briefly showed the incoming page's content one
  header too low before it snapped into place — a visible flicker, on swipe
  most of all, because a lazy page mounts while it is already sliding into
  view and paints before anything can align it. A page that still owes a sync
  is by definition not where the header says it is, so it stays hidden from
  the moment the sync is owed until it lands (or is conceded). Such a page is
  lazy-mounted and blank at that point anyway, so nothing is lost.
- Fix (iOS): switching to a tab whose list had not mounted left the header
  collapsed over a page still at its top — a gap the height of the header
  under the tab bar, with the page scrolling independently of it. A sync left
  pending for a page with no scroll view scheduled no retry at all (the
  contentSize observer that would have retried is only registered once the
  scroll view resolves), so nothing ever completed it. Such a sync is now
  always armed.

## 0.3.0 — 2026-08-31

- New: `allowFullCollapse?: boolean` (default `false`). Tabs whose content is
  too short to scroll — an empty state, a single row — can now collapse the
  header anyway. Native hands such a page exactly the scroll range it lacks
  (bottom `contentInset` on iOS, bottom padding on Android, which
  `ReactScrollView.getMaxScrollY()` counts), so the header collapses on every
  tab alike instead of popping back open when you switch to a short one.
  Pages with enough content are untouched, the slack is re-measured whenever
  the content, the viewport or the header height changes, and nothing moves
  until the user scrolls.

## 0.2.1 — 2026-08-31

- Fix: pull-to-refresh no longer arms when no `onRefresh` handler is
  provided (`refreshEnabled` is derived from it). Previously the spinner
  started on pull and nothing could ever clear it.
- Fix: when the header (or tab bar) re-measures after first render — data
  arriving, images/fonts settling — the collapse offset is re-derived from
  the active list's real scroll position instead of merely clamped.
  Previously the pages re-padded to the new height while the bands kept a
  stale offset, showing a phantom gap under the tab bar until the next
  scroll.

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
