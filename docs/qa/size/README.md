# Real carpet sizes

The rack centreline is **2.15 m** above the ground and its span is **3.4 m**. Crossbar/post outside diameters remain **48/72 mm**. The widest current scan has 0.317 m of pipe to each side. The largest rug has a conservative 0.388 m clearance including thickness, or 0.288 m after a 0.1 m motion reserve. Settled browser clearance is 0.468 m.

| Type | Nominal short x long (m) | Actual representative short x long (m) | Half length (m) |
| --- | --- | --- | --- |
| Palas | 1.5 x 2.2 | 1.903 x 2.2 (09); 1.443 x 2.2 (06) | 1.10 |
| Wool | 2.0 x 3.0 | 1.950 x 3.0 (03) | 1.50 |
| Largest wool | 2.5 x 3.5 | 2.766 x 3.5 (05) | 1.75 |
| Runner | 0.9 x 3.0 | 1.572 x 3.0 (01) | 1.50 |
| Tapestry (outside current rotation) | Existing 2.2 x 2.7 | Short side from its image aspect | 1.35 |

Decisions: exact image aspect takes priority over nominal short-side dimensions; each long side matches its type/size variant. Scan 05 carries the largest wool size in build config/manifest, without creating another gameplay type. No scan stretching, cropping, floor-driven shrink or type reclassification. This means the available runner scan is wider than a nominal Soviet runner. The established mass, material properties, timers, yard background and scoring remain intact.

The camera keeps its 48-degree field of view and 1.82 m eye height. Distance scales with half length and rack span, with a 2.9 m minimum to keep the idle beater clear of the short palas. At 1280 x 900, wool and runner occupy 54-55% frame height; the physically shorter palas occupies 43%. Both posts and the crossbar are visible. Camera aim stays at the hanging-half centre. A closer 2.4 m camera trial produced an initial idle-beater contact/recovery on palas and was rejected.

Default-camera screenshots: [palas](09-palas.png), [wool](03-wool.png), [largest wool](05-wool.png), [runner](01-runner.png). These PNGs are local QA artifacts and are ignored, including nested fold/bar/layer screenshots, because the courtyard contains personal licensed yard stock. `browser.json` records sizes, default camera, frame bounds, ground clearance, end margins and recovery counts.

The physical cleaning radius scales with sqrt(carpet area); conversion to UV units retains the existing normalized kernel. Carpet #1 takes **23** seeded random 0.75-strength hits for the museum start (11 + 12) and **22** for the easy local stock start (11 + 11), and thirty-seed averages are **28.4 / 27.83** hits. All tested rotation budgets still allow at least 1.6 times expected play time, including the flip. See `difficulty.json`.

Reproduce with Vite at 127.0.0.1:5173:

```powershell
node scripts/verify-size.mjs
node scripts/simulate-difficulty.mjs
$env:QA_OUT='docs/qa/size/fold'; node scripts/verify-fold.mjs
$env:QA_OUT='docs/qa/size/bar-clip'; node scripts/verify-bar-clip.mjs
$env:QA_OUT='docs/qa/size/layers'; node scripts/verify-layers.mjs
node scripts/verify-longrun.mjs --out=docs/qa/size/biggest-longrun.json
node scripts/verify-longrun.mjs --carpet=envato-B7PV8QR --out=docs/qa/size/longrun.json
npm test
npm run build
```

Fold QA verifies full UV continuity, equal halves, flip gating, combo, all museum geometry and two-half cleaning. Bar QA uses the largest scan for 40 full-strength near-bar impulses and 40 charged pointer strikes, in addition to independent native contact enabled/disabled probes. Layer QA uses 2.5 x 3.5 m cloth in both fold orientations, with native clusters enabled and disabled: all four 1,140-step cases passed with zero layer/bar violations and at least 0.186 m of back-edge movement. Long-run reports cover 225 simulated seconds per timing variant, including 180 seconds idle, 34 charged strikes and two flips; zero recoveries are required.

Validation: `npm test` passed all **155** tests in 22 files; `npm run build` passed. Both rugs completed all three timing variants (225 simulated seconds, 13,500 steps, 34 strikes, two flips per case) without errors, threshold failures or recoveries:

| Rug | Timing variant | Max extent (m) | Max speed (m/s) | Recoveries |
| --- | --- | ---: | ---: | ---: |
| 05 | 60 | 1.844103 | 4.981973 | 0 |
| 05 | 144 | 1.841153 | 4.213611 | 0 |
| 05 | hitch | 1.842164 | 6.000000 | 0 |
| envato-B7PV8QR | 60 | 1.633262 | 6.000000 | 0 |
| envato-B7PV8QR | 144 | 1.637126 | 6.000000 | 0 |
| envato-B7PV8QR | hitch | 1.629847 | 6.000000 | 0 |

An additional 60 Hz probe with the final default camera (48 degrees; position 0.2, 1.82, 3.639411 m; target 0, 1.275, 0) also passed the full 225-second sequence with zero recoveries, 34 strikes and two flips. See `final-camera-longrun.json`. Across the largest-rug probes the maximum node extent of 1.844103 m also bounds the bottom surface above 0.294 m, including cloth thickness.
