# Courtyard revision 4

The courtyard now has three detailed five-storey buildings and eight cheap
perimeter blocks, using panel 1-464 and brick 1-447 variants with rotated
facades. One far panel block has nine storeys. Far blocks share window atlases
and box geometry (12 triangles per building); they do not cast play-area
shadows. The enclosure remains present when stock models, textures and HDR
are unavailable. Fog blends distant housing into the HDR horizon colour.

The camera rises from 1.50 to 1.82 m and looks down toward the panel centre.
The measured carpet occupies 48.7–49.3% of the landscape frame and its lowest
node stays above 0.51 m in the saved default samples. At both 1.82 and 2.22 m,
720 horizontal rays around the full skyline hit housing, with zero gaps.
Default, extreme pointer positions and raised-camera screenshots are saved
for stock, procedural and all-assets-missing modes. Aim changes the pointer
and beater, while the camera retains its normal direction.

## Rack and carpet rule

`src/carpet/barCollision.js` owns the 2.0 m rack centreline, 72 mm post diameter,
48 mm crossbar diameter, 12 mm carpet thickness and 0.25 m ground clearance.
The visible capped/welded blue rack, native cylinder, rounded crown and
projection use those dimensions. Paint chips use a local atlas; concrete
footings remain visible in the fallback.

Uniform carpet sizing limits the long side to:

```js
Math.min(3.2, 2 * (BAR_HEIGHT - CARPET_GROUND_CLEARANCE - CARPET_THICKNESS - 0.1))
```

This keeps exact image aspect and type mass, includes a 10 cm motion reserve,
and scales down rugs that would be too long. Existing 1.2–1.6 m halves already
fit the 2.0 m rack. Five new tests cover oversized portrait, landscape and
square rugs, and check both lower edges against the ground-clearance rule.
Layer spacing remains 26 mm because carpet thickness is unchanged.

## HUD and screenshots

Labels use cream text on `rgba(20,18,24,0.7)` panels with 8 px blur. Score,
timer, side/cleanliness, records, carpet identity and toggles have backings.
Disabled flip text retains full opacity. Poster, credits and toasts keep dark
ink on opaque cream, Russo One and red accents. The red button/combination
background is slightly darker for readable cream text.

`performance.json` records computed WCAG contrast against a worst-case white
scene behind each translucent panel. Every sampled label passes 4.5:1; the
lowest ratio is **5.37:1**. Screenshots include menu, expanded credits/beater
selector, playing, carpet done, game over, urgent timer, neighbour toast,
moth popup, retry toast and mobile play (390 × 844).

All PNGs here, including nested physics screenshots, are gitignored: local
stock rugs and yard models are licensed personal assets. JSON reports and
this description contain no licensed image data.

## Performance

Hardware Chrome 155.0.8059.39, headless, viewport 1468 × 986, NVIDIA GeForce
RTX 2080 Ti through ANGLE/D3D11. Each view records 120 animation frames.
The following are the default-view samples; `performance.json` also contains
left-most and right-most pointer samples.

| Mode | Draw calls | Triangles | CPU frame mean / p95 | Render submission mean | Observed frame interval mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| Local stock | 120 | 551,433 | 20.48 / 30.90 ms | 1.68 ms | 31.25 ms |
| Procedural housing/props + CC0 surfaces/HDR | 95 | 332,000 | 17.04 / 24.60 ms | 1.11 ms | 31.25 ms |
| All yard assets unavailable | 96 | 332,518 | 18.44 / 38.80 ms | 1.10 ms | 31.51 ms |

The largest draw-call count across all saved aim samples is **120**, below
130 (missing-assets right aim briefly reaches 100). CPU frame timing includes
physics and render submission; it is not a GPU timer. The observed headless
cadence is about 32 frames/s, so these measurements do not establish 60 fps.
There are zero page errors in all three startup modes.

## Reproduction and physics evidence

Run Vite at `127.0.0.1:5173`, then:

```powershell
node scripts/verify-yard4.mjs
$env:QA_OUT='docs/qa/yard4/fold'; node scripts/verify-fold.mjs
$env:QA_OUT='docs/qa/yard4/bar'; node scripts/verify-bar-clip.mjs
$env:QA_OUT='docs/qa/yard4/layers'; node scripts/verify-layers.mjs
```

Restart an existing Vite server before verification in a `.claude/worktrees/`
checkout: the current `.claude` watch exclusion prevents edits here from
invalidating Vite's module cache. Verification uses installed Playwright or
the existing local npm Playwright cache, and Chrome (override `CHROME_PATH`).

`fold/browser.json` verifies equal halves, continuous UVs, image aspect,
both flip directions, ignored hits during flips, twelve pointer strikes
reaching ×3, and normal automatic flip/completion behavior. All ten museum
images pass; bar geometry checks additionally include five local stock rugs.

`layers/browser.json` covers portrait/landscape folds with native clusters
both enabled and disabled: 30 full-strength impulses and 1,140 steps per
case, including both flip directions. All four cases have zero bar or layer
violations; back-panel movement is 21.2–23.0 cm after the first impulse.
Physics probe timings are machine/load dependent.

`bar/browser.json` verifies the resized native cylinder with projection
disabled: normal SDF contact stops the patch, while disabling contact or
using collision-suppressing anchors lets it pass through. Forty deterministic
full-strength impulses over 480 steps have zero penetrations and a maximum
node speed of 3.62 m/s. The pointer probe records **40 full-charge impacts,
zero misses, zero penetrations and zero wrong-side nodes** over 1,991 physics
steps, followed by a successful flip. Fifteen museum/local-stock image sizes
retain exact aspect and the correct fold axis. The probe counts dispatched
impacts directly because the development strike log retains only 32 entries;
it holds round completion during the stress phase and restores it afterward.

`npm test`: **155 tests in 22 files pass**. `npm run build`: **passes**;
Vite retains its existing large three.js chunk advisory.

## Decisions

- Enclose with rotated housing and shared far window atlases; keep stock optional.
- Raise the eye 0.32 m and fit the hanging panel near half the frame height.
- Use a reachable 2.0 m rack, 72/48 mm pipes, local blue paint and concrete footings.
- Preserve image aspect and mass; cap size from ground clearance with a motion reserve.
- Put scene-facing labels on 70% dark panels; retain cream posters and red accents.
- Ignore every QA PNG recursively, preserving text reports for review.
