import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import NativeCollapsibleTabs, { Commands } from './NativeCollapsibleTabsNativeComponent';
import { resolveHost, type PageScrollHandler } from './pageScroll';
import { CollapsibleTabsContext, type CollapsibleTabsContextValue } from './context';

export const SHELL_HEADER_ID = 'tabs-header';
export const SHELL_TABBAR_ID = 'tabs-tabbar';
export const shellPageId = (index: number) => `tabs-page-${index}`;

/**
 * Imperative handle exposed through `ref` on `CollapsibleTabView` and
 * `CollapsibleTabsShell`. Every method goes THROUGH the collapse engine: the
 * header is derived from the active list's scroll position, so these move
 * the list and let the header follow rather than moving the header alone.
 */
export type CollapsibleTabsRef = {
  /**
   * Scroll a page's list to its top (default: the active page). The header
   * comes back with the content. The "tap the active tab again" affordance.
   */
  scrollToTop: (options?: { index?: number; animated?: boolean }) => void;
  /**
   * Move the pager. Fires `onIndexChange` exactly like a swipe would, so a
   * controlled `index` stays the source of truth — this exists for the
   * `animated: false` jump, which a prop change cannot express.
   */
  setIndex: (index: number, options?: { animated?: boolean }) => void;
  /** Scroll the active list until the bands are fully collapsed. */
  collapse: (options?: { animated?: boolean }) => void;
  /**
   * Bring the bands back. Classic mode scrolls the active list to its top
   * (the header mirrors it); direction mode animates the header alone,
   * which that mode allows.
   */
  expand: (options?: { animated?: boolean }) => void;
};

export type CollapsibleTabsShellProps = {
  /** The collapsing header. */
  header: ReactNode;
  /** The pinned tab strip. */
  tabBar: ReactNode;
  /** One React tree per tab, in tab order. */
  pages: ReactNode[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Fires on threshold crossings only — see the native spec. */
  onCollapsedChange?: (collapsed: boolean) => void;
  collapseThreshold?: number;
  /** See CollapsibleTabView's `collapseMode`. Default 'classic'. */
  collapseMode?: 'classic' | 'direction';
  swipeEnabled?: boolean;
  /** See CollapsibleTabView's `pinTabBar`. Default true. */
  pinTabBar?: boolean;
  /** See CollapsibleTabView's `allowFullCollapse`. Default true. */
  allowFullCollapse?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** See CollapsibleTabView's `onPageScroll`. */
  onPageScroll?: PageScrollHandler;
  /**
   * Mount a page's content only once its tab has been visited (the wrapper
   * view is always mounted so the native pager has a stable child per tab).
   * Default true.
   */
  lazy?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Low-level React host for the native shell. Authors the header, tab bar and
 * pages as ordinary React children; the platform re-parents them by
 * `nativeID` and owns every scroll-driven pixel. Prefer `CollapsibleTabView`
 * unless you need this shape directly.
 */
export const CollapsibleTabsShell = forwardRef<CollapsibleTabsRef, CollapsibleTabsShellProps>(
  function CollapsibleTabsShell({
  header,
  tabBar,
  pages,
  index,
  onIndexChange,
  onCollapsedChange,
  collapseThreshold = 0,
  collapseMode = 'classic',
  swipeEnabled = true,
  pinTabBar = true,
  allowFullCollapse = true,
  refreshing = false,
  onRefresh,
  onPageScroll,
  lazy = true,
  style,
}, ref) {
  const [headerHeight, setHeaderHeight] = useState(0);
  const [tabBarHeight, setTabBarHeight] = useState(0);

  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setHeaderHeight((prev) => (prev === h ? prev : h));
  }, []);
  const onTabBarLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setTabBarHeight((prev) => (prev === h ? prev : h));
  }, []);

  const [visited, setVisited] = useState<ReadonlySet<number>>(() => new Set([index]));

  // Derived state, adjusted DURING render rather than in an effect: React
  // re-runs the component with the new value before committing, so a lazy
  // page can never paint one frame late — the effect version handed the
  // committed frame a stale set first. visited = previous ∪ {index}, pruned
  // to the current route count (native prunes its once-per-page reveal set
  // the same way; without the prune, stale indices past a shrink stay
  // "visited" forever and mount eagerly if the routes grow again).
  const nextVisited = new Set<number>();
  visited.forEach((i) => {
    if (i < pages.length) {
      nextVisited.add(i);
    }
  });
  if (index < pages.length) {
    nextVisited.add(index);
  }
  let visitedChanged = nextVisited.size !== visited.size;
  if (!visitedChanged) {
    nextVisited.forEach((i) => {
      if (!visited.has(i)) {
        visitedChanged = true;
      }
    });
  }
  if (visitedChanged) {
    setVisited(nextVisited);
  }

  /**
   * Mount-on-peek: native tells us the moment any sliver of a page is on
   * screen, so a lazy page mounts while it is still sliding in — and is
   * aligned to the header before it is meaningfully visible — instead of
   * mounting only once the swipe settles. Native emits this once per page,
   * so this costs no per-frame JS work.
   */
  const handlePageRevealed = useCallback((e: { nativeEvent: { index: number } }) => {
    const revealed = e.nativeEvent.index;
    setVisited((prev) => {
      if (prev.has(revealed)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(revealed);
      return next;
    });
  }, []);

  // The pager settling on the page JS already selected is an ECHO, not a
  // change: a tab press sets `index`, the pager animates there, and native
  // reports the settle. Forwarding that would make a plain tab switch look
  // exactly like the user tapping the active tab again — which consumers
  // use for "scroll to top". Only a genuinely different index (a swipe) is a
  // change worth reporting.
  const handlePageSelected = useCallback(
    (e: { nativeEvent: { index: number } }) => {
      if (e.nativeEvent.index !== index) {
        onIndexChange(e.nativeEvent.index);
      }
    },
    [index, onIndexChange],
  );

  const handleCollapsedChange = useCallback(
    (e: { nativeEvent: { collapsed: boolean } }) => {
      onCollapsedChange?.(e.nativeEvent.collapsed);
    },
    [onCollapsedChange],
  );

  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  const contextValue = useMemo<CollapsibleTabsContextValue>(
    () => ({
      isNativeShell: true,
      contentPaddingTop: headerHeight + tabBarHeight,
      activeIndex: index,
    }),
    [headerHeight, tabBarHeight, index],
  );

  // A Reanimated `useEvent` handler only reaches the view through a component
  // Reanimated itself created, so the host is swapped for a wrapped one when
  // (and only when) such a handler is passed. Reanimated stays an optional
  // peer: plain function handlers, and no handler at all, use the plain host.
  const Host = resolveHost(NativeCollapsibleTabs, onPageScroll);

  const hostRef = useRef<React.ElementRef<typeof NativeCollapsibleTabs>>(null);
  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: (options) => {
        const host = hostRef.current;
        if (host) {
          Commands.scrollToTop(host, options?.index ?? -1, options?.animated ?? true);
        }
      },
      setIndex: (nextIndex, options) => {
        const host = hostRef.current;
        if (host) {
          Commands.setIndex(host, nextIndex, options?.animated ?? true);
        }
      },
      collapse: (options) => {
        const host = hostRef.current;
        if (host) {
          Commands.collapse(host, options?.animated ?? true);
        }
      },
      expand: (options) => {
        const host = hostRef.current;
        if (host) {
          Commands.expand(host, options?.animated ?? true);
        }
      },
    }),
    [],
  );

  return (
    <CollapsibleTabsContext.Provider value={contextValue}>
      <Host
        ref={hostRef}
        style={[styles.host, style]}
        headerHeight={headerHeight}
        tabBarHeight={tabBarHeight}
        pageCount={pages.length}
        selectedIndex={index}
        collapseThreshold={Math.round(collapseThreshold)}
        collapseMode={collapseMode}
        swipeEnabled={swipeEnabled}
        pinTabBar={pinTabBar}
        allowFullCollapse={allowFullCollapse}
        refreshing={refreshing}
        refreshEnabled={onRefresh != null}
        pageScrollEnabled={onPageScroll != null}
        onPageScroll={onPageScroll}
        onPageSelected={handlePageSelected}
        onPageRevealed={handlePageRevealed}
        onCollapsedChange={handleCollapsedChange}
        onRefresh={handleRefresh}
      >
        <View
          nativeID={SHELL_HEADER_ID}
          collapsable={false}
          style={styles.band}
          onLayout={onHeaderLayout}
        >
          {header}
        </View>
        <View
          nativeID={SHELL_TABBAR_ID}
          collapsable={false}
          style={styles.band}
          onLayout={onTabBarLayout}
        >
          {tabBar}
        </View>
        {pages.map((page, i) => (
          <View key={i} nativeID={shellPageId(i)} collapsable={false} style={styles.page}>
            {!lazy || visited.has(i) ? page : null}
          </View>
        ))}
      </Host>
    </CollapsibleTabsContext.Provider>
  );
  },
);

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  // Bands and pages are all anchored at the host's origin: their real
  // placement is the native slot's, and Fabric's own frame for each child
  // must agree with (0,0) inside that slot.
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  page: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
});
