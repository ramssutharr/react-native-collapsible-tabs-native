---
title: ref, Imperative API for Collapsible Tabs
description: The CollapsibleTabsRef methods, scrollToTop, setIndex, collapse and expand, for driving a native collapsible header and tab pager in React Native.
---

# `ref`: the imperative API

`CollapsibleTabView` and `CollapsibleTabsShell` accept a `ref` of type `CollapsibleTabsRef`.

```tsx
import { useRef } from 'react';
import type { CollapsibleTabsRef } from 'react-native-collapsible-tabs-native';

const tabs = useRef<CollapsibleTabsRef>(null);

<CollapsibleTabView ref={tabs} … />

tabs.current?.scrollToTop();                     // active page → top, header comes back
tabs.current?.scrollToTop({ index: 1, animated: false });
tabs.current?.setIndex(2, { animated: false });  // jump without the pager animation
tabs.current?.collapse();                        // header (and unpinned tab bar) away
tabs.current?.expand();
```

| method | what it does |
| --- | --- |
| `scrollToTop({ index?, animated? })` | scroll a page's list to its top (default: the active page). The "tap the active tab again" affordance |
| `setIndex(index, { animated? })` | move the pager; fires `onIndexChange` exactly like a swipe, so your controlled `index` stays the source of truth. Exists for the `animated: false` jump a prop change cannot express |
| `collapse({ animated? })` | scroll the active list until the bands are fully collapsed |
| `expand({ animated? })` | bring the bands back. `'classic'` scrolls the list to its top (the header mirrors it); `'direction'` animates the header alone, which that mode allows |

`animated` defaults to `true` everywhere.

## Through the engine, not around it

Every method goes **through** the collapse engine: the header is derived from the active list's scroll position, so these move the list and let the header follow rather than moving the header on its own, which would leave a gap under the tab bar. `allowFullCollapse` guarantees even a short tab can honour `collapse()`.

In `'direction'` mode, `collapse()` lands the bands exactly on the collapse point once the list can hold it, and `expand()` reveals the header in place without moving the list, because that mode allows the header to be open over deep content. Use `scrollToTop()` for "go to the top *and* reveal".

## Where the ref lives

The ref is a Fabric command surface; there is nothing to read back from it. To *observe* positions, use the [per-frame events](/guide/events).
