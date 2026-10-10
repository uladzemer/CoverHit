# Modular photographic facades

Architect review corrections: upright floor/bay assembly replaces both mirrored texture wrapping and the baked panel reflection. The facade switch lives on the modal's **Ковёр и графика** page: **Фасады: фото / рисованные**. `window.__coverhit.setFacades('photo'|'procedural')` changes it immediately, preserves procedural window geometry after static batching and saves `coverhit-facades` with guarded storage access. New sessions default to photo.

## Pixels and rectification

Three source photographs supply five visual atlas variants. Each 2048×2048 atlas packs four upright 1024×1024 modules: ground, typical A/B, top. A bay is 3.0–3.2 m wide and a floor 2.86 m high; 8-pixel gutters leave 1008 usable texels. Physical joint geometry and UV subdivision share these dimensions. Seeded sampling uses an avalanche hash instead of a parity/checkerboard sequence; brightness varies ±4%, with subtle hue variation and baked dark/lit/curtain glass. No facade reflection is used in any LOD.

The generator honours EXIF orientation (including the Bor photograph), starts from the original pixels, uses joint/floor corner picks, detects horizontal/vertical LSD segments, fits a robust projective correction, samples with Lanczos4 and applies a mild unsharp pass. Lanczos is the only enlargement method. The original brick generator already honoured EXIF; inaccurate picks were the actual rectification defect.

Independent acceptance decodes the **shipped WebP**, excludes all gutters, resizes each module to 512×512 with area filtering, and detects lines again. Thresholds: dominant horizontal/vertical family orientation ≤0.3°, Laplacian variance ≥8, edge fraction ≥2.5%. Full matrices/corners/native crop sizes are in [rectification.json](rectification.json); independently measured values are in [quality.json](quality.json).

| Atlas | Source ID | Uploaded px/m, X / Y | Max family angle, H / V | Laplacian variance range | Strong edge fraction | Native crop px/m, X |
| --- | --- | --- | --- | --- | --- | --- |
| panel | 7 | 325.2 / 352.4 | 0.099° / 0.205° | 58.0–110.7 | 50.5–68.7% | 79.7–83.5 |
| panel335 | 7 | 325.2 / 352.4 | 0.101° / 0.122° | 56.6–110.8 | 50.6–68.7% | 79.7–83.5 |
| brick | 8 | 336.0 / 352.4 | 0.066° / 0.267° | 95.3–160.8 | 55.3–67.0% | 79.0–96.0 |
| nine | 6 | 315.0 / 352.4 | 0.056° / 0.061° | 86.0–119.9 | 58.7–70.4% | 78.4–83.8 |
| tower | 6 | 315.0 / 352.4 | 0.056° / 0.061° | 86.0–119.9 | 58.7–70.4% | 78.4–83.8 |

These are **dominant line-family** measurements, not a guarantee that every worn mortar joint, projecting sill or curtain edge lies within 0.3°. The JSON also discloses the wider median absolute deviations of individual segments (up to about 1.44°). Uploaded density is ≥256 px/m; the native source density is lower, so atlas enlargement adds no original scene information. Windows visibly retain frames and sills at 1440×900, with common physical bay/floor scale; this does not certify the original building's exact window dimensions.

A shared CC0 concrete detail normal repeats every 3.5 m at strength 0.08 and fades as UV derivatives grow. Photo texture anisotropy is capped at the device maximum, 16 on this QA device. Distant boxes are 12-triangle impostors: four complete seeded buildings baked offline from the same modules per atlas, with no reflected blocks. Panel, silicate brick and loggia families are visible in default, wide and yaw captures. Series names are visual variants; rejected Valday does not certify an actual 1-335 facade.

## Sources and credits

- **7:** [Domo en strato Fabriĉnaja 17 (Tjumeno).jpg](https://commons.wikimedia.org/wiki/File:Domo_en_strato_Fabri%C4%89naja_17_(Tjumeno).jpg), RG72, CC BY-SA 4.0.
- **8:** [A house at Lenina street (Bor).JPG](https://commons.wikimedia.org/wiki/File:A_house_at_Lenina_street_(Bor).JPG), Андрей Романенко, CC BY-SA 3.0.
- **6:** [Apartment building in Pavlovspy Posad.jpg](https://commons.wikimedia.org/wiki/File:Apartment_building_in_Pavlovspy_Posad.jpg), Stolbovsky, CC BY-SA 3.0.

Rejected for runtime albedo: **11, Valday** (softness, foliage; initial module Laplacian variance 3.46–14.97); **10, Kantemitovskaya** (soft bright windows, unstable floor-line fit); **9, Gastello** (trees/wires crossing loggias). Tyumen replaces the panel335 crops; Pavlovsky Posad replaces tower crops. Retained reference/legacy maps keep their original credits but are not uploaded. The concrete detail derivative uses [Concrete Slab Wall 02](https://polyhaven.com/a/concrete_slab_wall_02), Amal Kumar / Poly Haven, CC0.

All derivatives are inventoried with their actual source IDs and original licences in public/yard/photos/manifest.json and public/yard/SOURCES.md. The modal now fetches photo credits in addition to base yard credits. Civilian car atlas/paint/livery cleanup is unchanged.

## Speckles, exposure and carpet colour

The removed fragment shader mixed a large floating-point sin/hash with interpolated colour seed and abrupt cell choices. The previous rounded seed reduced its sensitivity but retained the fragile fragment selection. Window lighting now uses only baked masks: morphological cleanup, Gaussian filtering, area downsampling, trilinear mip filtering, then a radiance cap of 0.24 per channel. Photo walls use roughness 0.94 and zero metalness; detail-normal strength fades under minification. There is no facade alpha test or per-fragment random window decision. Captures have no visible isolated white/yellow window speckles and the default canvas has **0% clipped pixels**.

No global lighting, exposure or carpet shader was changed. Against the fixed main exposure reference:

| Region | Main reference | Facades2 default | Change |
| --- | --- | --- | --- |
| pad | 0.2162 | 0.2488 | 15.1% |
| lawn | 0.2023 | 0.2055 | 1.6% |
| facade | 0.2356 | 0.2612 | 10.9% |

All regions pass ±20%. The full carpet-colour verifier passes, including Medium→Low→High material replacements, bloom and shadow checks: red medallion hue shift 0.21°, Bukhara 0.28°, Kazak 0.62°; saturation retention 98.3–99.9%; carpet/canvas clipping 0%. [Colour report](colour/after.json).

## Performance and verification

Chrome 155.0.8059.39, headless ANGLE / Direct3D11 on the existing RTX 2080 Ti QA machine, 1440×900, High, seed colour-1986, carpet 09. Optional yard stock and local carpet manifest are blocked in the six requested captures. Baseline was captured before edits against the incoming tree. Each view has 240 warmed samples.

High photo default: **122 draws / 339,470 triangles**; procedural default: **143 draws**. Average of the initial/restored photo default runs compared with the fresh baseline: total CPU **0.055 ms**, submission **0.092 ms**, GPU **-0.393 ms**. Both CPU/GPU regression guards pass ≤0.5 ms. High missing-photos fallback is **144 draws**, with every procedural window batch visible. All quality-mode draw counts are ≤150.

Quality transition snapshots retain existing multi-second shader-compilation stalls; they are not steady frame timings. This acceptance establishes warmed High performance on this device, not universal frame timing on all hardware. [Baseline](baseline.json), [performance and fallback/persistence checks](performance.json). Current photo uploads including RGBA8 mipmaps: **126.7 MiB**; delivered photo directory: **5.91 MiB**. [Texture inventory](assets.json).

Browser: no page/shader errors; photo→procedural→photo restoration, modal selector, storage persistence across reload and unavailable photo assets all passed. `npm test`: 44 files, 300 passed, 12 optional skipped. `npm run build`: passed with the existing chunk-size advisory. `git diff --check`: passed. No commits, stash, checkout, branches or index commands were used.

Six requested captures: [default](photo-default.png), [aim-left](photo-aim-left.png), [aim-right](photo-aim-right.png), [wide](photo-wide.png), [facade close-up](photo-facade-close.png), [car close-up](photo-car-close.png). Procedural/restored defaults and incoming baseline are also retained. Explicit licensed-stock captures and colour probes that can load local stock are ignored.

## Reproduce

Install Python dependencies with `python -m pip install -r scripts/facades-requirements.txt`. Run `node scripts/build-facade-modules.mjs` to regenerate atlases, masks, impostors and independent quality acceptance (cached originals are preferred; Commons originals download if absent). The existing `download-yard-photos.mjs` runs this final builder too. Run Vite on port 5183, then `node docs/qa/facades2/verify.mjs`. For colour QA set `COLOUR_OUT=docs/qa/facades2/colour` and run `node scripts/verify-carpet-colour.mjs after`.

## Decisions

- Use the three sharp unobstructed originals; reject soft/occluded crops and keep their retained-reference attribution.
- Assemble floor/bay modules with seeded upright variation; keep photo and procedural UVs together and preserve window batches for reversible switching.
- Bake window decisions before filtering and cap emission locally; retain global exposure and carpet colour treatment.
- Use 2k near atlases, a shared 3.5 m CC0 detail normal and baked 1k distant impostors to stay inside the draw/frame budgets.
- Report dominant-axis alignment separately from individual-edge deviation and native versus uploaded density.
