# Third-party notices

The project's own code is MIT, copyright uladzemer 2026 (see [LICENSE](LICENSE)).
That licence does not replace the following asset and dependency licences.
Courtyard field recordings in `public/audio/` are CC0, CC BY 2.5/3.0/4.0 or public domain: foongaz (playground), Joseph Sardin and *ngoomie (house sparrows), cori / Cori Samuel (street ambience), Neumann C, Agil M, Widdig A and Engelhardt A (dog bark), Gravity Sound (swing and door), Glaneur de sons (tram), and ezwa (window). Every source URL, licence URL and derivative operation is listed in `public/audio/SOURCES.md` and `public/audio/credits.json`, also loaded by the in-game About modal. Clips are excerpts, mono conversions and loudness-normalised AAC/Opus derivatives; the traffic loop has a 1.5-second crossfade. These recordings evoke a fictional courtyard; their original recording locations are not claimed to be Soviet/Russian.

| Material | Location | Licence / attribution |
| --- | --- | --- |
| Museum carpet scans | `assets-src/carpets/`, `public/carpets/` | The Metropolitan Museum of Art, CC0; per-object titles, credits and URLs in [SOURCES.md](assets-src/carpets/SOURCES.md) and `public/carpets/manifest.json` |
| Painting sources for tapestry authoring | `assets-src/carpets/` | Public domain; Ivan Shishkin, Konstantin Savitsky and Viktor Vasnetsov; per-work URLs in [SOURCES.md](assets-src/carpets/SOURCES.md). Source inventory also includes disabled/non-shipping designs. |
| Ground and wall maps, HDR | `public/yard/` | Poly Haven, CC0 1.0; Rob Tuytel, Charlotte Baglioni, Amal Kumar, eye-candy.xyz, Sergej Majboroda, Dario Barresi and other per-file credits in [SOURCES.md](public/yard/SOURCES.md). The earlier Tree Small 02 model was retired; current foliage and tree geometry are original procedural artwork. |
| Car and facade photographs and derivatives | `public/yard/photos/` | CC0, public domain, CC BY 3.0, CC BY-SA 3.0 and CC BY-SA 4.0; exact authors and source URLs in [credits.json](public/yard/photos/credits.json); delivered-file mappings and processing in [SOURCES.md](public/yard/SOURCES.md) and `photos/manifest.json` |
| Smoke flipbook | `public/fx/dust-flipbook.webp` | Kenney, CC0 1.0, [Smoke Particle Assets](https://opengameart.org/content/smoke-particle-assets); 16-frame resampled atlas, details in [SOURCES.md](public/fx/SOURCES.md) |
| Lite image derivatives | `public/lite/yard/`, `public/lite/carpets/` | Resized/re-encoded copies of the corresponding public assets above, with the same authors, source URLs and licences. `scripts/build-lite-assets.mjs` excludes local licensed stock. |
| Ammo.js / Bullet | `public/vendor/ammo/` | zlib, copyright 2011 ammo.js contributors; unchanged vendored loader/WASM, [licence text](public/vendor/ammo/LICENSE.txt) |
| three.js 0.186.1 | npm `three` | MIT, copyright 2010–2026 three.js authors; installed `three/LICENSE` |
| postprocessing 6.39.5 | npm `postprocessing` | Zlib, copyright 2015 Raoul van Rüschen; installed `postprocessing/LICENSE.md` |
| N8AO 2.0.1 | npm `n8ao` | N8python; package metadata declares ISC, while the distributed `n8ao/LICENSE` contains CC0 1.0. Both are recorded here without relabelling the package. |
| GSAP 3.15.0 | npm `gsap` | GreenSock Standard “no charge” licence, as declared by the installed package; [terms](https://gsap.com/standard-license). This is a separate licence, not MIT. |

## Photograph derivatives

The photograph inventory credits Fiver, der Hellseher; Roman Balabin; RG72;
Андрей Романенко; Stolbovsky; Дмитрий Cкляренко; Homoatrox; Artyom Vasilyev;
Arzamassky; Retired electrician; and Bull-Doser. The complete source title,
URL and versioned licence for each is retained in `public/yard/photos/credits.json`
and shown in the game's credits. That inventory includes earlier sources as well as current artwork.

Perspective rectification, crop, colour adjustment, wall/window compositing and
car silhouette/alpha cleanup create derivatives. CC BY 3.0 derivatives retain
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/); they do not impose ShareAlike.
CC BY-SA 3.0 derivatives retain [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/),
and CC BY-SA 4.0 derivatives retain [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Mixed car derivatives containing Fiver's photographs are CC BY-SA 4.0.
Current Klumava/panel335 derivatives credit Homoatrox under CC BY-SA 4.0;
earlier Valday work credits Дмитрий Cкляренко under CC BY 3.0.
CC0 and public-domain originals remain identified individually; the concrete
atlas contribution credits Amal Kumar / Poly Haven (`concrete_slab_wall_02`, CC0).
Lite resizing/re-encoding preserves these same derivative conditions.

## Local-only material

Envato Elements photographs and models carry the owner's personal licence and
are not supplied by this repository or ordinary public builds. The ignored
`assets-src/**/envato/`, `public/carpets/envato-*`, local carpet manifest and
`public/yard/stock/` are excluded from normal `dist/` by `scripts/stock-build.mjs`.
Optional personal builds require an explicit include switch and must not be published.
Procedural replacements and museum scans support play without them.

## Shader diagnostics

The project's PCSS blocker and filter loops use explicit `textureLod(..., 0.0)`
for WebGL2 depth sampling. Dust atlas lookups have no varying iteration loops.
Unmodified N8AO 2.0.1 `PoissionBlur.js` contains implicit texture sampling in its
sample loop, and postprocessing supplies its own effect shaders. ANGLE/D3D
X3595 diagnostics attributable to those dependencies are retained, not suppressed.
The release probe ties the remaining X3595 to N8AO `PoissionBlur.js` and X4122
constant-precision diagnostics to three.js `PMREMGGXConvolution` (PMREMGenerator).
It records those unmodified third-party programs separately from project warnings.
