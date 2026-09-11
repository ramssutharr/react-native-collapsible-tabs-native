import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useEvent,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import {
  CollapsibleTabView,
  TabFlatList,
  TabScrollView,
  type CollapsibleTabsRef,
} from 'react-native-collapsible-tabs-native';

/**
 * One screen that exercises every corner of the shell:
 *
 * - a measured header with a HORIZONTAL chip strip inside it (the gesture
 *   arbitration everyone gets wrong: sideways drags belong to the strip,
 *   vertical drags on it still scroll the page)
 * - a long list, a deliberately SHORT list (allowFullCollapse gives it the
 *   range it lacks), and a plain ScrollView tab
 * - container pull-to-refresh, collapse threshold chrome swap, and live
 *   toggles for collapseMode / pinTabBar / allowFullCollapse
 * - the imperative ref API (scrollToTop / collapse / expand / setIndex) on
 *   the buttons in the top bar, and "tap the active tab again → top"
 * - a header that reacts to its own collapse (avatar shrinks, bio fades)
 *   from onHeaderOffsetChange — a Reanimated worklet, zero JS per frame
 * - a "Top" pill that appears once the active list is scrolled deep, from
 *   onScrollOffsetChange — the same kind of worklet, reading the list offset
 * - headerMinHeight: the chip row stays as a pinned strip ("keep chips")
 */

/** Height of the chip row incl. its top padding — what `headerMinHeight`
 *  keeps on screen when "keep chips" is on. */
const CHIP_STRIP_HEIGHT = 56;

const ROUTES = [
  { key: 'posts', title: 'Posts' },
  { key: 'short', title: 'Short' },
  { key: 'about', title: 'About' },
];

const POSTS = Array.from({ length: 60 }, (_, i) => `Post #${i + 1}`);
const SHORT = ['Only', 'three', 'rows'];
const CHIPS = [
  'All',
  'Photos',
  'Videos',
  'Mentions',
  'Likes',
  'Saved',
  'Tagged',
  'Archive',
  'Drafts',
  'Collabs',
  'Events',
  'Music',
];

function Row({ label }: { label: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowThumb} />
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
  );
}

function Header({ progress }: { progress: SharedValue<number> }) {
  // progress = offset / collapsibleHeight, 0 open → 1 collapsed. Written on
  // the UI thread by the shell's onHeaderOffsetChange worklet; these styles
  // read it there too, so the header reacts without a JS frame.
  const avatarStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [1, 0.55],
          Extrapolation.CLAMP,
        ),
      },
    ],
    opacity: interpolate(
      progress.value,
      [0, 0.9],
      [1, 0.35],
      Extrapolation.CLAMP,
    ),
  }));
  const bioStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
  }));
  return (
    <View style={styles.header}>
      <Animated.View style={[styles.avatar, avatarStyle]} />
      <Text style={styles.name}>Collapsible Tabs</Text>
      <Animated.Text style={[styles.bio, bioStyle]}>
        Drag the header, fling the lists, swipe the tabs. The chip row below
        scrolls sideways; a vertical drag on it scrolls the page.
      </Animated.Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CHIPS.map(chip => (
          <View key={chip} style={styles.chip}>
            <Text style={styles.chipLabel}>{chip}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Benchmark screen — see scripts/bench-android.sh and docs/benchmarks.md.
//
// The claim under test is "the header stays in the same frame as the list
// while the JS thread is busy". So: a long, real-looking list under the
// shell, plus a switch that burns most of every frame on the JS thread. The
// bench script opens this screen through the `collapsibletabs://bench?load=1`
// deep link so a run needs no taps.
// ---------------------------------------------------------------------------

const BENCH_ROUTES = [
  { key: 'feed', title: 'Feed' },
  { key: 'more', title: 'More' },
];
const BENCH_ROWS = Array.from({ length: 500 }, (_, i) => i);
/** ms of busy-wait per 16 ms tick while "JS load" is on (~60% of a frame). */
const BENCH_BUSY_MS = 10;
const BENCH_COLOURS = ['#5b8def', '#e07a5f', '#3d9970', '#f2c14e', '#8e6bd6'];

function BenchRow({ index }: { index: number }) {
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.rowThumb,
          { backgroundColor: BENCH_COLOURS[index % BENCH_COLOURS.length] },
        ]}
      />
      <View style={styles.benchText}>
        <Text style={styles.rowLabel}>Item #{index + 1}</Text>
        <Text style={styles.benchSub} numberOfLines={1}>
          {index % 3 === 0
            ? 'Posted a moment near you'
            : index % 3 === 1
            ? 'Replied to your comment'
            : 'Shared a plan for the weekend'}
        </Text>
      </View>
      <Text style={styles.benchCount}>{(index * 37) % 1000}</Text>
    </View>
  );
}

function BenchScreen({
  load,
  onLoadChange,
  onExit,
}: {
  load: boolean;
  onLoadChange: (v: boolean) => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [beats, setBeats] = useState(0);

  // The JS load: a busy-wait that eats BENCH_BUSY_MS of every 16 ms tick, so
  // anything that needs the JS thread per frame (a JS-driven header) falls
  // behind. The heartbeat below is ordinary JS work that keeps running.
  useEffect(() => {
    if (!load) {
      return;
    }
    const id = setInterval(() => {
      const end = Date.now() + BENCH_BUSY_MS;
      while (Date.now() < end) {
        // spin
      }
    }, 16);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setBeats(b => b + 1), 500);
    return () => clearInterval(id);
  }, []);

  const navigationState = useMemo(
    () => ({ index, routes: BENCH_ROUTES }),
    [index],
  );
  const renderHeader = useCallback(
    () => (
      <View style={styles.benchHeader}>
        <View style={styles.avatar} />
        <Text style={styles.name}>Benchmark</Text>
        <Text style={styles.bio}>
          500 rows per tab. Toggle "JS load" to burn {BENCH_BUSY_MS} ms of every
          frame on the JS thread, then fling. The header must not detach.
        </Text>
      </View>
    ),
    [],
  );
  const renderScene = useCallback(
    () => (
      <TabFlatList
        data={BENCH_ROWS}
        keyExtractor={item => String(item)}
        renderItem={({ item }) => <BenchRow index={item} />}
        initialNumToRender={12}
        windowSize={7}
      />
    ),
    [],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>
          Bench · JS {load ? 'busy' : 'idle'} · ♥ {beats}
        </Text>
        <View style={styles.actions}>
          <Action
            label={load ? 'Load: on' : 'Load: off'}
            onPress={() => onLoadChange(!load)}
          />
          <Action label="Exit" onPress={onExit} />
        </View>
      </View>
      <CollapsibleTabView
        navigationState={navigationState}
        onIndexChange={setIndex}
        renderHeader={renderHeader}
        renderScene={renderScene}
        tabBarProps={{
          activeColor: '#111',
          inactiveColor: '#999',
          indicatorColor: '#5b8def',
          scrollEnabled: false,
        }}
      />
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggle} onPress={() => onChange(!value)}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </Pressable>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const tabs = useRef<CollapsibleTabsRef>(null);
  const [index, setIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [direction, setDirection] = useState(false);
  const [pinTabBar, setPinTabBar] = useState(true);
  const [allowFullCollapse, setAllowFullCollapse] = useState(true);
  const [keepChips, setKeepChips] = useState(false);
  const [bench, setBench] = useState(false);
  const [benchLoad, setBenchLoad] = useState(false);

  // `collapsibletabs://bench?load=1` opens the benchmark screen with the JS
  // load already on, so the bench script can drive a run without taps.
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url || !url.includes('bench')) {
        return;
      }
      setBench(true);
      setBenchLoad(/[?&]load=1/.test(url));
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', e => handle(e.url));
    return () => sub.remove();
  }, []);

  // The bands' collapse progress, straight from native, on the UI thread.
  const progress = useSharedValue(0);
  const onHeaderOffsetChange = useEvent<{
    offset: number;
    collapsibleHeight: number;
    pull: number;
  }>(
    event => {
      'worklet';
      progress.value = event.offset / Math.max(1, event.collapsibleHeight);
    },
    ['topHeaderOffsetChange', 'onHeaderOffsetChange'],
  );
  const renderHeader = useCallback(
    () => <Header progress={progress} />,
    [progress],
  );

  // The active list's own offset, straight from native on the UI thread: a
  // scroll-to-top pill that fades in once the list is scrolled well past the
  // header, without a single JS frame.
  const listOffset = useSharedValue(0);
  const onScrollOffsetChange = useEvent<{ index: number; offset: number }>(
    event => {
      'worklet';
      listOffset.value = event.offset;
    },
    ['topScrollOffsetChange', 'onScrollOffsetChange'],
  );
  const pillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      listOffset.value,
      [400, 600],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const navigationState = useMemo(() => ({ index, routes: ROUTES }), [index]);

  // Tapping the ACTIVE tab again scrolls it to the top — the affordance the
  // ref API exists for.
  const onIndexChange = useCallback(
    (next: number) => {
      if (next === index) {
        tabs.current?.scrollToTop();
      }
      setIndex(next);
    },
    [index],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const renderScene = useCallback(
    ({ route }: { route: (typeof ROUTES)[number] }) => {
      switch (route.key) {
        case 'posts':
          return (
            <TabFlatList
              data={POSTS}
              keyExtractor={item => item}
              renderItem={({ item }) => <Row label={item} />}
            />
          );
        case 'short':
          return (
            <TabFlatList
              data={SHORT}
              keyExtractor={item => item}
              renderItem={({ item }) => <Row label={item} />}
              ListFooterComponent={
                <Text style={styles.hint}>
                  Too short to scroll — yet the header still collapses
                  (allowFullCollapse). Toggle it off on the About tab to feel
                  the difference.
                </Text>
              }
            />
          );
        default:
          return (
            <TabScrollView>
              <Text style={styles.about}>
                Everything visible is a React component; every scroll-driven
                pixel is native. The header and the list move in the same frame
                because the band transform is written inside the same native
                scroll callback that moved the content.
              </Text>
            </TabScrollView>
          );
      }
    },
    [],
  );

  if (bench) {
    return (
      <BenchScreen
        load={benchLoad}
        onLoadChange={setBenchLoad}
        onExit={() => setBench(false)}
      />
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>
          {collapsed ? 'Collapsible Tabs' : 'Example App'}
        </Text>
        <View style={styles.actions}>
          <Action label="Top" onPress={() => tabs.current?.scrollToTop()} />
          <Action label="Collapse" onPress={() => tabs.current?.collapse()} />
          <Action label="Expand" onPress={() => tabs.current?.expand()} />
          <Action
            label="About ⚡︎"
            onPress={() => tabs.current?.setIndex(2, { animated: false })}
          />
        </View>
      </View>
      <CollapsibleTabView
        ref={tabs}
        navigationState={navigationState}
        onIndexChange={onIndexChange}
        renderHeader={renderHeader}
        renderScene={renderScene}
        refreshing={refreshing}
        onRefresh={onRefresh}
        refreshTintColor="#5b8def"
        refreshBackgroundColor="#eef1f6"
        refreshThreshold={80}
        collapseMode={direction ? 'direction' : 'classic'}
        pinTabBar={pinTabBar}
        allowFullCollapse={allowFullCollapse}
        headerMinHeight={keepChips ? CHIP_STRIP_HEIGHT : 0}
        onHeaderOffsetChange={onHeaderOffsetChange}
        onScrollOffsetChange={onScrollOffsetChange}
        collapseThreshold={80}
        onCollapsedChange={setCollapsed}
        tabBarProps={{
          activeColor: '#111',
          inactiveColor: '#999',
          indicatorColor: '#5b8def',
          scrollEnabled: false,
        }}
      />
      <Animated.View style={[styles.pill, pillStyle]} pointerEvents="box-none">
        <Pressable
          style={styles.pillButton}
          onPress={() => tabs.current?.scrollToTop()}
        >
          <Text style={styles.pillLabel}>↑ Top</Text>
        </Pressable>
      </Animated.View>
      <View style={styles.controls}>
        <Toggle
          label="direction mode"
          value={direction}
          onChange={setDirection}
        />
        <Toggle label="pin tab bar" value={pinTabBar} onChange={setPinTabBar} />
        <Toggle
          label="full collapse"
          value={allowFullCollapse}
          onChange={setAllowFullCollapse}
        />
        <Toggle label="keep chips" value={keepChips} onChange={setKeepChips} />
        <Action label="Bench" onPress={() => setBench(true)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    height: 44,
    marginTop: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topBarTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
  actions: { flexDirection: 'row', gap: 6 },
  action: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eef1f6',
  },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#334' },
  header: { backgroundColor: '#fff', paddingTop: 8 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginLeft: 16,
    backgroundColor: '#5b8def',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginLeft: 16,
    marginTop: 10,
  },
  bio: { fontSize: 14, color: '#555', marginHorizontal: 16, marginTop: 6 },
  // Chip row = the header's bottom strip; its box must match CHIP_STRIP_HEIGHT
  // (paddingTop 12 + chip 30 + paddingBottom 14 = 56) for "keep chips".
  chips: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 14, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#eef1f6',
  },
  chipLabel: { fontSize: 13, fontWeight: '500', color: '#334' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e2e2',
  },
  rowThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#dde3ee',
    marginRight: 12,
  },
  rowLabel: { fontSize: 15, color: '#222' },
  benchHeader: { backgroundColor: '#fff', paddingTop: 8, paddingBottom: 14 },
  benchText: { flex: 1 },
  benchSub: { fontSize: 13, color: '#777', marginTop: 2 },
  benchCount: { fontSize: 13, color: '#999', marginLeft: 12 },
  hint: { fontSize: 13, color: '#888', margin: 16, lineHeight: 19 },
  about: { fontSize: 15, color: '#333', margin: 16, lineHeight: 22 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 6,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
  },
  pill: {
    position: 'absolute',
    right: 16,
    bottom: 96,
  },
  pillButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#111',
  },
  pillLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  toggle: { alignItems: 'center', gap: 2 },
  toggleLabel: { fontSize: 11, color: '#666' },
});
