# Release hygiene QA — 2026-10-11

Production build and preview used `COVERHIT_BASE=/CoverHit/` at
`http://127.0.0.1:5189/CoverHit/`. [report.json](report.json) records the browser
audit; no screenshots or external assets were added.

`npm test`: **379 passed**, 54 files. `COVERHIT_BASE=/CoverHit/ npm run build`:
passed; Vite retains its existing large-chunk notice. `npm run build:public`
also passed. `bash -n scripts/publish-public.sh`: passed.
Pages smoke: index and all three referenced JS files returned HTTP 200 with
JavaScript content types. The post-deploy CI job uses this same smoke helper.
The GitHub deployment itself was not executed in this task.

## Browser results

Desktop Chrome (High/full), iPhone 14 Pro WebKit (automatic lite) and Pixel 7
Chrome (automatic lite) all passed after startup and three dust-producing hits:

- Zero failed requests, HTTP errors, console errors and page errors.
- Zero requests for carpet/yard local manifests or the nonexistent yard credits file.
- Zero warnings from project shaders.
- Desktop retains two compiler-log messages: N8AO `PoissionBlur.js` X3595 and
  three.js `PMREMGGXConvolution` X4122. Both are tied to the compiled GLSL using
  read-only WebGL diagnostics, retained verbatim, and documented in NOTICE.
- Phones logged no warnings. WebKit emulation is not a physical iPhone memory test.

High sampled at most **127 draw calls**, below 150. Mean measured CPU frame time
was **10.43 ms**, above the requested 6 ms; that budget did not pass this run.
The machine had concurrent browser/QA workloads. These are ordinary capped
preview samples, not the isolated uncapped performance measurements described
in `docs/qa/perf/README.md`. No claim of CPU-budget compliance is made here.

## Decisions

Production gates use `DEV || VITE_STOCK === '1'`; personal
`COVERHIT_INCLUDE_STOCK=1` builds set the runtime flag. The existing phone
exclusion stays in place. Carpet assets received only two manifest-loading
line changes; the other agent's lighting, touch and CSS files were not edited.
Credits use the existing `yard/photos/credits.json` inventory.

PCSS uses explicit LOD 0 in both sampling loops and assigns the normal shadow
result instead of inserting an early return into three's shadow function.
Dependency shader code and console diagnostics remain untouched.

MIT applies to own code. Existing CC BY-SA photograph derivatives keep their
licences; lite images inherit original attribution and derivative conditions.
Package name stays `coverhit`; metadata identifies the public repository and Pages URL.

CI builds from committed processed carpets, regenerates lite copies, and keeps
the existing cache/concurrency. Tests retain their existing Chrome/Python
availability skips. Combo tests use explicit frames and frozen clocks; four
Vitest workers and a 30-second default timeout bound competing physics workloads.

The snapshot guard applies the requested path regex literally to every path,
including source files such as `scripts/stock-build.mjs`. Such a snapshot is
refused; no source-file exception was invented. Files above 8 MiB and symlinks
also fail, and the guard prints count, size and licences before any push.
Fixture/unit tests cover these rejections. The publication script was not run
because its Git archive/clone/commit/push operations exceed the task's allowed
Git commands. Only Git status/diff/show were used during the task.
