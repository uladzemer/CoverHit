# Golden-hour lighting follow-up — 2026-10-09

The sunset horizon is orange into pink, sunlit facades and the wool/fringe are
warm, and the 10° sun casts soft diagonal shadows toward camera-right. The
sun is behind the default camera's left shoulder. The HDR solar peak is rotated
to that source direction; a separate broad atmospheric horizon glow preserves
the warm sky behind the buildings. The visible sky stays upright.

## Comparisons

Left: incoming previous-pass state. Right: this follow-up. Same 800 × 700
viewport, seed, quality tiers and default/wide/close camera coordinates as the
first lighting QA run.

| Quality | Default | Wide courtyard | Carpet close-up |
| --- | --- | --- | --- |
| High | [Compare](compare-high-default.png) | [Compare](compare-high-wide.png) | [Compare](compare-high-close.png) |
| Medium | [Compare](compare-medium-default.png) | [Compare](compare-medium-wide.png) | [Compare](compare-medium-close.png) |
| Low | [Compare](compare-low-default.png) | [Compare](compare-low-wide.png) | [Compare](compare-low-close.png) |

The original warm reference from `../lighting/before-*.png` is also compared
directly against this follow-up (original left, final right):

| Quality | Default | Wide courtyard | Carpet close-up |
| --- | --- | --- | --- |
| High | [Original vs final](compare-original-high-default.png) | [Original vs final](compare-original-high-wide.png) | [Original vs final](compare-original-high-close.png) |
| Medium | [Original vs final](compare-original-medium-default.png) | [Original vs final](compare-original-medium-wide.png) | [Original vs final](compare-original-medium-close.png) |
| Low | [Original vs final](compare-original-low-default.png) | [Original vs final](compare-original-low-wide.png) | [Original vs final](compare-original-low-close.png) |

All 18 before/after captures and 18 composites are local PNGs, gitignored under
the same licensed-asset convention as the first pass. Cloth, foliage and camera
sway remain live across views. The High default shadow diagnostic freezes the
pose for its two captures.

Baseline provenance: the incoming worktree already contained the previous
lighting pass as modified/untracked files. `before-*` was freshly captured
before any follow-up lighting edits and represents that exact incoming state
(the previous run's “after”). It is not a reconstruction of a clean HEAD
checkout. Only `git status`/`git diff` were used; no checkout or stash.

## Lighting and preserved rendering features

- Source elevation 10°, constrained HDR temperature 3500 K, direct intensity
  6.0. A 2 m rack projects an 11.34 m ground shadow. Source is approximately
  (-0.739, 0.174, 0.651); horizontal shadows run along (+X, -Z).
- Orange/pink sky and warm fog replace the blue all-azimuth HDR average. A
  photographic warm white balance applies to HDR diffuse fill, including the
  carpet's fringe and thickness strip. A stronger warm LUT keeps highlights
  warm with only a small cool contribution in deep shadows.
- HDR environment intensity 1.35. Ground environment multipliers 0.25 retain
  visible direct-sun/shadow contrast; facades retain 0.85 and wool 0.95 so shade
  stays readable. Existing warm ground bounce remains.
- Imported tree/birch meshes and alpha-tested chain-link fences now cast real
  shadows on High/Medium. Nearby buildings, rack, cloth and fringe keep theirs.
  Decorative perimeter facade LODs retain their intended exclusion from the
  play-area shadow pass: overlapping skyline shells at this low elevation
  otherwise blanket the courtyard. Low restores the incoming caster settings.
- PCSS blocker search/filter counts, CSM splits/map sizes/biases, Medium PCF,
  N8AO and the baked contact atlas are preserved. Bloom threshold remains 1.0,
  intensity 0.075; wool sheen remains 0.25. No new postprocessing passes or
  shadow maps. High's angular penumbra scale is reduced from 0.0093 to 0.00465
  so long thin post/fence shadows remain legible while still softening with
  separation. Low keeps its original material/fill/postprocessing settings.

## Verification

[before.json](before.json) and [after.json](after.json) contain complete GPU/CPU
timings, draw counts, lighting settings and browser errors. Hardware-backed
headless Chrome, ANGLE/D3D11 on RTX 2080 Ti, DPR 1, 240 live frames per quality.
GPU elapsed queries surround the complete composer and shadow rendering.

| Quality | Before GPU mean / p95 (ms) | After GPU mean / p95 (ms) | Mean change | Budget |
| --- | ---: | ---: | ---: | --- |
| High | 7.96 / 11.18 | 8.63 / 12.07 | +0.66 ms | Pass: ≤ +2 ms |
| Medium | 8.86 / 9.68 | 8.66 / 10.39 | −0.20 ms | Pass: ≤ +1 ms |
| Low | 6.40 / 8.23 | 7.55 / 8.52 | +1.16 ms | Incoming settings retained |

GPU time varies across captures, including unchanged Low. Final High/Medium
shadow-inclusive draw counts are 324 / 325 versus 331 / 332 before. There were
zero page/shader errors. The sampled sky red/blue ratio is 1.405 versus 1.056
in the original warm reference. The frozen 140 × 40 foreground-pad patch has
543 pixels darkened by more than 8 RGB levels when real sun shadows are enabled.

The verifier asserts High ≤ +2 ms and Medium ≤ +1 ms against the freshly
captured incoming baseline. It also exercises quality changes and replacement
carpets, checks sheen and Low restoration, compares an exposed sky patch's
red/blue ratio against the original warm reference, and requires real shadows
on the default foreground pad.

[Shadow-off diagnostic](diagnostic-high-default-no-shadows.png) retains all AO,
lighting, grading and the identical camera/cloth pose, while setting CSM shadow
intensity to zero. [Shadow difference ×5](diagnostic-shadow-difference.png)
shows the long diagonal shadows separately from texture cracks and contact AO.

`npm test`: 244 tests in 33 files pass, including HDR/source alignment,
HDR-missing warm-sky fallback, long-shadow projection and repeated Low caster/
material restoration. Browser QA exits successfully with all GPU, sky and
foreground-shadow assertions passing.
`npm run build`: passes; the existing large-bundle advisory remains.

Reproduce with Vite on `127.0.0.1:5183`:

```powershell
$env:LIGHTING_OUT = 'docs/qa/lighting2'
node scripts/verify-lighting.mjs before # incoming implementation, before edits
# Edit lighting, then restart Vite (this worktree is excluded from its watcher).
$env:LIGHTING_ORIGINAL = 'docs/qa/lighting'
node scripts/verify-lighting.mjs after
npm test
npm run build
```

`LIGHTING_URL` and `CHROME_PATH` remain available for server/browser overrides.
