# Crop and fringe QA

Run `npm run carpets`, then `node scripts/audit-carpets.mjs`. The complete before/after L/R/T/B table is in [borders.md](borders.md), with machine-readable measurements in [borders.json](borders.json). Four source corners rectify rotation/perspective; the `_debug/*.crop.jpg` overlays were inspected alongside the rectified outputs. `node scripts/inspect-border-landmarks.mjs` regenerates overlays of the independently reviewed field landmarks used by the edge-profile measurement.

RBFEDY2's retained frame measures **178.8 / 180.4 / 137.3 / 137.3 px**, with **0.89% L/R and 0% T/B mismatch**. Before correction it measured 259.2 / 364.8 / 316.7 / 468.3 px (33.85% / 38.63%). Corners are `[75,173], [1848,190], [1843,2712], [83,2758]`, ordered TL/TR/BR/BL.

**Source limitation:** the photograph cuts through the original outer motif border at the left and top. No four-corner crop can preserve those absent pixels. The corrected crop retains the outermost complete inner frame and removes the incomplete outer motifs plus the striped end extension. This is a documented departure from the requested full original outer border. The other scans' remaining mismatches are reported explicitly; intrinsic weaving, wear and bowed edges are preserved. Museum 03/04 have their plain kilim end extensions removed, and 02 loses the bottom display-mat sliver.

With Vite running, execute `node scripts/verify-fringe.mjs`. Local screenshots:

- `envato-RBFEDY2-before-game.png` and `envato-RBFEDY2-after-game.png`: same camera, old crop without fringe versus corrected crop with fringe. The before map uses the original aspect at the same physical long-side length.
- `envato-RBFEDY2-{before,after}-rectified.png` and `envato-RBFEDY2-{before,after}-overlay.jpg`: scan evidence, including the removed end extension.
- `03-after-game.png` and `09-after-game.png`: wool and palas fringe.
- `{envato-RBFEDY2,03,09}-mid-flip.png`: fringe follows both material ends as the rear half rises. Strands shrink near the pipe so they cannot visibly pass through it.

The screenshot ignore rules cover Envato pixels and game captures that can contain licensed yard stock. Browser measurements are committed in [browser.json](browser.json): one InstancedMesh with 594/660/544 bunches respectively, maximum attachment error below 6e-8 m, finite geometry during hits/flips, shadows enabled, and dust emitted for each strong edge hit. Unit tests also exercise landscape and portrait ends, springs, moving roots, tapestry exclusion, and pipe proximity hiding. No fringe bodies, nodes, links, or collision changes are added to Ammo.

Validation: `npm test` passes 205 tests across 28 files. `npm run carpets` regenerates all 15 locally available rotation rugs. The two disabled fragments have no enclosing frame; missing optional sources are skipped by the audit and tests. `npm run build` excludes licensed pixels from distributable output by the existing stock filter.

Decisions:

1. Retain RBFEDY2's complete inner frame; record the missing outer-frame pixels instead of inventing them.
2. Preserve intact original borders with intrinsic asymmetry. Their regression tests lock the reviewed widths; RBFEDY2 additionally enforces the requested 2% opposing-pair limit.
3. Use 7 mm bunch spacing and four low-poly wool strands per instance. Shorter palas/runner strands remain above 6 cm; wool strands stay below 10 cm; tapestry has none.
4. Tint cream wool with the lightest 12% of end-border samples. Root velocity, wind and local hit kicks drive damped springs; shrink instances only when passing close to the pipe during a flip.
