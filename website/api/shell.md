# `<CollapsibleTabsShell>` and `useCollapsibleTabs()`

## `<CollapsibleTabsShell>`

The lower-level primitive if you don't want the tab-view-shaped API. Authors the header, tab bar and pages as ordinary React children; the platform re-parents them by `nativeID` and owns every scroll-driven pixel. `CollapsibleTabView` is a thin layer over it.

```tsx
import { CollapsibleTabsShell } from 'react-native-collapsible-tabs-native';

<CollapsibleTabsShell
  ref={tabs}
  header={<ProfileHeader />}
  tabBar={<MyTabs index={index} onIndexChange={setIndex} />}
  pages={[<Posts key="posts" />, <About key="about" />]}
  index={index}
  onIndexChange={setIndex}
  collapseMode="classic"
  pinTabBar
  allowFullCollapse
  refreshing={refreshing}
  onRefresh={reload}
  onHeaderOffsetChange={onHeaderOffsetChange}
  lazy
/>
```

| prop | notes |
| --- | --- |
| `header` | the collapsing header node |
| `tabBar` | the pinned tab strip node |
| `pages` | one React tree per tab, in tab order |
| `index` / `onIndexChange` | controlled page |
| everything else | the same collapse, refresh and per-frame event props as [`CollapsibleTabView`](/api/collapsible-tab-view), and the same [`ref`](/api/ref) |

The exported ids `SHELL_BANDS_ID`, `SHELL_HEADER_ID`, `SHELL_TABBAR_ID` and `shellPageId(i)` name the `nativeID`s the shell mounts, for anyone building on the native contract directly. Since 0.8.0 the header and tab bar sit inside a `tabs-bands` scroll view that the shell drives; see [How it works](/guide/how-it-works#why-the-bands-are-a-real-scroll-view).

## `useCollapsibleTabs()`

```ts
const { isNativeShell, contentPaddingTop, activeIndex } = useCollapsibleTabs();
```

| field | notes |
| --- | --- |
| `isNativeShell` | `true` inside a shell; `false` when the hook is used outside one, so a shared list component can fall back to zero padding |
| `contentPaddingTop` | header + tab-bar height in dp; what a tab body must pad by |
| `activeIndex` | the controlled `index` |

For custom tab bodies that don't go through [`createTabList`](/api/create-tab-list), or for anything else in a page that needs to know where the bands end (a pinned overlay at `top: contentPaddingTop`, a FlashList `stickyHeaderConfig.offset`).
