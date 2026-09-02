# Changelog

## Unreleased

- Fix (iOS): a vertical drag on the **tab strip** no longer slides it sideways.
  0.5.1 gave the header band a horizontal-list hit-test and suspended that list
  for the duration of a vertical drag; the tab-bar band never got the same
  treatment and fell through to a bare direction check. Since a tab strip is a
  horizontal scroll view in every tab bar worth the name — this package's own
  `TabBar` included — that was the default configuration, not an edge case: the
  band pan and the strip's own pan recognise simultaneously, so one drag
  scrolled the page AND dragged the tabs. Both bands now share one rule.
  (Android was never affected: intercepting the touch there sends
  `ACTION_CANCEL` to the descendant, which ends its gesture for free.)
- Fix (iOS): a suspended strip could be left permanently unscrollable. Only one
  strip was tracked, so a second suspension dropped the first, and a shell
  recycled mid-gesture never saw the pan end that would have restored it. A
  strip the consumer disabled with `scrollEnabled={false}` is now also left
  alone rather than being re-enabled on gesture end.
- Fix (iOS): a strip this shell had suspended was invisible to the hit-test
  that decides who owns the *next* gesture, so a drag arriving before the
  restore landed was handed to the band instead of the strip.
- Fix (iOS): the band-drag arbitration no longer decides from `velocity` — an
  instantaneous reading that one jitter frame flips, which is how a wiggled
  drag ended with the strip AND the page both moving. Direction is now read
  from the gesture's accumulated translation, and the band pan commits an
  intent ONCE per gesture: nothing moves before the commit, so an ambiguous
  first frame cannot walk the page around, and a majority-horizontal drag on
  the header is swallowed whole instead of driving the page with its vertical
  drift (worst over a strip whose content had not loaded yet — nothing to
  detect, nothing to scroll, every drift frame moved the page).
- Fix (iOS): a touch landing on a band now stops the page's momentum, exactly
  as a touch on the list itself would. Starting a new drag on a header strip
  before the previous fling had ended left that fling scrolling the page under
  the new gesture — which read as both axes moving at once.
- Fix (iOS): the one hole hit-testing cannot close. A touch between a strip's
  items is answered by RN's scroll component with its own WRAPPER — the scroll
  view is never in the hit view's ancestor chain — and a strip whose content
  has not loaded fails the contentSize check besides, so the band pan drove
  the page while the undetected strip's own pan scrolled it sideways. The
  shell now also listens to UIKit's simultaneous-recognition query: any scroll
  pan co-recognising with a band pan, on a scroll view living inside a band,
  IS a strip under this finger — captured there and suspended the moment the
  band pan commits to driving the page, with no hit-testing involved.
- Fix (iOS): a shell that mounted straight onto a non-zero tab (deep link,
  restored state) never activated it. Fabric applies props before layout
  metrics, so the selection arrived at zero width and could not scroll the
  pager; the first layout then pinned the right page into view while the
  engine still considered page 0 active — every scroll of the visible page
  was ignored and the header never moved on that tab until the user swiped
  away and back. The selection is now activated in the first layout with real
  width (the counterpart of Android's `pinPagerToSelection`, which is why
  Android never had this).
- Fix (iOS): a recycled shell now actually unsubscribes from the scroll views
  it listened to — emptying its own bookkeeping table never removed it as a
  delegate, so it kept hearing from views that had been recycled into other
  screens; the drag-start handler (the one callback with no ownership guard)
  then cancelled THAT screen's in-flight touches. The handler is also
  ownership-guarded now, which covers the same leak for a list unmounted
  while its shell lives on.
- Fix: the JS `visited` set is pruned when the routes shrink, matching the
  native reveal set. Stale indices past the new end stayed "visited" forever,
  so if the routes later grew again those pages mounted eagerly — `lazy`
  silently off for them.
- Fix: `resolveHost` is sticky — once the native host has been wrapped for a
  Reanimated `onPageScroll` handler, the wrapped component keeps being used
  even if the handler is later removed. Swapping the element type back
  remounted the entire native shell: every page, every scroll position.
- Fix (Android): detach now also clears the reveal-stuck fallback and
  recycles the retained touch event; reattach re-arms the fallback if any
  page still owes a sync, so a page can never stay invisible across a
  detach/attach cycle.

## 0.5.1 — 2026-09-01

- Fix (iOS): a horizontal list inside the header — a date picker, a chip row —
  no longer fights the header's own drag. The band pan used to begin for ANY
  touch on the header and recognises simultaneously with that list, so one
  drag scrolled the list AND drove the page. It now hit-tests for a
  horizontally scrollable view under the finger, as Android already did, and
  arbitrates by direction: sideways belongs to the list, vertical to the page,
  so the list is not a dead zone for scrolling either.
- Fix (iOS): a vertical drag starting on such a list no longer slides it
  sideways. Its scrolling is suspended for the duration of that gesture —
  `isDirectionalLockEnabled` is not enough, since it only arbitrates on a
  scroll view that can scroll both ways, and these strips are horizontal-only.

## 0.5.0 — 2026-09-01

- New: `pinTabBar` (default `true`). Pass `false` and the tab-bar band
  collapses as part of the header — the whole band, tabs included, scrolls
  away together. Prefer it over rendering a tab strip INSIDE `renderHeader`:
  pages clear the band's height either way, so the shell has somewhere to put
  it back without landing on content. With an empty band there is no
  clearance at all, which `collapseMode="direction"` exposes immediately
  (the bands return on any up-scroll).
- Fix: switching tabs in `direction` mode now aligns the incoming page to the
  header offset instead of keeping a deeper scroll. A page left scrolled past
  the offset shows its content BEHIND the bands — returning to a tab you had
  scrolled put its first card under the header.
- Fix (iOS): the extra bottom inset is now tracked per SCROLL VIEW rather than
  per page. Fabric recycles scroll views — one instance serves different pages
  over time — so a page-keyed record drifts from the inset actually on the
  view: it kept an inset nobody believed they had applied, leaving the page
  hundreds of points of range nobody accounted for and letting its content run
  up under the header. (Android already keyed this by the view, which is why
  it was unaffected.)
- Fix (iOS): read `adjustedContentInset`, not `contentInset`. UIKit clamps the
  content offset against the adjusted value, and RN's safe-area handling lives
  in the difference — so every scroll figure was out by the safe area, always
  in the direction of granting extra range.
- Fix (iOS): a page's list can be REPLACED without the page remounting (a
  grid/list toggle re-keys it). Nothing re-ran discovery, so the new scroll
  view was never registered: its scrolls never reached the collapse engine and
  it never got its range. It is now re-resolved on touch when the cached view
  has gone. The contentSize observer is also invalidated with it — kept alive,
  it blocked a replacement from ever being created.
- Fix (iOS): the end-of-list bounce no longer reveals the header. A rubber-band
  springback is a decreasing offset, indistinguishable in `direction` mode from
  the user scrolling up; the position that drives the header is now held inside
  the page's real range.
- **Breaking-ish:** `allowFullCollapse` now defaults to `true`. A tab that
  cannot scroll is a tab whose header cannot collapse, and whose blank area
  swallows every drag — which reads as a broken screen rather than a
  deliberate default. Pass `allowFullCollapse={false}` for the previous
  behaviour (the header eases back to whatever a short tab can hold).
- Fix (Android): with `allowFullCollapse` off, the slack pass still re-laid a
  page's content view out, and could pin it to a stale recorded height —
  costing that page its scroll range entirely. Worst on a screen whose list
  remounts (a grid/list toggle), where the replacement content view was
  measured once at discovery and never refreshed. It now returns immediately
  for any page it was never asked to extend, and treats the current height as
  natural whenever nothing of ours is applied.
- Fix (iOS): guard against re-entering the slack pass. It mutates
  `contentInset`, UIKit fires `scrollViewDidScroll` on inset changes, and the
  clamp heal there calls straight back into it — a cycle with nothing to stop
  it if a pass does not converge. The computed slack is also ceilinged at one
  header plus one viewport so a disagreement settles instead of compounding.

## 0.4.0 — 2026-09-01

- New: `onPageScroll` — the pager's live swipe position (`position` + a 0..1
  `offset`), so a custom tab bar can interpolate its indicator with the
  finger instead of snapping when the swipe settles. It is the one per-frame
  event here and is emitted only while a handler is attached, so nothing else
  pays for it. Intended for a Reanimated `useEvent` worklet (UI thread, no
  per-frame JS); Reanimated stays an OPTIONAL peer and is only required, or
  even imported, if you pass a worklet handler. RN `Animated.event` with
  `useNativeDriver` is documented as unsupported: on Fabric such events only
  reach the animated module through a deprecated back-channel React Native
  special-cases for its own ScrollView and has marked for removal.
- Fix: a page's list is locked to one axis per drag
  (`isDirectionalLockEnabled`). Every real horizontal swipe carries some
  vertical drift, and the list scrolled along with the page turn. It surfaced
  now because two earlier fixes opened the vertical axis where it used to be
  inert: `allowFullCollapse` gives short pages real range, and blank-area
  touches are routed to the scroll view.
- New: pages mount **on peek**. Native announces a page the instant any sliver
  of it is on screen (`onPageRevealed`, emitted once per page, so no per-frame
  JS), and the shell mounts it then — so a lazy tab mounts and is aligned to
  the header while it is still sliding in, instead of after the swipe settles.
  Previously a freshly opened tab painted at its own scroll position first and
  jumped into place a frame later.
- Fix: a page knocked out of sync by a layout pass is now corrected inside
  that same pass. When a tab's content re-lays out, Fabric resets the content
  view's height and `ReactScrollView.onLayout` re-issues a `scrollTo` that
  clamps against it; reacting to the resulting scroll event is one frame late,
  and one frame late is a flicker.
- Fix: a page that still owes a sync is hidden until it lands (Android as well
  as iOS). Such a page is not where the header says it is, and with
  mount-on-peek it mounts while already sliding into view, so it would
  otherwise paint a header too low before snapping into place. A page in that
  state is lazy-mounted and blank anyway. A stuck sync reveals the page
  regardless after a short fallback, so a tab can never stay invisible.
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
