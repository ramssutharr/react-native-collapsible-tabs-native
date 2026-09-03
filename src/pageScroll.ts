import type { ComponentType } from 'react';

/**
 * A handler for the shell's per-frame `onPageScroll`.
 *
 * Two shapes are accepted:
 *
 *   - a Reanimated `useEvent` handler (an object, not a function) — the swipe
 *     position is then read on the UI thread and the JS thread does no
 *     per-frame work. This is the intended way to drive a tab indicator that
 *     tracks the finger.
 *   - a plain function — simple, but it runs on the JS thread once per frame
 *     of the swipe, which is exactly the cost this library exists to avoid.
 *     Fine for coarse work; not for animation.
 *
 * RN `Animated.event` with `useNativeDriver: true` is deliberately NOT
 * supported: on Fabric, native-driven animated events only reach the animated
 * module through a deprecated back-channel that React Native itself special
 * cases for ScrollView and has marked for removal.
 */
export type PageScrollHandler =
  | ((event: { nativeEvent: { position: number; offset: number } }) => void)
  | object;

/** Same two shapes, for the shell's per-frame `onHeaderOffsetChange`. */
export type HeaderOffsetHandler =
  | ((event: {
      nativeEvent: { offset: number; collapsibleHeight: number; pull: number };
    }) => void)
  | object;

type AnyHandler = PageScrollHandler | HeaderOffsetHandler | undefined;

/** Reanimated's `useEvent` returns an object carrying `workletEventHandler`. */
export const isWorkletHandler = (handler: AnyHandler): boolean =>
  handler != null && (typeof handler !== 'function' || 'workletEventHandler' in (handler as object));

let warnedMissingReanimated = false;

type AnyComponent = ComponentType<any>;

let cachedPlain: AnyComponent | null = null;
let cachedAnimated: AnyComponent | null | false = null;

/**
 * Reanimated worklet handlers are only delivered to components Reanimated
 * wrapped itself, so the host is wrapped lazily — and only if a worklet
 * handler is actually in use, so Reanimated remains an optional peer and is
 * never required (or even imported) by consumers that don't interpolate.
 */
export function resolveHost(host: AnyComponent, handlers: ReadonlyArray<AnyHandler>): AnyComponent {
  // STICKY: once this host has been wrapped, keep returning the wrapped
  // component even when no worklet handler is set any more. The wrapper is a
  // transparent superset of the plain host — but the element TYPE changing
  // when a handler comes or goes makes React unmount and remount the entire
  // native shell: every page, every scroll position, gone. (The one
  // unavoidable swap is the first time a worklet handler appears on a shell
  // that already rendered without one — set the handler from the first render
  // to avoid even that.)
  if (cachedPlain === host && cachedAnimated !== null && cachedAnimated !== false) {
    return cachedAnimated;
  }
  // Any worklet handler among the per-frame events needs the wrapped host; a
  // genuine plain function is a JS-thread callback needing no wrapper.
  const isWorklet = handlers.some(isWorkletHandler);
  if (!isWorklet) {
    return host;
  }
  if (cachedPlain === host && cachedAnimated === false) {
    return host;
  }
  cachedPlain = host;
  try {
    // Lazy on purpose, so Reanimated stays an optional peer.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const reanimated = require('react-native-reanimated');
    const create = reanimated?.default?.createAnimatedComponent ?? reanimated?.createAnimatedComponent;
    cachedAnimated = typeof create === 'function' ? (create(host) as AnyComponent) : false;
  } catch {
    // Reanimated could not be loaded — a worklet handler cannot work here,
    // but the shell must still render. Say so loudly in development: the
    // alternative is a raw handler object reaching the native prop, which
    // React rejects with an error that names the prop but not the cause.
    cachedAnimated = false;
    if (__DEV__ && !warnedMissingReanimated) {
      warnedMissingReanimated = true;
      console.warn(
        '[react-native-collapsible-tabs-native] A Reanimated `useEvent` handler was passed ' +
          '(onPageScroll / onHeaderOffsetChange) but `react-native-reanimated` could not be ' +
          'loaded, so the handler is ignored. Install it — or, in a monorepo/example, make sure ' +
          "Metro resolves it from the library's source (resolver.nodeModulesPaths).",
      );
    }
  }
  return cachedAnimated === false ? host : cachedAnimated;
}
