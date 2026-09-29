---
title: Usage
description: Build a collapsible header with tabs in React Native, the one padding rule, controlled index, collapse modes, pinning and pull-to-refresh.
---

# Usage

`CollapsibleTabView` has a `react-native-tab-view`-like API: `navigationState`, `renderScene`, `onIndexChange`, plus `renderHeader` for the collapsing header.

```tsx
import { useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import {
  CollapsibleTabView,
  createTabList,
  TabScrollView,
} from 'react-native-collapsible-tabs-native';

const TabFlashList = createTabList(FlashList);

const routes = [
  { key: 'posts', title: 'Posts' },
  { key: 'about', title: 'About' },
];

function Profile() {
  const [index, setIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <TopBar title={collapsed ? user.name : undefined} />
      <CollapsibleTabView
        navigationState={{ index, routes }}
        onIndexChange={setIndex}
        renderHeader={() => <ProfileHeader user={user} />}
        renderScene={({ route }) =>
          route.key === 'posts' ? (
            <TabFlashList data={posts} renderItem={renderPost} numColumns={3} />
          ) : (
            <TabScrollView>
              <About user={user} />
            </TabScrollView>
          )
        }
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await reload();
          setRefreshing(false);
        }}
        collapseThreshold={120}
        onCollapsedChange={setCollapsed}
        tabBarProps={{ activeColor: '#fff', inactiveColor: '#888', indicatorColor: '#BAFF11' }}
      />
    </>
  );
}
```

## The one rule

Tab bodies **must** pad their content by the header + tab-bar height. The bands are overlaid on the pager, not stacked above it. [`createTabList`](/api/create-tab-list) (and the bundled `TabScrollView` / `TabFlatList`) do this for you; or read `useCollapsibleTabs().contentPaddingTop` and apply it yourself.

## Controlled index

`index` is yours. A tab press or a settled swipe calls `onIndexChange`; set state and the pager follows. The pager settling on the page you already selected is *not* reported again, so "tap the active tab again" is unambiguous:

```tsx
const onIndexChange = (next: number) => {
  if (next === index) {
    tabs.current?.scrollToTop(); // active tab tapped again
  }
  setIndex(next);
};
```

## Collapse modes

- `collapseMode="classic"` (default): the header offset mirrors the active list's scroll position. It returns as the content nears the top, and it can only be fully open when the list is at its top.
- `collapseMode="direction"`: the offset follows the scroll *delta*. Any upward scroll brings the header back, any downward scroll hides it, wherever the list is. The home-feed feel. In this mode `expand()` reveals the header in place without moving the list, by design.

## Pinning parts of the header

- `pinTabBar={false}` lets the tab bar scroll away with the header. Keep the tabs in `renderTabBar` for this; do not move them into `renderHeader`, because pages clear the tab-bar band's height either way and an empty band gives the shell nowhere to put the tabs back.
- `headerMinHeight` keeps the header's *bottom* strip (a search bar, a filter row) pinned above the tab bar. The tab bar necessarily stays too, so `pinTabBar={false}` is ignored while this is greater than 0.
- Chrome that never moves (a nav bar) belongs *above* the shell. Swap its contents on `onCollapsedChange`.

## Pull-to-refresh

Pass `refreshing` and `onRefresh` and the container arms a pull from the top: the scroll view bounce on iOS, `SwipeRefreshLayout` on Android. Keep `refreshing` true until your reload finishes. `refreshThreshold`, `refreshIndicatorOffset`, `refreshTintColor`, `refreshBackgroundColor` and `refreshIndicatorSize` style it; `refreshIndicatorHidden` hides the native spinner so you can draw your own from the `pull` value of `onHeaderOffsetChange` on iOS.

Next: [Per-frame events](/guide/events) and the [API reference](/api/collapsible-tab-view).
