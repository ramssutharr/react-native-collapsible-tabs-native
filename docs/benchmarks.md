# Benchmarks

The claim this library makes is narrow: the header, tab bar and list move in
the **same frame**, and a busy JS thread cannot pull them apart. This page
records how that is measured and what the numbers were. Every run is
reproducible from the example app; re-run it on your own device before
trusting it.

## What is measured

The example app has a **Bench** screen (`collapsibletabs://bench`, or the
"Bench" button in the top bar): a 500-row `TabFlatList` under the shell, two
tabs, and a switch that burns **10 ms of every 16 ms** on the JS thread with a
busy-wait — roughly what a heavy render or a JSON parse per frame costs. A
JS-driven header has to wait for that thread; this one does not.

`scripts/bench-android.sh` opens the screen with the load off, then on, warms
up, flings the list up and down a fixed number of times with `adb shell input
swipe`, and reads `dumpsys gfxinfo` for the frames the app rendered in between.
Median of 3 runs per configuration.

```sh
cd example/android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
cd .. && ANDROID_SERIAL=<serial> yarn bench:android        # [runs] [flings]
```

Release build, airplane mode, fixed brightness. `gfxinfo`'s "janky" counts
frames that missed the display's deadline — at 120 Hz that is 8.3 ms.

## Android · 2026-09-09

Samsung Galaxy M53 5G (SM-M536B, Dimensity 900, 8 GB) · Android 16 ·
1080×2400 @ 120 Hz · React Native 0.83.9 · library `main` at 0.7.x + refresh
props (unreleased 0.8.0) · 3 runs × 6 fling pairs.

| JS thread | frames | janky % | p50 ms | p90 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| idle | 3560 | 0.00 | 6 | 8 | 10 | 14 |
| busy (10 ms / 16 ms) | 3570 | 0.00 | 5 | 6 | 8 | 12 |

No janky frames in either configuration; the 99th percentile stays within two
120 Hz frames with the JS thread 60 % occupied. The "busy" row reading
slightly *better* than "idle" is run order, not load: idle ran first on a cold
process. (The script now runs a warm-up cycle per configuration; this table
predates that.)

## What this does not show yet

- **No JS-library column.** The interesting comparison is the same screen on
  a JS collapsible-tab-view under the same load. It is not in the example app
  yet because it drags in gesture-handler and a second header implementation;
  planned.
- **No sync measurement.** Frame times say the app kept up; they do not say
  the header stayed attached to the list. That needs a screen recording
  stepped frame by frame, measuring the gap under the tab bar. Planned as a
  frame strip in this document.
- **No iOS run.** Xcode Instruments' *Animation Hitches* template on a device
  in Release is the equivalent; not recorded yet.

## Gesture regression checklist

Run by hand on a device before each release. These are the shapes of every
gesture bug fixed since 0.4:

- [ ] vertical drag on the header scrolls the active page; fling continues
- [ ] the horizontal chip row inside the header still scrolls sideways
- [ ] a button under a finger that flung does **not** fire; a deliberate tap does
- [ ] the short tab collapses the header fully (`allowFullCollapse`)
- [ ] pull-to-refresh arms only with the header open and the list at its top,
      never on a momentum bounce
- [ ] swipe to the next tab while the current list is still decelerating
- [ ] switch tabs while a lazy page is still mounting: no gap under the tab bar
- [ ] open the app on a non-zero tab (`index` prop): the header follows that tab
- [ ] `direction` mode: no header reveal on a bottom bounce
