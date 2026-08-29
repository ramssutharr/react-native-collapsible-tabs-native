# react-native-collapsible-tabs-native

Instagram / Twitter-style **collapsing header over a tab pager**, where the
collapse is owned by the platform (UIKit on iOS, a `ViewPager2` shell on
Android) — so the header and the list move in the **same frame**, always.

## Why another collapsible tabs library?

Every JS implementation of this pattern moves the list content from the
native scroll view but moves the header from an animation worklet fed by
that scroll's *event*. Two update paths → the header is at least one frame
behind the list, which shows as a gap opening between the tab bar and the
content on a fast fling. It is worst on Android, visible on iOS under JS
load, and no amount of worklet tuning fixes it.

Here the header is translated from the **same native scroll callback** that
moved the content, so the two cannot drift apart. Your header, tab bar and
tab pages stay ordinary React components — the shell only owns geometry
and gestures.

- ✅ Header + tab bar + list in perfect sync (native `OnScrollChangeListener`
  / `UIScrollViewDelegate`, zero JS in the scroll path)
- ✅ Drag the header to scroll the list (with native-feeling fling)
- ✅ Horizontal swipes between tabs; lazily-mounted tabs land at the right
  offset; tab-switch keeps the header where it was
- ✅ One container-level pull-to-refresh
- ✅ `onCollapsedChange` threshold event (swap a sticky title without
  per-frame JS)
- ✅ Any list works: `ScrollView`, `FlatList`, `SectionList`,
  [FlashList](https://github.com/Shopify/flash-list),
  [LegendList](https://github.com/LegendApp/legend-list)… via `createTabList`
- ✅ New Architecture (Fabric) only; React Native ≥ 0.76

## Install

```sh
yarn add react-native-collapsible-tabs-native
cd ios && pod install
```

Autolinked on both platforms. New Architecture must be enabled (it is the
default since RN 0.76).

## Usage

```tsx
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

### The one rule

Tab bodies **must** pad their content by the header + tab-bar height (the
bands are overlaid on the pager, not stacked above it). Use `createTabList`
(or the bundled `TabScrollView` / `TabFlatList`) and it's done for you; or
read `useCollapsibleTabs().contentPaddingTop` yourself.

## API

### `<CollapsibleTabView>`

| prop | type | notes |
| --- | --- | --- |
| `navigationState` | `{ index, routes }` | `react-native-tab-view` shape |
| `renderScene` | `({ route }) => ReactNode` | one page per route; mounted lazily on first visit |
| `onIndexChange` | `(index) => void` | fired on swipe / tab press |
| `renderHeader` | `() => ReactNode` | the collapsing header |
| `renderTabBar` | `({ routes, index, onIndexChange }) => ReactNode` | defaults to `TabBar` |
| `tabBarProps` | `TabBarProps` | colours/styles for the default `TabBar` |
| `refreshing` / `onRefresh` | | container-level pull-to-refresh |
| `collapseThreshold` / `onCollapsedChange` | | crossing-only event |
| `swipeEnabled` | `boolean` | default `true` |
| `lazy` | `boolean` | default `true` |

### `createTabList(List)`

Returns `List` with the shell padding applied. `TabScrollView` and
`TabFlatList` are provided; for third-party lists:

```ts
import { FlashList } from '@shopify/flash-list';
import { LegendList } from '@legendapp/list';

const TabFlashList = createTabList(FlashList);
const TabLegendList = createTabList(LegendList);
```

Any component that renders a React Native `ScrollView` and forwards
`contentContainerStyle` works — the shell finds the scroll view natively.

### `<CollapsibleTabsShell>`

The lower-level primitive (`header`, `tabBar`, `pages[]`, `index`, …) if you
don't want the tab-view API.

### `useCollapsibleTabs()`

`{ isNativeShell, contentPaddingTop, activeIndex }`.

## Behaviour notes

- Horizontal swipes on the **header** are inert by design; swipe on the
  content or use the tab strip. Vertical drags on the header scroll the
  active page.
- A tab whose content is too short to hold the current collapse eases the
  header back to what it can hold (Twitter's behaviour) after it settles.
- Pull-to-refresh: iOS uses the scroll view's bounce (pull ≥ 70pt); Android
  uses a `SwipeRefreshLayout`. Keep `refreshing` true until your reload
  finishes.

## How it works

Fabric mounts the header, tab bar and pages as children of the native view;
the native side re-parents them by `nativeID` into slots: a header band and
a tab-bar band drawn above a horizontal pager (`UIScrollView` with paging /
`ViewPager2`). The active page's vertical scroll view is located and
observed natively; its offset, clamped to the header height, becomes the
bands' translation. Neighbouring pages are pre-aligned during a swipe, and
pages that mount late (lazy) are aligned as their content grows.

## Contributing

Issues and PRs welcome. The native code is small and heavily commented —
`ios/NativeCollapsibleTabsContent.swift` and
`android/src/main/java/com/collapsibletabs/ui/CollapsibleTabsHostView.kt`
are the two files that matter.

## License

MIT © Ram Suthar
