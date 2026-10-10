# Optional licensed courtyard models

Verified 2026-10-09 in hardware headless Chrome 155.0.8059.39 at 1468 × 986,
NVIDIA GeForce RTX 2080 Ti / ANGLE Direct3D11. Eight models loaded, eight conditional
model credits, zero browser errors. `performance.json` contains 180-frame samples
per view, CPU/physics timings and missing/HTML/invalid/malformed/partial-model
fallback results. Frame interval is observed browser timing, not a GPU timer.

| View | Max draws | Max triangles | Mean CPU frame | Mean frame interval |
| --- | ---: | ---: | ---: | ---: |
| Default | 118 | 500,671 | 11.96 ms | 18.25 ms |
| Wide | 118 | 501,005 | 11.68 ms | 18.27 ms |
| Garages | 103 | 425,287 | 11.43 ms | 18.25 ms |

Local screenshots: `default.png`, `wide.png`, `garages.png`. These contain licensed
models and are deliberately ignored. Run Vite on port 5180, then
`node scripts/verify-yard3.mjs` to reproduce; `YARD_URL` and `CHROME_PATH` override
the defaults. Restart Vite after importing new public files or editing source
in a checkout covered by the repository's `.claude` watcher exclusion.

| Model | Source → GLB | Original tris | Final tris | GLB MB | Calibrated W × H × D (metres) |
| --- | --- | ---: | ---: | ---: | --- |
| Balcony block | OBJ + MTL | 1,422 | 1,422 | 0.078 | 68.227 × 17 × 21.232 |
| Horizon panel block | OBJ + MTL | 1,233 | 1,233 | 0.282 | 33.323 × 27 × 14.501 |
| Garage | FBX | 15,598 | 15,598 | 1.011 | 16.308 × 2.6 × 5.053 |
| Deciduous tree | FBX | 74,505 | 14,342 | 3.764 | 7.259 × 9 × 7.392 |
| Birch | FBX 6.1 rejected → OBJ + MTL + crown cards | 611,113 | 20,803 | 1.265 | 6.299 × 10 × 6.548 |
| Bench | FBX | 2,132 | 2,132 | 0.825 | 1.4 × 0.9 × 0.599 |
| Lamp | FBX | 5,970 | 5,970 | 0.787 | 0.339 × 5.4 × 1.914 |
| Dumpster | FBX 6.1 rejected → OBJ + MTL | 11,794 | 5,759 | 0.270 | 1.868 × 1.4 × 1.2 |

Sizes are height-based physical calibrations, not surveyed dimensions from the
authors. Polygons advertised by the catalog differ from triangulated meshes.
GLB sizes use decimal MB; all model origins are at ground/base centre with Y up.
Textures are at most 1024px (2048px allowed for buildings) and embedded WebP.
Exact provenance links and warnings are in ignored `public/yard/stock/` manifests.

Decisions:

- Keep the detailed procedural panel/brick courtyard facades nearest the camera.
  The supplied TurboSquid archives omit the facade/balcony/cornice/air-conditioner
  textures referenced by their MTLs; only the panel archive's ground JPG exists.
  Retain their source colours and place the balcony model behind the nearest
  block, with the taller panel models on the far horizon. Missing baked textures
  limit their appearance; they cannot substitute for the detailed near facade.
- Prefer GLB/glTF, then FBX, then OBJ+MTL. three's Node parsers intercept texture
  loading to avoid DOM and external requests. FBX 6.1 falls back to OBJ.
  Only validated extracted paths can supply textures or glTF resources.
- Deduplicate, weld and join before meshoptimizer simplification; compact unused
  vertices afterward. The standard transforms follow the
  [glTF Transform simplify](https://gltf-transform.dev/modules/functions/functions/simplify)
  and [WebP texture](https://gltf-transform.dev/modules/functions/functions/textureCompress)
  APIs. Keep the stock deciduous alpha-tested leaf atlas.
- Ordinary birch decimation stops above budget. Preserve the original foliage
  distribution, replace the crown with 6,500 two-leaf cards baked from its own
  leaf JPEG, flood-fill the flat green background into alpha, and reduce the
  split-vertex trunk/branches with meshoptimizer's spatial simplifier. Final
  count is 13,000 card triangles plus 7,803 trunk/branch triangles. Sampling
  the original crown avoids retaining only the top after decimation.
- Correct source UV V orientation for glTF. Two long multi-door garage instances
  form the row. Three deciduous and three birch instances replace six trees;
  four procedural trees remain as filler. Shared geometry/material instances
  keep draw calls below 130. Distant buildings/stock trees do not cast dynamic
  shadows; nearby furniture and garages do.
- Move dumpsters and lamps toward the service edge; omit the lamp's separate
  English bus-lane sign primitive. Add warm, unshadowed point lights to two
  lamps. Preserve the sky/HDR sun alignment, camera and collision bar.
- Only successfully loaded stock models enter the credits panel as
  `Envato Elements, <item title>`. Archive scripts and BLEND files are ignored;
  absolute/traversal paths and symlinks are rejected, with extraction size limits.

Validation: 150 tests passed, including actual archive traversal rejection,
GLB/glTF fixture conversion, manifest/fallback handling, gitignore coverage and
default/opt-in distribution filters. The standard build passed with stock
present; an actual opt-in Vite build retained stock in an ignored QA output.
Tests and the standard build also run with `public/yard/stock/` physically moved
out of public, then restored. Default `dist/yard/stock/` is absent.

Unfinished/source limitation: the two building archives do not supply their
advertised baked facade textures. Full textured near-building substitution
requires those missing source files. The courtyard remains a game scene;
the procedural car, remaining facades and foliage cards still show CG cues.
