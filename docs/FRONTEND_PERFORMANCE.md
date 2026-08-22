# Frontend Performance Record

**Measurement date:** 2026-08-23. The production build was measured before and after route-level code splitting with the same project source and build command.

| Measure | Before | After | Measured change |
|---|---:|---:|---:|
| Initial `index` JavaScript chunk | 1,407.37 kB | 682.51 kB | **51.50% smaller** |
| Deferred Results route after route split | Included in initial chunk | 656.31 kB separate chunk | Loaded only when navigating to Results |
| Deferred Results route after dormant-renderer deferral | 656.31 kB | 41.16 kB | **93.72% smaller** |
| Deferred analysis/history routes | Included in initial chunk | 19.90 kB / 22.64 kB separate chunks | Loaded only when visited |

The initial public dashboard now loads the home route first and defers analysis, history, scientific information pages, and the Results route. This keeps the optional Three.js geometry viewer out of the initial payload. The fallback is an accessible live-status message inside the existing `main` landmark; cross-route WCAG 2 A/AA and keyboard skip-link checks passed after the change.

Desktop preview captures of the home route and the deferred analysis route were also checked after splitting. Both routes rendered their navigation, language control, mandatory non-clinical notice, and explicit Mode B-unavailable message normally.

The current Mode B-unavailable route now renders a lightweight bilingual explanation rather than importing the dormant Three.js renderer. This is correct because no compatible stored geometry can exist while the full-volume segmentation release gate remains closed. If validated geometry is ever introduced, the renderer must be reintroduced as a dynamic, artifact-gated import only after the Mode B evidence gate is closed.

The initial `index` chunk remains above Vite’s 500 kB advisory threshold. The warning is non-blocking and is no longer caused by the dormant Three.js path. Any further splitting must preserve the existing language provider, skip-link target, and non-clinical status notice.
