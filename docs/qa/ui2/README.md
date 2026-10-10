# UI stream: paged modal delivery

The start flow, carpet results, game over, unlock rewards and retry now share `src/ui/modal.js`. The card stays centred under the 920px width and viewport-height limits; its body does not scroll. The footer retains the primary action on every page. The previous scrolling poster and separate reward dialog implementation were removed.

Changed files: `src/ui/modal.js`, `src/ui/modalFlow.js`, `src/ui/hud.js`, `src/ui/hud.css`, `tests/uiModal.test.js`, `scripts/qa-ui.mjs`, `.gitignore`, and this QA directory. `src/main.js` has small hooks for volume, blocking-modal input/frame pause and startup failure retry. No scene, carpet or FX implementation was edited. The carpet build may rewrite the manifest's line endings; it has no content diff. The research brief appeared during this task and was read; it belongs to the shared research stream.

Validation: 253 tests pass, including all existing contrast, safe-zone, retry and HUD regression tests plus four new pure paging/keyboard cases. Production build passes (existing large-bundle warning). `fit-results.json` covers 95 deterministic UI states and `live-fit-results.json` covers 110 game states across 800x700, 1024x640, 1280x720, 1440x900 and 1920x1080: zero fit failures or page errors. Actual canvas-backed captures include nine menu pages because local stock credits are present. The tests exercise native slider arrows, primary Enter, Escape, two queued rewards, retry, restart, both focus-trap directions and restoration. `fallback-fit-results.json` verifies startup retry with WebGL deliberately unavailable.

Reproduce with Vite serving this worktree:

```sh
npm run dev -- --host 127.0.0.1 --port 5173
node scripts/qa-ui.mjs
node scripts/qa-ui.mjs --live
node scripts/qa-ui.mjs --fallback
npm test
npm run build
```

`UI_URL` overrides the server URL. The script scans painted controls, text-node bounds, clipping ancestors, scrollbar overflow, viewport bounds, panel intersections and the central 60% safe zone. Closed statistics content is explicitly removed from layout until expanded. It fails with exit code 1 and writes all offending rectangles. Isolated mode imports the actual Hud, Game, beaters and carpet manifest without starting Ammo or the courtyard. Live mode starts the actual game and freezes its clock after readiness so screenshots cannot expire the round. Google Fonts is blocked to verify the local fallback font path. Restart Vite after edits in this worktree: its existing watcher ignores `.claude` paths.

Screenshots: each menu/credits page and every blocking outcome at 1440x900 and 800x700 are in the matching size directories. `live-*` directories show the carpet/courtyard beneath the light 45% scrim and 2px blur. Their `licensed-stock-*.png` files are gitignored. Isolated screenshots and the no-WebGL fallback have no licensed imagery and are reviewable repository artifacts. `audit-before.md` and its raw JSON inventory document the original scrolling layouts; closed-details/raw-font geometry is marked as diagnostic rather than visible clipping.

Measurements: 30 page DOM mutations averaged 0.247ms, maximum 0.600ms in Chrome; this excludes layout and paint. The modal adds no per-frame update, texture, geometry, physics body or beater render loop. The existing preview renders on selection. Blocking modals skip gameplay/Ammo advancement; playing retains the existing fixed-step path. Chrome live QA used SwiftShader, so RTX 2080 Ti CPU/GPU budget validation remains for the integrated hardware performance pass; these UI layout captures are not a hardware benchmark.

Integration: existing Hud methods used by main remain intact. Carpet/stock credit manifests retain their title, credit, source URL and licence. Optional `public/yard/credits.json` is read with graceful missing/invalid-file fallback; array and `{credits: [...]}` formats accept `{title|name, sourceUrl|url, credit|author, license}`. Other streams can call `hud.addCredits(entries)` or provide `yardCredits` in Hud options. Credit additions preserve the active setup page. No assets were downloaded by this stream. Dialog keyboard/focus behaviour was checked against the [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Decisions:

- Four setup topics; credits use additional pages of four complete entries, with a responsive grid, to fit all five required viewports.
- Escape goes back one page, then dismisses setup or resumes a paused game. Before a shift, dismissal leaves an explicit menu button. Results keep their required continuation action; startup failure keeps retry available.
- Hold/release/F steps and four rules replace repeated onboarding copy. Redundant statistics explanation is removed from the corner panel; expanded statistics still fits without scrolling.
- Range/select arrows retain native behaviour; page arrows and Enter apply elsewhere. Focus is trapped and restored by the shared component.
- System reduced-motion preference remains authoritative; the settings checkbox additionally reduces UI motion. Unmuting from zero restores 80% volume.
- Toasts carry non-blocking messages only; retries and unlocks are blocking modals. The compact toast sits in the top band between corner panels.
- No commits or Git mutations were performed. The only unfinished validation is the integrated RTX hardware performance pass.
