# React Removal Performance Benchmark

**Date:** 2026-04-08
**Environment:** macOS, Vite dev server, Chrome (headless via CDP)
**Dataset:** 124 search entries, 89 DOM commission entries, ~30 character sections

## Summary

| Metric                 |     React |  Vanilla |    Delta |
| ---------------------- | --------: | -------: | -------: |
| JS bundle (gzip)       |    148 KB |    49 KB | **-67%** |
| JS heap (initial)      | 26,509 KB | 4,570 KB | **-83%** |
| JS heap (after search) | 26,571 KB | 5,086 KB | **-81%** |
| npm packages           |     1,005 |      978 |  **-27** |
| Lighthouse timing      |  6,184 ms | 5,539 ms | **-10%** |

## Bundle Size (Production Build)

| Chunk                        | React (gzip) | Vanilla (gzip) |
| ---------------------------- | -----------: | -------------: |
| ClientRouter + React runtime |      89.3 KB |         5.5 KB |
| Search island                |      18.4 KB |        15.9 KB |
| vendor-ui (Radix + cmdk)     |      13.7 KB |              — |
| vendor-search (Fuse.js)      |       6.6 KB |         6.6 KB |
| HomeClientScript             |      11.4 KB |        11.4 KB |
| Other                        |      ~8.6 KB |        ~9.6 KB |
| **Total**                    |   **148 KB** |      **49 KB** |

## Memory (Dev Mode, JS Heap)

| State                        |     React |  Vanilla | Delta |
| ---------------------------- | --------: | -------: | ----: |
| After page load + idle       | 26,509 KB | 4,570 KB |  -83% |
| After search "blue" + settle | 26,571 KB | 5,086 KB |  -81% |
| Delta (search overhead)      |    +62 KB |  +516 KB |     — |

React's higher baseline is due to the React runtime, virtual DOM tree, Radix UI, and cmdk staying in memory. Vanilla's higher delta per search operation is because it creates DOM elements imperatively (no VDOM diffing), but the absolute numbers are far lower.

## Keystroke Latency (Dev Mode, ms per frame)

Typing "blue" character by character, measured as time from `input` event dispatch to second `requestAnimationFrame` callback.

| Keystroke | React | Vanilla | Notes                                 |
| --------- | ----: | ------: | ------------------------------------- |
| `b`       |  31.5 |    16.8 | First keystroke, Fuse.js not yet warm |
| `bl`      |  33.4 |    33.2 | Parity                                |
| `blu`     |  31.3 |    33.2 | Parity                                |
| `blue`    |  33.1 |    33.2 | Parity                                |
| settled   |  18.2 |    16.4 | After debounce, idle frame            |

Vanilla is slightly faster on first keystroke (16.8 vs 31.5 ms) because it doesn't need React reconciliation. Subsequent keystrokes are at parity (~33ms, dominated by Fuse.js matching). Both are well under the 100ms responsiveness threshold.

**Note:** Vanilla uses 100ms input debounce, so the heavy computation (model + DOM sync) only runs after typing pauses. React used `useDeferredValue` for similar effect. The per-keystroke numbers above measure the immediate event handler + rAF, not the full recompute.

## Search Clear Latency (Dev Mode)

|                |  React | Vanilla |
| -------------- | -----: | ------: |
| Clear → settle | 216 ms |  214 ms |

Parity. Both need to un-hide all filtered entries.

## Navigation Timing (Dev Mode)

| Metric           | React | Vanilla |
| ---------------- | ----: | ------: |
| Response end     | 31 ms |   19 ms |
| DOM interactive  | 43 ms |   29 ms |
| DOMContentLoaded | 68 ms |   87 ms |
| Load complete    | 68 ms |   88 ms |

Vanilla is faster to first byte and DOM interactive (no React SSR shim). DOMContentLoaded is slightly slower because the Astro template renders more static HTML (search UI is pre-rendered vs React placeholder).

## JS Resource Loading (Dev Mode)

| Metric              |  React | Vanilla |
| ------------------- | -----: | ------: |
| JS module requests  |     87 |      81 |
| Total transfer      |  25 KB |  256 KB |
| Total load duration | 111 ms |  249 ms |

React has more modules but smaller transfer in dev mode because Vite caches aggressively for React's pre-bundled deps. Vanilla has more transfer because search modules are individually transformed. This difference disappears in production builds (single chunks).

## DOM Complexity

| Metric                    | React | Vanilla |
| ------------------------- | ----: | ------: |
| Total DOM elements        |   794 |   1,503 |
| Search entries in DOM     |    29 |      89 |
| Hidden entries (filtered) |     0 |      79 |

Vanilla has more DOM elements because the Astro template pre-renders the full search UI (input, buttons, dropdown container, keywords row, help popover), whereas React rendered a placeholder until hydration. More search entries are present because deferred batches loaded during the benchmark.

## Lighthouse (Dev Mode, Desktop)

| Category       |    React |  Vanilla |
| -------------- | -------: | -------: |
| Accessibility  |      100 |      100 |
| Best Practices |      100 |      100 |
| SEO            |       61 |       61 |
| Total timing   | 6,184 ms | 5,539 ms |

Identical scores. Vanilla is ~10% faster in total Lighthouse timing.

## Conclusion

The React-to-vanilla migration achieved:

- **67% JS bundle reduction** — the dominant win, directly benefiting users on slow connections
- **83% memory reduction** — React runtime + VDOM eliminated from heap
- **Keystroke parity** — search responsiveness unchanged (both ~33ms per keystroke)
- **Identical Lighthouse scores** — no quality regression
- **10% faster Lighthouse timing** — less JS to parse and execute

The trade-off is slightly more dev-mode overhead (256 KB vs 25 KB transfer for individually transformed modules), which is invisible to end users and disappears in production builds.
