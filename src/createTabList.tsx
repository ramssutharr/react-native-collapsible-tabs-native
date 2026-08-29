import React, { forwardRef, useMemo, type ComponentType } from 'react';
import { FlatList, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useCollapsibleTabs } from './context';

/**
 * Wraps any scrollable list component so it works as a tab body under the
 * native shell: its `contentContainerStyle.paddingTop` is increased by the
 * header + tab-bar height the shell reports (the bands overlay the pager
 * rather than stacking above it), and `scrollEventThrottle` is set so the
 * list still reports per-frame to JS consumers that want it.
 *
 * The component must accept `contentContainerStyle` and `style` — every RN
 * list does (ScrollView, FlatList, SectionList, FlashList, LegendList…).
 *
 *   const TabFlashList = createTabList(FlashList);
 */
export function createTabList<P extends { contentContainerStyle?: unknown; style?: unknown }>(
  List: ComponentType<P>,
) {
  type Ref = React.ComponentRef<typeof List>;
  const Wrapped = forwardRef<Ref, P>((props, ref) => {
    const { contentPaddingTop } = useCollapsibleTabs();
    const { contentContainerStyle, style, ...rest } = props;

    const paddedContentStyle = useMemo(() => {
      const flat = (StyleSheet.flatten(contentContainerStyle as StyleProp<ViewStyle>) ??
        {}) as ViewStyle & { paddingTop?: number };
      const own = typeof flat.paddingTop === 'number' ? flat.paddingTop : 0;
      return { ...flat, paddingTop: own + contentPaddingTop };
    }, [contentContainerStyle, contentPaddingTop]);

    const ListAny = List as ComponentType<any>;
    return (
      <ListAny
        ref={ref}
        scrollEventThrottle={16}
        {...rest}
        style={[styles.fill, style as StyleProp<ViewStyle>]}
        contentContainerStyle={paddedContentStyle}
      />
    );
  });
  Wrapped.displayName = `TabList(${List.displayName ?? List.name ?? 'List'})`;
  return Wrapped as unknown as ComponentType<P & { ref?: React.Ref<Ref> }>;
}

export const TabScrollView = createTabList(ScrollView);
export const TabFlatList = createTabList(FlatList) as typeof FlatList;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
