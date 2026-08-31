import type { HostComponent, ViewProps } from 'react-native';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type {
  DirectEventHandler,
  Int32,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';

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
  index: Int32;
}>;

type CollapsedChangeEvent = Readonly<{
  collapsed: boolean;
}>;

type RefreshEvent = Readonly<{}>;

export interface NativeProps extends ViewProps {
  /** Measured height (dp) of the `tabs-header` child. */
  headerHeight: Int32;
  /** Measured height (dp) of the `tabs-tabbar` child. */
  tabBarHeight: Int32;
  /** Number of `tabs-page-<i>` children. */
  pageCount: Int32;
  /** Active page; changing it animates the pager (tab press / jump). */
  selectedIndex: Int32;
  /**
   * Header scroll offset (dp) past which `onCollapsedChange` flips to true —
   * lets a screen swap chrome without a per-frame JS event.
   */
  collapseThreshold?: WithDefault<Int32, 0>;
  /**
   * 'classic': the header offset mirrors the active list's scroll position
   * (returns as the content nears the top). 'direction': the offset follows
   * the scroll DELTA — any upward scroll brings the header back, any
   * downward scroll hides it (home-feed feel).
   */
  collapseMode?: WithDefault<string, 'classic'>;
  swipeEnabled?: WithDefault<boolean, true>;
  /** Shell-level pull-to-refresh spinner (one for the whole container). */
  refreshing?: WithDefault<boolean, false>;

  onPageSelected?: DirectEventHandler<PageSelectedEvent>;
  onCollapsedChange?: DirectEventHandler<CollapsedChangeEvent>;
  onRefresh?: DirectEventHandler<RefreshEvent>;
}

export default codegenNativeComponent<NativeProps>(
  'NativeCollapsibleTabs',
) as HostComponent<NativeProps>;
