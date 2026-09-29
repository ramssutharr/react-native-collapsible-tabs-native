# `<TabBar>`

The default strip: labels with an underline that tracks the finger during a swipe. Scrolls when the tabs overflow. Used by `CollapsibleTabView` unless you pass `renderTabBar`; configure it through `tabBarProps`, or render it yourself from a custom `renderTabBar`.

```tsx
import { TabBar } from 'react-native-collapsible-tabs-native';

renderTabBar={({ routes, index, onIndexChange }) => (
  <View>
    <TabBar routes={routes} index={index} onIndexChange={onIndexChange} scrollEnabled={false} />
    <FilterRow />
  </View>
)}
```

| prop | type | notes |
| --- | --- | --- |
| `routes` | `Route[]` | `{ key, title }` |
| `index` | `number` | the active tab |
| `onIndexChange` | `(index) => void` | tab pressed |
| `onTabPress` | `(route, index) => void` | called before `onIndexChange`, also on the active tab |
| `activeColor` | `string` | default `#111111` |
| `inactiveColor` | `string` | default `#8A8A8E` |
| `indicatorColor` | `string` | default `#111111` |
| `backgroundColor` | `string` | default `#FFFFFF` |
| `style` / `tabStyle` / `labelStyle` | styles | the strip, each tab, each label |
| `scrollEnabled` | `boolean` | default `true`; pass `false` for equal-width tabs that fill the strip |
| `position` | `Animated.Value` | the pager's continuous position (`1.4` = 40 % of the way from tab 1 to tab 2) so the underline and label colour track the finger. `CollapsibleTabView` supplies it; from a custom `renderTabBar`, feed one from `onPageScroll`. Without it the strip eases to `index` on settle |

The label colour and underline width interpolate per tab from `position`, so during a swipe the outgoing underline shrinks as the incoming one grows, in step with the finger.
