import React, { useMemo, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { CollapsibleTabsShell } from './CollapsibleTabsShell';
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
  lazy = true,
  collapseThreshold = 0,
  onCollapsedChange,
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
      swipeEnabled={swipeEnabled}
      refreshing={refreshing}
      onRefresh={onRefresh}
      lazy={lazy}
      style={style}
    />
  );
}
