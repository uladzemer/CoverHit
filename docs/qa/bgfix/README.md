# Background house and compact HUD repair

## Identification

The white/light-blue, windowless block in `docs/qa/owner-bg-house.png` is
`Rectangle01`, under `yard-stock-balcony-block`: the local Envato
`balcony-block.glb` (QK4A8DM), role `building`, placed at world `(9, 0, -69)`.
At the default 800 x 700 camera, rays through pixels `(250,120)`, `(350,120)`
and `(430,130)` all hit that object first. The first hit is approximately
`(-15.143, 12.595, -59.187)`. This establishes the object independently of the
HUD, tone mapping and background LODs.

The GLB has a single `Block_of_Flats_6_balcony` material, no images, no colour
map, and only POSITION/NORMAL attributes: its facade UVs are also absent.
The second local house, `panel-block.glb` (63X2Y7T), has an untextured
`Block_of_Flats_2` wall primitive without UVs; its sole image is `ground002.jpg`
on another primitive. Having one texture somewhere in a GLB is insufficient.

`scripts/identify-bg-house.mjs` reproduces the pixel rays against the current
scene. The results above were collected before the repair; after repair the
original stock objects are absent.

## Repair

Stock geometry is checked for finite vertices before bounds and facade checks.
Storey-height wall meshes must have colour maps and UVs. Incomplete houses
are replaced at their stock placements by our procedural five/nine-storey
panel boxes, using the window/sill/seam atlas on both facades and end walls.
Small roof hardware can retain solid metal materials. Replacement roof caps
and vents are built in the same local coordinate system; vents meet the cap.
The rejected source meshes/textures are disposed, and replacements appear in
`yard.stockStatus.substitutions`, separate from loaded licensed assets/credits.
Other licensed furniture and trees continue to load.

The window atlas uses subdued wall colour, roughness .95 and no emissive
facade. It receives the existing sunset lighting. Exposure remains 1.02,
bloom threshold 1.25, smoothing .15 and intensity .14: the fix removes the
untextured white surfaces instead of changing the scene's lighting globally.
The enclosing procedural housing and backdrop already have window geometry
or canvas facades. Default captures were visually checked for window visibility,
facade blow-out, roof attachments and laundry framing.

Laundry posts, wires and garments now share the rear interval
`z=-2.8..-1`, with lines at `x=-2.15/-1.65`, entirely inside the existing
`x=-3..3, z=-3..2` service pad. Six garments alternate between the lines;
towels, shirts and sheets have different lengths and narrower widths.
Their tops use the same sag function as the supporting wires. The rack and
gameplay camera remain fixed.

HUD compact mode activates below 1000 px width **or** 760 px height, including
1024 x 640. It reduces type sizes and spacing, condenses carpet information,
uses mute/reticle icon buttons with accessible labels, tooltips and pressed
states, and provides a native collapsible statistics panel. Gameplay corner
panels and toasts are constrained to the top/bottom 20% bands, preserving the
central 60% x 60%. Expanded content can scroll within its band. Carpet-complete
results occupy the bottom band and hide the corner panels. Full menu and reward
dialogs are modal screens; transient hit feedback still appears at the hit.

## Validation and captures

- `npm test`: **241 tests in 32 files pass**.
- `npm run build`: **passes**; existing bundle-size advisory remains.
- `tests/hudSafeZone.test.js` uses Chrome's real CSS layout with the actual
  HUD markup/styles at 800 x 700, 1024 x 640 and 1440 x 900, testing both
  collapsed and expanded statistics and the compact-mode breakpoint.
  Playwright is a declared development dependency. Windows uses installed
  Chrome; elsewhere run `npx playwright install chromium` or set `CHROME_PATH`.
- Stock regressions exercise missing textures, missing UVs and complete
  textured stock. Laundry placement retains the pad boundary regression.
- `node scripts/verify-bgfix.mjs` checks all three viewport sizes in stock,
  procedural and all-yard-assets-missing modes: nine default-view captures,
  zero page/shader errors, no gameplay corner-panel safe-zone overlaps,
  and an unclipped flip button. Stock mode substitutes both incomplete houses,
  loads the other six licensed models, and verifies replacement window maps.
- [Browser evidence](report.json) records actual panel rectangles, stock
  substitutions, asset status and exposure.

Requested licensed captures:
[800 x 700](stock-800x700-default.png),
[1440 x 900](stock-1440x900-default.png).
The intermediate [1024 x 640](stock-1024x640-default.png) is also available,
with matching procedural/no-assets captures. All PNGs in this directory and
the owner house reference are gitignored because licensed stock can appear.

Run Vite on `127.0.0.1:5178` before the browser verifier. `YARD_URL` and
`CHROME_PATH` override the URL and Chrome binary. Restart Vite after scene edits
in this worktree because the `.claude` watch exclusion suppresses them.

## Decisions

- Replace incomplete stock houses with our panel blocks; missing UVs make
  retrofitting the original facade atlas unreliable.
- Validate the structural facade, allowing intentionally solid roof hardware.
- Preserve sunset lighting and existing bloom/exposure settings.
- Move and shorten laundry inside the existing pad, with shared wire/cloth sag.
- Keep statistics collapsible at every size and retain keyboard-accessible
  controls when compact toggles show icons.
- Reserve the central gameplay area using bounded outer bands and scrollable
  overflow; exempt modal screens and transient hit feedback.
- Retain licensed captures locally and keep scripts, tests and text evidence in
  the repository.
