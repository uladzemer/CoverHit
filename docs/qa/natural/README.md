# Natural house and Zhiguli photographs

Before/after captures use Chrome at 1440 x 900, high quality, seed `colour-1986`, carpet 09. Optional stock and local carpet manifests are blocked, so these captures contain the credited Commons derivatives and repository assets. `review-*.jpg` pairs show the original revision on the left and the final version on the right; `crop-regions.json` records the exact crop coordinates.

## Selection and processing

Collected 227 Commons candidates across the 1-464, 1-335, 1-447, II-49, 1-468 and Khrushchev-house galleries, and ranked 199 successfully decoded previews. Facade screening required original width >= 3000 and aspect 1.2-2.5; Laplacian sharpness, green-pixel fraction and near-horizontal Hough-line angles ranked previews. These are screening heuristics, not a calibrated vanishing-point or semantic occlusion detector; eight finalists were visually reviewed in [finalists.jpg](finalists.jpg), with dimensions, authors, licences, URLs and scores in [finalists.json](finalists.json).

Rejected Tyumen 4 for branches and street furniture, historical Ust-Ilimsk 9 for monochrome photography, Baikonur 49/51 for trees across the residential wall, and Vyshny Volochyok 166 for vegetation and retail frontage. Chose Ozyorsk 77 for the sharp blue balcony frames, clean five-floor section and photographed entrance; Klumava 20 for intact glass, curtains and occupied balconies; Arzamas 94 for a usable brick alternative. Material slot names identify renderer slots rather than asserting the exact architectural series of each source building.

Each section uses one reviewed four-corner homography, then a residual correction of intact floor strips and a bounded large-radius lighting flat field. Sixteen pixels at each section edge form a narrow join; glass, stains, curtains and balcony fittings remain photographic. Front sections repeat upright without mirroring, with +/-2.5% exposure tints; the CC0 concrete strip supplies the ends and rear at panel scale, and the same photographs supply distant impostors.

Removed separate balcony/entrance boxes, photo normal noise, roughness maps and generated orange window emission. The procedural facade selector and missing-photo window fallback remain available. Car cutouts use polygon-seeded GrabCut, local background seeds, small-hole cleanup, a one-pixel alpha feather and nearest-interior RGB bleed; complete photographs receive only the sunset material tint, and the white photograph is rotated as a whole to level its wheel-centre axis.

Rejected the cream Moscow-show photograph because ropes and people remained visible, and the 2022 white Moscow photograph because a fence crossed the body. The selected red 2101 and white 2106 are civilian cars with intact photographic paint and trim; `car-cream-cutout.webp` is the retained material-slot filename for the white variant. Billboards are 4.17 m wide with fixed courtyard yaw, soft wheel/contact blobs share the existing AO draw, and invisible physical bodies/tyres are enabled only during shadow rendering.

## Human-eye review: three sentences per crop

**House close — [comparison](review-facade-close.jpg).** The original shows grainy wall cells, uniform split glass and floating balcony rails. The final crop preserves real frames, mottled panel ageing and balcony belongings, although the closest blue balcony shadows still reveal the photograph's baked perspective. Removing the duplicate balcony geometry and correcting the full-floor mapping fixed the worst conflicts; extreme close views retain the intended flat-photo limitation.

**House mid — [comparison](review-facade-mid.jpg).** The original rectangular panes and orange inserts look manufactured, while the final wall has varied curtains, glazed balcony frames and photographed entrance canopies. Repeated blue balcony groups are still identifiable across neighbouring sections, and their original daylight shading does not change with the sun. The old concrete band over the top floor and displaced entrance boxes were removed, leaving a continuous five-floor photograph with restrained section exposure variation.

**House far — [comparison](review-facade-far.jpg).** The original reads as a regular grid of dark and pale rectangles. The final facade keeps uneven window occupancy, entrance detail and real balcony colours at courtyard distance, though repeated section stains can still be spotted deliberately. Re-baking distant houses from the same sections fixes the old photographic-to-synthetic style change, while mipmaps keep the far pattern stable.

**Car default — [comparison](review-default.jpg).** The original cropped car has grey painted patches and a constructed roof, whereas the final red car has continuous body reflections and actual chrome. At this distance the cutout boundary is quiet, but the displayed viewpoint remains that of its source photograph. Keeping the physical mesh invisible and retaining only its shadow removes the contradictory body/card outlines.

**Car aim-left — [comparison](review-aim-left.jpg).** The driveway cars are outside the original and final camera frustums at the actual left aim limit, so this crop cannot judge their paint or silhouette. The visible brick facade retains photographic glass and balconies, although repeated retail signs remain conspicuous. No car disappearance claim is inferred from this empty view; the side and three-quarter probes below provide the visible-angle checks.

**Car aim-right — [comparison](review-aim-right.jpg).** The original grey cars look pieced together, while the final red and white bodies keep complete photographic proportions and real wheels. The white source initially looked tilted and detached from the flat road. Rotating its complete photograph to level the wheel axis and adding soft contact under the tyres fixed that mismatch, although both variants still lack view-dependent parallax.

**Car wide — [comparison](review-wide.jpg).** The original small vehicle loses its body detail into flat grey patches. The final red car remains recognisable through paint reflections, window frames and chrome without a bright background halo. The fixed source viewpoint is still present, but the complete silhouette and shared contact shadow give a more coherent parked-car reading at the wide camera setting.

**Car side — [comparison](review-car-side.jpg).** The original wheel arches and white paint patches interrupt a synthetic side card. The final red cutout contains continuous paint, trim, tyres and the photographed far rear wheel, which can look slightly suspended because of source perspective. Clearing the low-poly camera silhouette and adding tyre-contact blobs fixed the larger floating-body effect without repainting the source.

**Car three-quarter — [comparison](review-car-three-quarter.jpg).** The original has a flat roof, mismatched front grille and obvious projected side edges. The final car preserves a coherent photographed rear/side view and has no separate front card seam. It is still a billboard rather than a free-orbit vehicle, so source perspective does not follow this inspection camera, but the worst constructed front and smeared paint have been removed.

**Car grazing/front probe — [comparison](review-car-front.jpg).** The original constructed front is blocky and its card edges are visible. The final fixed-yaw billboard becomes compressed from this deliberately grazing inspection camera, making its flatness obvious. A second crossing card was omitted because it introduces overlapping views; this remaining limitation is outside the default, right-aim and wide visible car views and is explicitly retained rather than called photorealistic from every direction.

## Reproduction

`node scripts/build-natural-photos.mjs` downloads only the reviewed originals, using the committed source URLs and recipe, then builds assets and attributions. Python requires OpenCV, NumPy and Pillow; cached originals live in ignored `artifacts/natural/`. `python scripts/verify-natural-photos.py` independently decodes the shipped WebPs and measures wall/window-frame lines with subpixel edge fits, pitch, section-edge luminance and cutout edge colours; it does not compare a generated image with itself.

Run the app on port 5187, then `node docs/qa/natural/verify.mjs`. For a read-only original comparison, run `node docs/qa/natural/baseline-server.mjs` on 5188 and set `NATURAL_URL=http://127.0.0.1:5188` before invoking `verify.mjs --baseline`; the server uses only `git show` and leaves working files intact. Regenerate comparison crops with `node docs/qa/natural/make-review-crops.mjs`; carpet checks use `COLOUR_URL=http://127.0.0.1:5187/?seed=colour-1986` and `COLOUR_OUT=docs/qa/natural/colour` with `node scripts/verify-carpet-colour.mjs after`.

Vite's existing `**/.claude/**` watch exclusion also covers this worktree, so restart the dev server after source edits. Performance samples must run without asset generation/build/test workloads in parallel; timings here describe this local Chrome run rather than every device.


## Chosen photographs and credits

| Photograph | Author | Licence | Reason |
| --- | --- | --- | --- |
| [Фото Озёрска 03.06.2022.jpg](https://commons.wikimedia.org/wiki/File:%D0%A4%D0%BE%D1%82%D0%BE_%D0%9E%D0%B7%D1%91%D1%80%D1%81%D0%BA%D0%B0_03.06.2022.jpg) | Artyom Vasilyev | CC0 | Clean five-floor section, blue glazed balconies and entrance; preserved stains and window contents. |
| [Klumava Street social housing.jpg](https://commons.wikimedia.org/wiki/File:Klumava_Street_social_housing.jpg) | Homoatrox | CC BY-SA 4.0 | Occupied balconies, varied glazing and curtains; alternative concrete facade. |
| [Arzamas, Nizhny Novgorod Oblast, Russia - panoramio (341).jpg](https://commons.wikimedia.org/wiki/File:Arzamas,_Nizhny_Novgorod_Oblast,_Russia_-_panoramio_(341).jpg) | Arzamassky | CC BY 3.0 | Sharp brick wall and real balconies; narrow lamp-post occluder locally removed. |
| [Lada 1600 -- Front.JPG](https://commons.wikimedia.org/wiki/File:Lada_1600_--_Front.JPG) | Bull-Doser | Public domain | Plain white 2106, empty cabin and weathered paint; no show ropes or foreground people. |
| [Moscow car show 2025-08-03 VAZ-2101 red 02.jpg](https://commons.wikimedia.org/wiki/File:Moscow_car_show_2025-08-03_VAZ-2101_red_02.jpg) | Retired electrician | CC0 | Stock red civilian 2101, low side/rear viewpoint and intact paint reflections. |

Concrete ends/rears use [concrete_slab_wall_02](https://polyhaven.com/a/concrete_slab_wall_02), Amal Kumar / Poly Haven, CC0. Full derivative attribution is in public/yard/photos/credits.json, public/yard/SOURCES.md and NOTICE.md; the contact-sheet source licences remain those listed in inalists.json.


## Final validation

| Check | Result | Limit |
| --- | --- | --- |
| Wall/window-frame tilt | 0.159 degrees | <= 0.3 degrees |
| Floor-pitch error | 0.514 px | <= 1 px |
| Repeated-section edge luminance difference | 1.07% | < 6% |
| Cutout edge colours over distance 40 | 0.00% | <= 0.5% |
| Default draws | 128 (+4) | delta <= 5 |
| Mean frame / GPU delta | -4.469 / -1.244 ms | regression <= 0.5 ms |
| Exposure changes | pad 15.1%; lawn 1.6%; facade 14.4% | +/-20% |
| Default clipping | 0% | < 1% |
| Missing-photo fallback | 150 draws; procedural windows visible | <= 150 draws |
| Tests/build | 49 test files; 335 passed, 7 skipped; production build passed | green |

Carpet 01/03/09 checks pass: hue shifts 0.21/0.27/0.62 degrees, saturation ratios 0.983/0.999/0.990, zero clipping and bloom channel delta <=1. Photo/procedural high/medium/low checks, facade-menu persistence and missing-photo fallback pass with no shader/WebGL errors. Asset and runtime measurements are preserved in `asset-quality.json`, `performance.json`, `baseline.json`, `colour/after.json` and `summary.json`; the production build retains the existing large-chunk warning.

Decisions: retain photographed daylight reflections and stains rather than invent lit panes or additional noise; use red/white civilian variants instead of the occluded cream show photo; use one fixed-yaw card per vehicle and document the grazing-view limitation; preserve the original procedural/missing-photo paths while simplifying their duplicate balcony/entrance geometry. No forbidden source directories were changed, and no Git commit or stash was made.
