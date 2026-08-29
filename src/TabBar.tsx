import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { Route } from './types';

export type TabBarProps<T extends Route = Route> = {
  routes: T[];
  index: number;
  onIndexChange: (index: number) => void;
  onTabPress?: (route: T, index: number) => void;
  activeColor?: string;
  inactiveColor?: string;
  indicatorColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  tabStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  /** Scroll the strip when the tabs overflow (default true). */
  scrollEnabled?: boolean;
};

/**
 * Default pinned tab strip: a horizontal strip of labels with an animated
 * underline. Pager motion is native, so there is nothing to animate here
 * beyond the active state. Pass `renderTabBar` to `CollapsibleTabView` for
 * anything custom.
 */
export function TabBar<T extends Route = Route>({
  routes,
  index,
  onIndexChange,
  onTabPress,
  activeColor = '#111111',
  inactiveColor = '#8A8A8E',
  indicatorColor = '#111111',
  backgroundColor = '#FFFFFF',
  style,
  tabStyle,
  labelStyle,
  scrollEnabled = true,
}: TabBarProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const itemX = useRef<number[]>([]);

  // Keep the active tab in view when the strip overflows.
  useEffect(() => {
    const x = itemX.current[index];
    if (x == null || !scrollEnabled) {
      return;
    }
    scrollRef.current?.scrollTo({ x: Math.max(0, x - 40), animated: true });
  }, [index, scrollEnabled]);

  const onPress = useCallback(
    (i: number) => {
      onTabPress?.(routes[i]!, i);
      onIndexChange(i);
    },
    [onIndexChange, onTabPress, routes],
  );

  return (
    <View style={[styles.root, { backgroundColor }, style]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        scrollEnabled={scrollEnabled}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.content, !scrollEnabled && styles.contentFill]}
      >
        {routes.map((route, i) => (
          <View
            key={route.key}
            style={!scrollEnabled && styles.tabFill}
            onLayout={(e: LayoutChangeEvent) => {
              itemX.current[i] = e.nativeEvent.layout.x;
            }}
          >
            <TabBarItem
              title={route.title}
              active={i === index}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              indicatorColor={indicatorColor}
              tabStyle={tabStyle}
              labelStyle={labelStyle}
              onPress={() => onPress(i)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

type ItemProps = {
  title: string;
  active: boolean;
  activeColor: string;
  inactiveColor: string;
  indicatorColor: string;
  tabStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  onPress: () => void;
};

function TabBarItem({
  title,
  active,
  activeColor,
  inactiveColor,
  indicatorColor,
  tabStyle,
  labelStyle,
  onPress,
}: ItemProps) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const [labelWidth, setLabelWidth] = React.useState(0);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 200,
      useNativeDriver: false, // width + colour interpolation
    }).start();
  }, [active, progress]);

  const color = progress.interpolate({ inputRange: [0, 1], outputRange: [inactiveColor, activeColor] });
  const indicatorWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(0, labelWidth - 30), labelWidth],
  });
  const indicatorOpacity = progress;

  return (
    <Pressable style={[styles.tab, tabStyle]} onPress={onPress}>
      <Animated.Text
        style={[styles.label, labelStyle, { color }]}
        numberOfLines={1}
        onLayout={(e) => setLabelWidth(e.nativeEvent.layout.width)}
      >
        {title}
      </Animated.Text>
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: indicatorColor, width: indicatorWidth, opacity: indicatorOpacity },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.35)',
  },
  content: {
    paddingHorizontal: 4,
  },
  contentFill: {
    flexGrow: 1,
  },
  tabFill: {
    flex: 1,
  },
  tab: {
    height: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
});
