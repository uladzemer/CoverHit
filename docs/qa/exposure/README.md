# Civilian Zhiguli and photographic courtyard exposure

The cars have plain civilian paint, photographic glass and handles, reconstructed
door seams and blank plates. The factory deterministically assigns ivory
`#d9d3b8`, sky blue `#7da5b8` and cherry `#5a1520` to the three instances. No
additional material draw or uploaded texture is needed: the existing atlas's
alpha channel carries the paint mask. Glass uses a nonzero mask sentinel so
WebP compression preserves its RGB; the opaque shader thresholds the sentinel.

`scripts/correct-yard-photos.mjs` detects saturated body graphics and the known
stripe/lettering regions, dilates five pixels, interpolates unmarked paint
luminance across each removed region and adds deterministic fine noise. It
restores seams and photographed handles, and blanks front/rear graphics and
plates. This correction also runs at the end of the original photo generator.
The shipped body decal residual is **0.121%**, below **1%**. Tests inject a red
decal to demonstrate that the detector rejects a regression, and separately
reject plate/sticker contrast. This is a mask-based guard, not general OCR.
Unused photographic source references retain their attribution and original
content; the game uploads only the cleaned car atlas.

## Exposure measurements

`reference.json` is a fresh render of pre-photos revision
`a00a80a983ee3dc3e5620caa5bcafedb0661332e`. The earlier colour/lighting PNGs
were absent from this worktree. `reference-provenance.json` records the isolated
snapshot method: all source files copied using **git show**, with no checkout,
stash, commit, index or branch commands. Base assets and museum carpet scans
are shared. Both reference and final use High, seed `colour-1986`, carpet `09`,
1440×900 and optional licensed stock blocked, matching the photos QA asset mode.

Mean Rec.709-weighted **sRGB code luminance**, from canvas pixels without HUD:

| Region | Main reference | Fresh photos before | Final | Final / main change |
| --- | ---: | ---: | ---: | ---: |
| Pad asphalt | 0.2162 | 0.2487 | 0.2486 | +15.0% |
| Lawn | 0.2023 | 0.2022 | 0.2053 | +1.5% |
| Facade | 0.2356 | 0.2653 | 0.2643 | +12.2% |

All three pass **±20%**. Whole-canvas clipping is **0%**, below **1%**.
`verify-yard-exposure.mjs` stores the exact normalized crop coordinates and
checks every region, clipping, the HDR environment, exposure, facade caster
exclusion and window emission. Unit tests reject a 21% darkening and 1% clipping.

The architect's supplied `photos-default.png` measures pad **0.0926**, lawn
**0.1193**, facade **0.2614** (`photos-review.json`). That 1468×986 historical
capture has a different seed/quality history and is much darker on the ground
than a fresh incoming-revision render. It is retained as diagnostic evidence,
not substituted for the matched 1440×900 acceptance comparison. A global
exposure increase would overexpose the freshly rendered scene and change the
preserved carpet treatment.

## Diagnosis and corrections

- Five photographic atlases now receive gray-world balance and division by
  broad blurred luminance. Their delivered mean luminance is **0.508–0.516**,
  with mean RGB channel spread under **0.006** (`assets.json`). Neutral material
  tint replaces the extra yellow/dark multiplier. Eight boundary rows blend
  vertical repeats; horizontal mirrored repetition remains. Facade roughness
  is 0.90–0.94, normal strength 0.12, metalness zero and HDR multiplier 0.85.
- The unbatched road shares asphalt with static batches. Batching enables
  vertex colour on that material, but the road had no colour attribute. WebGL's
  default zero attribute made it black. Explicit white vertex colours restore
  the texture, sky fill and sun response. A regression test guards the attribute.
- High/Medium previously zeroed grass-card emissive fill and photographic
  window emission along with unrelated materials. Grass retains its original
  green colour, alpha test, 0.22 fill and 0.25 HDR multiplier; photo windows
  retain their masked 0.55 sunset emission. Rounding the facade seed prevents
  interpolation precision from turning a lit window into random bright speckles.
- The car paint's metalness drops from 0.32 to 0.12, giving it the same 0.85
  sky multiplier as ordinary props. Hue/lightness remapping applies only to the
  paint mask; glass roughness also uses that mask, so dark cherry paint cannot
  be mistaken for glazing.
- No missing HDR was found. The scene keeps environment intensity **1.35**,
  exposure **0.85**, Neutral tone mapping, warm LUT, 7.5°/3500 K sun, CSM
  14/55/220 m splits, biases, PCSS softness, AO and carpet coverage shaders.
  Photographic perimeter facades remain excluded from courtyard casting; the
  capture asserts no visible photo/backdrop caster. They do receive shadows.

## Preserved carpet colour

The full `scripts/verify-carpet-colour.mjs after` run passes, including fresh
Medium → Low → High materials, bloom isolation and sky/facade clipping.

| Carpet | Hue shift | Saturation / scan | Luminance / scan | Clipping |
| --- | ---: | ---: | ---: | ---: |
| Red medallion | 0.21° | 98.3% | 94.8% | 0% |
| Bukhara | 0.28° | 99.8% | 93.3% | 0% |
| Kazak | 0.63° | 99.1% | 94.7% | 0% |

The verifier now recognizes photographic facade materials. Its **colour,
exposure, clipping and bloom thresholds are unchanged**. The earlier requirement
that 10% of the close default ground be darkened by >8 codes was replaced:
the 7.5° sun projects a 2 m caster **15.19 m**, mostly beyond that small pad.
The verifier retains the default shadow-on/off measurement, requires >100
pixels darkened by >8 codes and less than 90% coverage, then captures the long
footprint from `(8,6,12)` toward `(7,0,6)` and requires >100 penumbra pixels
darkened by >1 code and positive mean darkening. Current default captures have
**1201–1471** pixels darkened by >8 codes; the footprint has **113792–157163**
pixels darkened by >1. This guards visible soft shadows and sun on the pad
without requiring broad pad shade. The JSON retains both measurements.

## Evidence and reproduction

Local screenshots: `after-default.png`, `after-car-close.png`, `after-wide.png`,
`after-aim-left.png`, `after-aim-right.png`, plus `after-car-cherry.png`,
`after-car-sky.png`, reference/before captures and shadow-off diagnostics.
`colour/` contains the scan references, masks, quality replacements and shadow
diagnostics. All exposure PNGs are ignored because QA may include local
licensed assets; JSON and this report are tracked.

Run Vite on port 5183, then:

```powershell
node scripts/verify-yard-exposure.mjs after
$env:COLOUR_OUT = 'docs/qa/exposure/colour'
node scripts/verify-carpet-colour.mjs after
```

To regenerate the main reference, stop any server on 5184, run
`node scripts/prepare-yard-exposure-reference.mjs`, start the printed Vite
command on 5184, then run `node scripts/verify-yard-exposure.mjs reference`.
To inspect the incoming photos revision, prepare `3850382` instead and run
`node scripts/verify-yard-exposure.mjs before`; the probe supplies its original
albedos with read-only Git fallback. `EXPOSURE_URL` and `CHROME_PATH` override
server/browser defaults.

Validation: **npm test: 42 files, 283 passed, 12 optional tests skipped**;
**npm run build: passed**, with the existing large-chunk advisory. Final asset
refresh also passed Vite production build. Browser probes report no page/shader
errors. The build's unrelated optional-carpet manifest/cut rewrites were restored
from their incoming bytes; no carpet source or colour implementation was edited.

Decisions: keep the photographic side through deterministic inpainting; use
ivory/cherry/sky blue seeded paint; correct albedo/material issues locally;
preserve global golden-hour/textile rendering; retain photo window lighting;
use the isolated main render as the fixed acceptance reference; measure shadows
in their actual footprint and require a sunlit pad.
