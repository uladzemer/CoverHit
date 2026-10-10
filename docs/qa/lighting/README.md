# Courtyard lighting pass — 2026-10-09

Before is on the left; after is on the right. Each original capture is 800 ×
700. PNGs are local and gitignored because licensed yard/carpet assets appear.

| Quality | Default | Wide courtyard | Carpet close-up |
| --- | --- | --- | --- |
| High | [Compare](compare-high-default.png) | [Compare](compare-high-wide.png) | [Compare](compare-high-close.png) |
| Medium | [Compare](compare-medium-default.png) | [Compare](compare-medium-wide.png) | [Compare](compare-medium-close.png) |
| Low | [Compare](compare-low-default.png) | [Compare](compare-low-wide.png) | [Compare](compare-low-close.png) |

All 18 original captures and nine side-by-side composites are in this directory.
Live cloth, laundry and camera sway cause small pose differences between runs.

## Performance and validation

Hardware-backed headless Chrome, RTX 2080 Ti via ANGLE/D3D11, DPR 1, 800 × 700.
240 live frames per quality after warm-up, measured with
EXT_disjoint_timer_query_webgl2 around the entire composer including shadows.

| Quality | Before GPU mean / p95, ms | After GPU mean / p95, ms | Mean change | Budget |
| --- | ---: | ---: | ---: | --- |
| High | 9.85 / 10.86 | 9.49 / 12.58 | −0.36 ms | Pass: ≤ +2 ms |
| Medium | 8.76 / 9.38 | 8.89 / 10.11 | +0.12 ms | Pass: ≤ +1 ms |
| Low | 7.62 / 8.94 | 8.10 / 9.45 | +0.47 ms | Original rendering settings retained |

Low's measured time varies despite the same shadow, material, fill and post
settings. These are measurements on this machine, not a sustained-frame-rate
guarantee. CPU frame means are 18.09 / 16.67 / 15.59 ms (High / Medium / Low).
See [before.json](before.json) and [after.json](after.json) for GPU/CPU statistics,
draw calls and lighting state. High/Medium add about 23 shadow draws for distant
building solids; Low keeps the original draw count. No additional post passes.

- `npm test`: 243 tests in 33 files pass, including HDR peak alignment and
  repeated High/Medium/Low material and fill restoration.
- `npm run build`: passes; existing bundle-size advisory remains.
- Browser verification: zero page/shader errors, nine after captures,
  repeated quality switching, wool sheen/restored foliage emissive assertions,
  and replacement-carpet shader compilation. GPU budgets are asserted.

Reproduce against Vite at `127.0.0.1:5183` with
`node scripts/verify-lighting.mjs before`, edit lighting, restart Vite, then
`node scripts/verify-lighting.mjs after`. `LIGHTING_URL` and `CHROME_PATH` override
the server and browser. Restart is necessary in this `.claude` worktree because
Vite's watch exclusion suppresses scene changes. Before captures must be taken
with the original implementation; the verifier does not reconstruct old code.

## Decisions

- The actual HDR peak is at 2.197° elevation with clipped red radiance. Locate
  it in the float HDR, align its azimuth to the courtyard's western sun, then
  rotate elevation to 12°. Bound the channel-ratio temperature estimate to
  3500–4000 K; this HDR selects 3500 K. Use corresponding linear RGB for CSM.
  This is a constrained photographic estimate, not measured colour temperature.
- Preserve an upright visible courtyard skyline: display a sky gradient from
  HDR horizon/upper-sky samples plus the aligned solar disc. The HDR's photographed
  terrain and trees are unsuitable as the visible Soviet courtyard background.
  The rotated HDR PMREM supplies all normal sky illumination; hemisphere and
  front directional fill are zero on High/Medium. If the HDR is missing, allow
  a limited 0.2 hemisphere fallback to keep the game readable.
- Balance direct sun at 2.5 and environment at 1.45 in the existing normalized
  lighting units. Material environment multipliers: metal 0.65, foliage 0.55,
  wool 0.95, plaster/asphalt/other diffuse surfaces 0.85. Remove non-source
  foliage, grass, sand and rack emissive on High/Medium.
- High uses blocker search, separation-dependent penumbra and disk filtering
  following [Three's r186 PCSS example](https://github.com/mrdoob/three.js/blob/r186/examples/webgl_shadowmap_pcss.html).
  Adapt it to native depth textures and orthographic CSM: eight blocker samples,
  twelve filter samples, angular radius 0.0093, frustum width/depth scaling per
  cascade. Preserve the 8 / 40 / 220 m splits and map sizes. Bias is −1 mm in
  shadow-depth units; normal biases are 3 / 12 / 40 mm across the three cascades.
  Recompute the scale on resize. Enable distant box facades to cast long shadows.
- Medium uses r186's hardware PCF with radius 2.5 texels. **PCFSoftShadowMap was
  removed in r186** and aliases PCF with a warning; the wider compatible PCF
  filter implements the requested soft Medium shadows without that warning.
- N8AO: 0.22 m radius, 0.85 falloff, 0.65 intensity; full resolution High and
  half resolution Medium. Keep existing local contact decals and cloth layer AO.
  Add a cached startup lightmap from twelve hemisphere rays per texel against
  conservative static bounds. Its 128² atlas spans 170 × 150 m, so fine posts
  rely on N8AO; buildings and bench/curb contact receive the broader baked term.
  Use proxy boxes rather than introducing a BVH dependency for decorative cards.
- Add a small warm, height-faded diffuse ground bounce in world space. Shadow
  colour comes from HDR illumination; direct visibility does not tint shadows
  artificially. The bake/bounce shader is absent on Low.
- Bloom threshold 1.0, smoothing 0.1, mipmap blur, intensity 0.075. Lit windows
  and active lamp surfaces use emissive 2.4. Sun, windows and lamps retain glow;
  ordinary surface emissive is removed. Omit optional god rays: no atmospheric
  scattering volume justifies shafts here, and no extra GPU pass is necessary.
- Retain Neutral, exposure 1.02 and the gentle existing LUT. Remove vignette;
  add no chromatic aberration. Retain world-scaled plaster/asphalt normal and
  roughness scans, soften normal strength, raise dry roughness to 0.95 / 0.94,
  and slightly darken/lower roughness within 0.75 m of plaster wall bases.
- Wool uses MeshPhysicalMaterial sheen 0.25, sheen roughness 0.85, plus existing
  pile bump and cloth AO. New carpets receive these settings. Low restores zero
  sheen, original surfaces/emissive, original sky/sun/fill, single-cascade PCF,
  and its existing AO/bloom/grade bypass.
