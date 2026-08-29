import { createContext, useContext } from 'react';

export type CollapsibleTabsContextValue = {
  /** True when rendered inside the native shell. */
  isNativeShell: boolean;
  /**
   * Tab bodies MUST pad their scroll content by this at the top: the header
   * and tab-bar bands are overlaid on the pager, not stacked above it, so
   * this is the only thing keeping the first row from starting under the
   * header. `createTabList` applies it for you.
   */
  contentPaddingTop: number;
  /** Index of the page the pager is settled on. */
  activeIndex: number;
};

export const CollapsibleTabsContext = createContext<CollapsibleTabsContextValue>({
  isNativeShell: false,
  contentPaddingTop: 0,
  activeIndex: 0,
});

export const useCollapsibleTabs = () => useContext(CollapsibleTabsContext);
