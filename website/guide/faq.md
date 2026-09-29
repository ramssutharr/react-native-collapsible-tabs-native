# FAQ

## Is this a drop-in replacement for react-native-collapsible-tab-view or react-native-tab-view?

No. The `navigationState` / `renderScene` shape is intentionally similar so migration is mechanical, but the props are not identical, and there is no synchronous `scrollY` to read. You can drive positions through the [`ref`](/api/ref) and react to them through the [per-frame events](/guide/events).

## Does it work with react-native-screens / React Navigation?

Yes. It is a regular view; render it inside any screen.

## Can I pin something inside the header?

Two built-in ways: `headerMinHeight` keeps the header's *bottom* strip (a search bar, a filter row) pinned above the tab bar, and `pinTabBar={false}` lets the tabs scroll away with the header. Chrome that never moves (a nav bar) belongs *above* the shell; swap its contents on `onCollapsedChange`. Don't render your tabs inside `renderHeader`: pages clear the tab-bar band's height either way, and an empty band gives the shell nowhere to put the tabs back without landing on content.

## A filter bar pinned under the tabs on one tab only?

See [Recipes](/guide/recipes#a-filter-bar-pinned-under-the-tab-bar-on-one-tab): put it in the tab-bar band, or overlay it in the page and translate it by the live header offset.

## Sticky section headers inside a tab (dates, months, groups)?

That's the list's job, and it works under the bands. With FlashList v2, pass `stickyHeaderIndices` and <code v-pre>stickyHeaderConfig={{ offset: contentPaddingTop }}</code> (from `useCollapsibleTabs()`), then render the `StickyHeader` target inside a Reanimated view translated by `-offset` from `onHeaderOffsetChange`. The pinned header rides up with the bands, so its pin line is always exactly the bands' bottom edge.

## Why can't I use `Animated.event` with `useNativeDriver` for the per-frame events?

On Fabric, native-driven animated events only reach the animated module through a deprecated back-channel that React Native special-cases for its own ScrollView and has marked for removal. Use a Reanimated `useEvent` worklet (UI thread, no per-frame JS) or a plain callback.

## `expand()` in `'direction'` mode brought the header back but the list didn't move. Bug?

Intentional. Direction mode's whole contract is that the header can be open over content scrolled deep (what a small upward drag does mid-list), so `expand()` reveals in place. Use `scrollToTop()` for "go to the top *and* reveal". In `'classic'` mode the two are the same thing, because there the header can't open without the list being at the top.

## An empty tab still collapses the header. Why?

`allowFullCollapse` (on by default) gives a page exactly the scroll range it lacks, so an empty state can be pushed up and the header collapses on every tab alike. A tab that can't scroll reads as a broken screen. Pass `false` for the Twitter-style alternative, where the header eases back to whatever a short tab can hold.

## A horizontal list in my header fights the header drag.

It shouldn't since 0.5.2: a sideways drag belongs to the list, a vertical one to the page, decided from the gesture's translation and committed once per gesture, on both header and tab-bar bands. If you still see both moving at once, that's a bug. Please [report it](https://github.com/ramssutharr/react-native-collapsible-tabs-native/issues) with the list component you use.

## Taps on the tab bar are dropped when I press hard.

Fixed in 0.8.0. The bands now live in a real RN scroll view that the shell drives, so Fabric's `measure()` (which `Pressable` uses to decide whether a moving finger is still on it) agrees with where the bands really are. Upgrade.

## Do the per-frame events need a throttle?

No. Native emits on every scroll callback and skips only the frames where the value did not change. You get the display's refresh rate while something moves and nothing while it is still.

## Jest can't parse the package.

It ships untranspiled TypeScript (Metro handles it). Add it to `transformIgnorePatterns`; see [Getting started](/guide/getting-started#jest).

## Which React Native versions?

≥ 0.80 with the New Architecture. The spec imports `codegenNativeComponent` and `CodegenTypes` from the `react-native` root, which exists since 0.80; the older deep imports are deprecated and warn on every launch in 0.83.
