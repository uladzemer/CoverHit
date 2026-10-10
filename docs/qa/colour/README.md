# Carpet colour and sunset QA

The carpet retains its scan colours while the courtyard keeps the warm sunset grade. Textile diffuse lighting has its own exposure and nearly neutral white balance, zero sheen, and very low additive specular. Its opaque alpha coverage mask excludes incoming bloom, neutral tone mapping (which desaturated dark dyes), and the warm LUT. N8AO preserves the mask; the final SMAA pass restores opaque alpha on every quality level, including Low where the LUT is disabled. No extra geometry pass is needed in production. Dirt and cloth layer occlusion still apply.

The sun is 7.5 degrees above the horizon behind-left of the rack: a 2 m object casts a 15.2 m ground shadow toward the camera. CSM splits are 14 / 55 / 220 m to retain foreground and midground casters. High retains the PCSS blocker search and soft penumbra. Background exposure is 0.85.

Run a Vite development server on port 5183, then:

```powershell
node scripts/verify-carpet-colour.mjs after
```

Override COLOUR_URL, COLOUR_OUT, or CHROME_PATH if needed. The script uses the 1000 x 800 default viewport, High quality, seed colour-1986, and clean cloth. It freezes the default camera and cloth pose. It renders an unlit scan reference at exactly the same visible UVs with sRGB decoding/encoding and texture filtering, rather than comparing the visible half of a folded carpet to the entire scan. Other geometry still occludes it; the mask is eroded by two pixels to reject silhouette mixing. This reference is diagnostic only. The scan reference always writes opaque alpha, so the production coverage mask cannot contaminate the measurement.

Hue is a saturation-weighted circular mean in degrees; saturation is mean HSV saturation; luminance is mean Rec.709-weighted sRGB code value on [0,1]. Histograms have 256 luminance bins. Clipping means any channel equals 255. Whole-view values sample the canvas, excluding HTML HUD overlays. Separate masks identify sky and facade pixels.

| Carpet | Hue shift before -> after (degrees) | Saturation / source before -> after | Source luminance | Rendered luminance before -> after | Carpet clipping before -> after |
| --- | ---: | ---: | ---: | ---: | ---: |
| red medallion (01) | 3.95 -> 0.21 | 163.0% -> 98.6% | 0.2373 | 0.3118 -> 0.2217 | 0% -> 0% |
| bukhara (03) | 8.31 -> 0.29 | 110.4% -> 100.0% | 0.1219 | 0.2075 -> 0.1127 | 0% -> 0% |
| Kazak (09) | 12.60 -> 0.65 | 133.3% -> 98.9% | 0.1857 | 0.2743 -> 0.1758 | 0% -> 0% |

All three meet hue <= 6 degrees, saturation >= 85%, and carpet clipping < 0.5%. The script also rejects textile luminance outside 85-110% of its scan reference. Whole-view clipping is 0% before and after; sky and facade clipping are separately 0% after. The baseline whole-view zero implies zero clipping for its sky/facade subsets as well.

- red medallion: 61,251 of 155,967 foreground ground pixels darken by >8 when shadows are enabled; mean darkening 7.79/255. Bloom on/off maximum carpet channel difference 1/255; mean 0.000006/255 (quantization tolerance).
- bukhara: 55,584 of 140,552 foreground ground pixels darken by >8 when shadows are enabled; mean darkening 7.78/255. Bloom on/off maximum carpet channel difference 1/255; mean 0.000013/255 (quantization tolerance).
- Kazak: 56,227 of 157,937 foreground ground pixels darken by >8 when shadows are enabled; mean darkening 7.21/255. Bloom on/off maximum carpet channel difference 1/255; mean 0.000089/255 (quantization tolerance).

The script checks all colour/clipping thresholds, at least 10% of foreground ground pixels with shadow darkening >8, bloom spill <=1/255, shader errors, and repeated Medium -> Low -> High switches with fresh carpet materials. The quality captures also check centre-carpet luminance, which caught and guards against pale output when the coverage alpha is not restored on Low.

Screenshots: `before-{01,03,09}-default.png`, `after-{01,03,09}-default.png`, and side-by-side `compare-{01,03,09}.png` (before left, after right). The `source`, `mask`, `sky`, `facades`, `ground`, and `no-shadows` captures document sampling and shadow coverage. Replacement screenshots cover all three quality levels. All PNGs here are ignored because the courtyard can contain locally licensed stock. JSON measurements and this report are tracked.

Validation: `npm test`: 33 files, 245 tests passed. `npm run build` passed; the existing bundle-size warning remains. No physics/performance-owned files were modified.
