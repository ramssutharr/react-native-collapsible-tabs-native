import type React from 'react';
import type { CodegenTypes, HostComponent, ViewProps } from 'react-native';
import { codegenNativeCommands, codegenNativeComponent } from 'react-native';

/**
 * The native shell: an Instagram/Twitter-style "collapsing header over a tab
 * pager" container owned entirely by the platform.
 *
 * Why native: JS collapsible-tab implementations move the list content from
 * the native scroll view but the header from an animation worklet fed by
 * that scroll's *event*. Two update paths → the header is at least one frame
 * behind the list, which shows as a gap between the tab bar and the content
 * on a fast fling. Here the header is translated from the SAME native scroll
 * callback that moved the content, so the two cannot diverge.
 *
 * React authors everything visible. Three kinds of children are mounted by
 * Fabric and re-parented natively, identified by `nativeID`:
 *
 *   - `tabs-header`   → the collapsing header (scrolls away)
 *   - `tabs-tabbar`   → pins at the top once the header is gone
 *   - `tabs-page-<i>` → one page per tab, hosted in the horizontal pager
 *
 * Pages are ordinary React trees. Their vertical scroll view drives the
 * collapse; native finds it, observes it, and keeps neighbouring pages'
 * offsets consistent on tab switches. Pages MUST pad their content by
 * `headerHeight + tabBarHeight` at the top (`createTabList` does this).
 */

type PageSelectedEvent = Readonly<{
  index: CodegenTypes.Int32;
}>;

type CollapsedChangeEvent = Readonly<{
  collapsed: boolean;
}>;

type PageRevealedEvent = Readonly<{
  index: CodegenTypes.Int32;
}>;

type PageScrollEvent = Readonly<{
  /** Left-hand page of the two currently on screen. */
  position: CodegenTypes.Int32;
  /** 0..1 — how far the swipe has travelled from `position` to the next page. */
  offset: CodegenTypes.Float;
}>;

type HeaderOffsetChangeEvent = Readonly<{
  /** How far the bands have travelled, dp, 0..collapsibleHeight. */
  offset: CodegenTypes.Float;
  /** The full travel: header height minus `headerMinHeight`, plus the tab bar when unpinned. */
  collapsibleHeight: CodegenTypes.Float;
  /** Over-drag past the top, dp (iOS bounce / pull-to-refresh); 0 on Android. */
  pull: CodegenTypes.Float;
}>;

// Codegen requires an empty event payload to be spelled exactly this way.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type RefreshEvent = Readonly<{}>;

export interface NativeProps extends ViewProps {
  /** Measured height (dp) of the `tabs-header` child. */
  headerHeight: CodegenTypes.Int32;
  /** Measured height (dp) of the `tabs-tabbar` child. */
  tabBarHeight: CodegenTypes.Int32;
  /** Number of `tabs-page-<i>` children. */
  pageCount: CodegenTypes.Int32;
  /** Active page; changing it animates the pager (tab press / jump). */
  selectedIndex: CodegenTypes.Int32;
  /**
   * Header scroll offset (dp) past which `onCollapsedChange` flips to true —
   * lets a screen swap chrome without a per-frame JS event.
   */
  collapseThreshold?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  /**
   * 'classic': the header offset mirrors the active list's scroll position
   * (returns as the content nears the top). 'direction': the offset follows
   * the scroll DELTA — any upward scroll brings the header back, any
   * downward scroll hides it (home-feed feel).
   */
  collapseMode?: CodegenTypes.WithDefault<string, 'classic'>;
  swipeEnabled?: CodegenTypes.WithDefault<boolean, true>;
  /**
   * Whether the tab-bar band stays pinned at the top once the header is gone
   * (default true). Pass false and it collapses as part of the header — the
   * whole band, tabs included, scrolls away together — while pages still clear
   * it, which a tab strip rendered INSIDE the header cannot offer.
   */
  pinTabBar?: CodegenTypes.WithDefault<boolean, true>;
  /**
   * Let a page whose content is too short to scroll the header away collapse
   * it anyway. Native gives that page exactly the missing scroll range (a
   * bottom `contentInset` on iOS, bottom padding on Android — RN's own
   * `getMaxScrollY()` counts it), so an empty or one-item tab behaves like a
   * full one. Pages that can already hold the header get nothing.
   */
  allowFullCollapse?: CodegenTypes.WithDefault<boolean, true>;
  /**
   * Bottom strip of the header (dp) that stays on screen above the tab bar
   * instead of scrolling away — a search bar, a filter row. The bands then
   * travel `headerHeight - headerMinHeight`; the tab bar necessarily stays
   * visible too, so `pinTabBar={false}` has no effect while this is > 0.
   */
  headerMinHeight?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  /** Shell-level pull-to-refresh spinner (one for the whole container). */
  refreshing?: CodegenTypes.WithDefault<boolean, false>;
  /**
   * Whether the pull gesture arms at all. The JS side derives this from the
   * presence of `onRefresh` — without a handler nothing would ever clear the
   * spinner.
   */
  refreshEnabled?: CodegenTypes.WithDefault<boolean, true>;
  /**
   * Arms `onPageScroll`. That event is the one thing here that fires per
   * frame, so it is emitted only when something is listening — the JS side
   * derives this from the presence of a handler.
   */
  pageScrollEnabled?: CodegenTypes.WithDefault<boolean, false>;
  /** Arms `onHeaderOffsetChange` (per frame while the bands move); derived from the handler's presence. */
  headerOffsetEnabled?: CodegenTypes.WithDefault<boolean, false>;

  onPageSelected?: CodegenTypes.DirectEventHandler<PageSelectedEvent>;
  /**
   * A page became visible for the first time — fired as soon as ANY part of
   * it peeks in during a swipe, long before the swipe settles, so a lazy page
   * can mount while it is still sliding into view instead of after. Emitted
   * once per page (native dedupes), so this costs no per-frame JS work.
   */
  onPageRevealed?: CodegenTypes.DirectEventHandler<PageRevealedEvent>;
  /**
   * The pager's live swipe position, per frame, while `pageScrollEnabled`.
   * Intended for a Reanimated `useEvent` worklet so a tab indicator can track
   * the finger without touching the JS thread; a plain JS handler works but
   * costs a JS call per frame.
   */
  onPageScroll?: CodegenTypes.DirectEventHandler<PageScrollEvent>;
  onCollapsedChange?: CodegenTypes.DirectEventHandler<CollapsedChangeEvent>;
  /**
   * The bands' live offset, per frame while they move, while
   * `headerOffsetEnabled`. Intended for a Reanimated `useEvent` worklet so a
   * header can shrink its avatar, fade a title, parallax a cover — on the UI
   * thread, without touching JS. Emitted only when the value changes.
   */
  onHeaderOffsetChange?: CodegenTypes.DirectEventHandler<HeaderOffsetChangeEvent>;
  onRefresh?: CodegenTypes.DirectEventHandler<RefreshEvent>;
}

type ComponentType = HostComponent<NativeProps>;

/**
 * Imperative surface. Every command goes THROUGH the collapse engine rather
 * than around it: the header is derived from the active list's scroll
 * position, so moving the header alone would desync it from the content.
 * `scrollToTop` and `collapse` move the list and let the engine follow.
 */
interface NativeCommands {
  /** Scroll a page's list to its top. `index` -1 = the active page. */
  scrollToTop: (viewRef: React.ElementRef<ComponentType>, index: CodegenTypes.Int32, animated: boolean) => void;
  /**
   * Move the pager. Emits `onPageSelected` exactly like a swipe, so a
   * controlled `index` stays the source of truth.
   */
  setIndex: (viewRef: React.ElementRef<ComponentType>, index: CodegenTypes.Int32, animated: boolean) => void;
  /** Scroll the active list until the bands are fully collapsed. */
  collapse: (viewRef: React.ElementRef<ComponentType>, animated: boolean) => void;
  /**
   * Bring the bands back. Classic mode: scrolls the active list to its top
   * (the header mirrors it). Direction mode: animates the header alone,
   * which that mode allows.
   */
  expand: (viewRef: React.ElementRef<ComponentType>, animated: boolean) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['scrollToTop', 'setIndex', 'collapse', 'expand'],
});

export default codegenNativeComponent<NativeProps>('NativeCollapsibleTabs') as ComponentType;
