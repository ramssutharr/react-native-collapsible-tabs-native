#!/usr/bin/env bash
# Frame-timing benchmark for the example app's Bench screen on a connected
# Android device. Opens the screen through its deep link (JS load off, then
# on), flings the list up and down N times, and reads `dumpsys gfxinfo`.
#
#   ANDROID_SERIAL=<serial> scripts/bench-android.sh [runs] [flings]
#
# Prints a Markdown table: total frames, janky %, p50/p90/p95/p99 frame
# times, per configuration, median over `runs` (default 3) of `flings`
# (default 6) up/down fling pairs. Use a RELEASE build, airplane mode, fixed
# brightness. See docs/benchmarks.md.
set -euo pipefail

PKG="com.collapsibletabsexample"
RUNS="${1:-3}"
FLINGS="${2:-6}"
ADB="adb"
if [ -n "${ANDROID_SERIAL:-}" ]; then ADB="adb -s $ANDROID_SERIAL"; fi

if ! $ADB shell pm path "$PKG" >/dev/null 2>&1; then
  echo "$PKG is not installed on the device (build a release APK first)." >&2
  exit 1
fi

read -r W H < <($ADB shell wm size | sed -n 's/.*: \([0-9]*\)x\([0-9]*\).*/\1 \2/p' | head -1)
X=$((W / 2)); Y_LOW=$((H * 3 / 4)); Y_HIGH=$((H * 3 / 10))

open_bench() { # $1 = load 0|1
  $ADB shell am start -W -a android.intent.action.VIEW \
    -d "collapsibletabs://bench?load=$1" "$PKG" >/dev/null
  sleep 2.5
}

fling_cycle() {
  for _ in $(seq 1 "$FLINGS"); do
    $ADB shell input swipe "$X" "$Y_LOW" "$X" "$Y_HIGH" 60
    sleep 1.1
    $ADB shell input swipe "$X" "$Y_HIGH" "$X" "$Y_LOW" 60
    sleep 1.1
  done
}

# Echoes: total janky_pct p50 p90 p95 p99
measure() {
  $ADB shell dumpsys gfxinfo "$PKG" reset >/dev/null
  fling_cycle
  local out; out=$($ADB shell dumpsys gfxinfo "$PKG")
  local total janky p50 p90 p95 p99
  total=$(echo "$out" | sed -n 's/.*Total frames rendered: \([0-9]*\).*/\1/p' | head -1)
  janky=$(echo "$out" | sed -n 's/.*Janky frames: [0-9]* (\([0-9.]*\)%).*/\1/p' | head -1)
  p50=$(echo "$out" | sed -n 's/.*50th percentile: \([0-9]*\)ms.*/\1/p' | head -1)
  p90=$(echo "$out" | sed -n 's/.*90th percentile: \([0-9]*\)ms.*/\1/p' | head -1)
  p95=$(echo "$out" | sed -n 's/.*95th percentile: \([0-9]*\)ms.*/\1/p' | head -1)
  p99=$(echo "$out" | sed -n 's/.*99th percentile: \([0-9]*\)ms.*/\1/p' | head -1)
  echo "${total:-0} ${janky:-0} ${p50:-0} ${p90:-0} ${p95:-0} ${p99:-0}"
}

median() { printf '%s\n' "$@" | sort -n | awk '{a[NR]=$1} END{print a[int((NR+1)/2)]}'; }

MODEL=$($ADB shell getprop ro.product.model | tr -d '\r')
REL=$($ADB shell getprop ro.build.version.release | tr -d '\r')
HZ=$($ADB shell dumpsys SurfaceFlinger 2>/dev/null | grep -o 'peakRefreshRate=[0-9]*' | head -1 | cut -d= -f2)
[ -n "$HZ" ] || HZ=$($ADB shell dumpsys display | grep -o 'fps=[0-9]*' | sort -t= -k2 -n | tail -1 | cut -d= -f2)
echo "Device: $MODEL · Android $REL · ${W}x${H} @ ${HZ:-?} Hz · $RUNS runs × $FLINGS fling pairs"
echo
echo "| JS thread | frames | janky % | p50 ms | p90 ms | p95 ms | p99 ms |"
echo "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"

for LOAD in 0 1; do
  open_bench "$LOAD"
  # Warm-up: the first flings after a launch pay for JIT and image/layout
  # caches, and would flatter whichever configuration runs second.
  fling_cycle
  T=(); J=(); A=(); B=(); C=(); D=()
  for _ in $(seq 1 "$RUNS"); do
    read -r t j a b c d < <(measure)
    T+=("$t"); J+=("$j"); A+=("$a"); B+=("$b"); C+=("$c"); D+=("$d")
    # back to the top so every run starts from the same place
    for _ in 1 2 3; do $ADB shell input swipe "$X" "$Y_HIGH" "$X" "$Y_LOW" 60; sleep 0.6; done
  done
  LABEL=$([ "$LOAD" = 1 ] && echo "busy (${BENCH_BUSY_MS:-10} ms / 16 ms)" || echo "idle")
  echo "| $LABEL | $(median "${T[@]}") | $(median "${J[@]}") | $(median "${A[@]}") | $(median "${B[@]}") | $(median "${C[@]}") | $(median "${D[@]}") |"
done
