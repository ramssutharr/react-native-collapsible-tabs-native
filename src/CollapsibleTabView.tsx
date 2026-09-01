import React, { useMemo, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { CollapsibleTabsShell } from './CollapsibleTabsShell';
import type { PageScrollHandler } from './pageScroll';
import { TabBar, type TabBarProps } from './TabBar';
import type { Route } from './types';

export type CollapsibleTabViewProps<T extends Route = Route> = {
  navigationState: { index: number; routes: T[] };
  renderScene: (props: { route: T }) => ReactNode;
  onIndexChange: (index: number) => void;
  /** The collapsing header above the tabs. */
  renderHeader?: () => ReactNode;
  /**
   * The pinned tab strip. Receives the routes, the active index and the
   * index setter; defaults to this package's `TabBar`.
   */
  renderTabBar?: (props: {
    routes: T[];
    index: number;
    onIndexChange: (index: number) => void;
  }) => ReactNode;
  /** Styling for the default `TabBar` (ignored when `renderTabBar` is set). */
  tabBarProps?: Omit<TabBarProps<T>, 'routes' | 'index' | 'onIndexChange'>;
  /** Container-level pull-to-refresh: called on pull; keep `refreshing` true until done. */
  onRefresh?: () => void;
  refreshing?: boolean;
  swipeEnabled?: boolean;
  /** Mount tab content on first visit (default true). */
  lazy?: boolean;
  /**
   * Header scroll distance past which `onCollapsedChange(true)` fires — for
   * screens that swap chrome (e.g. a title in a sticky bar) once the header
   * is gone.
   */
  collapseThreshold?: number;
  onCollapsedChange?: (collapsed: boolean) => void;
  /**
   * 'classic' (default): the header offset mirrors the active list's scroll
   * position, so it comes back as the content nears the top.
   * 'direction': the offset follows the scroll delta — any upward scroll
   * reveals the header, any downward scroll hides it (home-feed feel).
   */
  collapseMode?: 'classic' | 'direction';
  /**
   * Let tabs whose content is too short scroll the header away anyway
   * (default TRUE). Without it a near-empty tab has nothing to scroll, so the
   * header stays open there, pops back when you switch to it, and drags in the
   * blank area below the content do nothing — which reads as a broken screen.
   * With it, native hands such a page exactly the scroll range it lacks, so an
   * empty state can be pushed up and the header collapses on every tab alike.
   * Tabs with enough content are untouched. Pass `false` for the old
   * behaviour, where the header eases back to whatever a short tab can hold.
   */
  /**
   * Whether the tab strip stays pinned at the top once the header is gone
   * (default true). Pass `false` and it collapses as part of the header — the
   * whole band, tabs included, scrolls away together.
   *
   * Prefer this over rendering tabs INSIDE `renderHeader`: pages clear the tab
   * bar's height either way, so the shell has somewhere to put the band back
   * without landing on your content — which matters in
   * `collapseMode="direction"`, where the bands return on any up-scroll.
   */
  pinTabBar?: boolean;
  allowFullCollapse?: boolean;
  /**
   * The pager's live swipe position, for a tab indicator that tracks the
   * finger. Pass a Reanimated `useEvent` handler and the position is read on
   * the UI thread — no per-frame JS. A plain function also works but runs on
   * the JS thread every frame. Emitted only while a handler is set.
   *
   * ```tsx
   * const progress = useSharedValue(0);
   * const onPageScroll = useEvent(e => {
   *   'worklet';
   *   progress.value = e.position + e.offset;
   * }, ['topPageScroll']);
   * ```
   */
  onPageScroll?: PageScrollHandler;
  style?: StyleProp<ViewStyle>;
};

/**
 * Collapsible tabs on the native shell, with a `react-native-tab-view`-like
 * API (`navigationState` / `renderScene` / `onIndexChange`).
 *
 * Tab bodies must use a list created with `createTabList` (or the bundled
 * `TabScrollView` / `TabFlatList`) so their content is padded under the
 * header and tab bar.
 */
export function CollapsibleTabView<T extends Route = Route>({
  navigationState,
  renderScene,
  onIndexChange,
  renderHeader,
  renderTabBar,
  tabBarProps,
  onRefresh,
  refreshing = false,
  swipeEnabled = true,
  pinTabBar = true,
  lazy = true,
  collapseThreshold = 0,
  onCollapsedChange,
  collapseMode = 'classic',
  allowFullCollapse = true,
  onPageScroll,
  style,
}: CollapsibleTabViewProps<T>) {
  const { index, routes } = navigationState;

  const pages = useMemo(() => routes.map((route) => renderScene({ route })), [renderScene, routes]);

  const tabBar = renderTabBar ? (
    renderTabBar({ routes, index, onIndexChange })
  ) : (
    <TabBar<T> {...tabBarProps} routes={routes} index={index} onIndexChange={onIndexChange} />
  );

  return (
    <CollapsibleTabsShell
      header={renderHeader?.() ?? null}
      tabBar={tabBar}
      pages={pages}
      index={index}
      onIndexChange={onIndexChange}
      onCollapsedChange={onCollapsedChange}
      collapseThreshold={collapseThreshold}
      collapseMode={collapseMode}
      swipeEnabled={swipeEnabled}
      pinTabBar={pinTabBar}
      allowFullCollapse={allowFullCollapse}
      onPageScroll={onPageScroll}
      refreshing={refreshing}
      onRefresh={onRefresh}
      lazy={lazy}
      style={style}
    />
  );
}
