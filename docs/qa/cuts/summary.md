# Carpet cut audit — 2026-10-10

Before sheets were captured from the original shipped textures before any cut changes. Each sheet contains 16 crops: four positions per side, 6% of the perpendicular image dimension deep, enlarged exactly 3× (nearest neighbour). Disabled after sheets are clearly marked diagnostics, never shipped assets.

Leakage is CIE76 ΔE < 12 against smooth surround clusters, measured on every decoded pixel of the outer four rows/columns and the next eight. The same surround model is used for both stages. Photographic-frame clusters require support immediately outside the rug. Full-bleed stock has no visible background and therefore no leakage model: zero means no known background, not proof that the original whole rug exists. Its complete reviewed inner/outer frames are preserved.

Straightness before is RMS distance of detected local boundary points to the old cut lines divided by side length (untrimmed). After is the trimmed RANSAC/TLS boundary-fit residual, not the inward distance between the safe crop and the original irregular edge. The safe output rectangle itself has perfectly straight sides and 90° corners. These are different measurements: bowed originals cannot retain every fibre and also have a straight rectangular cut. Insets and manual overrides are recorded in public/carpets/cuts.json and config. No claim of sub-0.25% full untrimmed boundary agreement is made.

| Carpet | Outer before → after | Next 8 before → after | Boundary residual before → fitted after | Corner error before → after | Border L/R/T/B before → after (source px) | L/R, T/B after mismatch | Choice |
|---|---:|---:|---:|---:|---|---|---|
| 01 | 57.6241% → 0.0000% | 21.5888% → 0.0000% | 1.8410% → 0.2159% | 0° → 0° | 230.0/228.8/219.2/179.0 → 209.3/208.0/214.3/194.7 | 0.5865%, 9.5808% | automatic line fit |
| 02 | 41.8828% → — | 34.5374% → — | 0.0000% → — | 0° → — | 267.4/237.1/270.7/260.6 → — | —, — | disabled |
| 03 | 1.0247% → 0.0000% | 0.0210% → 0.0000% | 1.4283% → 0.1211% | 0° → 0° | 152.0/155.0/90.0/56.0 → 155.0/156.0/78.0/45.0 | 0.6431%, 53.6585% | fit sides / reviewed woven ends |
| 04 | 12.6105% → 0.0000% | 9.0718% → 0.0000% | 0.5702% → 0.1264% | 0° → 0° | 152.7/133.3/16.3/113.0 → 155.8/123.4/10.1/111.2 | 23.1884%, 166.6667% | fit sides / reviewed woven ends |
| 05 | 58.0615% → 0.0000% | 43.6243% → 0.0000% | 1.6345% → 0.1613% | 0° → 0° | 96.2/89.5/51.9/40.9 → 56.4/62.9/33.6/27.1 | 10.9091%, 21.4286% | manual inward envelope |
| 06 | 48.3441% → 0.0000% | 23.5681% → 0.0084% | 2.1563% → 0.1674% | 0° → 0° | 176.6/174.2/148.3/107.1 → 150.2/150.2/102.8/79.1 | 0.0000%, 26.0870% | manual inward envelope |
| 07 | 19.8027% → 0.0000% | 12.8940% → 0.0000% | 1.8662% → 0.1716% | 0° → 0° | 225.0/178.4/330.7/360.3 → 192.6/163.8/314.4/343.2 | 16.1491%, 8.7542% | manual inward envelope |
| 08 | 34.2540% → 0.0000% | 26.4902% → 0.0022% | 1.4399% → 0.1811% | 0° → 0° | 154.0/150.4/137.0/133.4 → 124.4/127.9/88.7/86.4 | 2.7397%, 2.6316% | manual inward envelope |
| 09 | 25.6492% → 0.0000% | 20.4186% → 0.0000% | 1.9096% → 0.1268% | 0° → 0° | 241.1/229.4/291.5/204.9 → 216.2/214.0/224.0/190.4 | 1.0417%, 16.2162% | manual inward envelope |
| 10 | 62.2687% → 0.0000% | 55.1443% → 0.0000% | 2.1953% → 0.2132% | 0° → 0° | 208.1/209.2/120.9/122.1 → 165.2/165.2/86.0/86.0 | 0.0000%, 0.0000% | manual inward envelope |
| envato-2K7L5EB | 67.8832% → — | 64.9240% → — | 1.5205% → — | 0° → — | — → — | —, — | disabled |
| envato-6325SWE | 0.0000% → 0.0000% | 0.0000% → 0.0000% | 0.0000% → 0.0000% | 0° → 0° | 515.7/442.4/682.9/665.3 → 512.5/442.2/685.4/664.9 | 14.7239%, 3.0369% | full-bleed prior (no visible background) |
| envato-B7PV8QR | 0.0000% → 0.0000% | 0.0000% → 0.0000% | 0.0000% → 0.0000% | 0° → 0° | 390.8/378.9/444.7/423.8 → 384.6/372.7/444.4/423.5 | 3.1496%, 4.8110% | full-bleed prior (no visible background) |
| envato-EPRJ58X | 0.0000% → 0.0000% | 0.0000% → 0.0000% | 0.0000% → 0.0000% | 0° → 0° | 674.6/686.3/752.3/654.8 → 674.3/693.7/752.4/655.0 | 2.8490%, 13.8504% | full-bleed prior (no visible background) |
| envato-QSMGCAP | 29.2492% → — | 28.7970% → — | 1.0912% → — | 0° → — | — → — | —, — | disabled |
| envato-RBFEDY2 | 0.0000% → 0.0000% | 0.0000% → 0.0000% | 0.0000% → 0.0000% | 0° → 0° | 178.8/180.4/137.3/137.3 → 178.6/180.2/137.2/137.2 | 0.8889%, 0.0000% | full-bleed prior (no visible background) |
| envato-T834FYR | 0.0000% → 0.0000% | 0.0000% → 0.0000% | 1.9143% → 0.1910% | 0° → 0° | 317.6/366.8/665.3/643.4 → 298.9/353.3/652.2/630.5 | 16.6667%, 3.3898% | manual prior |

## Decisions and limits

- **01**: shipped Original handmade/worn design is asymmetric; preserve the woven design rather than deleting intact motifs to force 3% equality.
- **02**: Disabled: uneven worn boundary against beige display mat cannot satisfy literal colour-only DeltaE<12 leakage without deleting woven border; wooden photo frame also confounds automatic segmentation. 
- **03**: Keep reviewed patterned woven ends; reject plain kilim bands and fringe. Original handmade/worn design is asymmetric; preserve the woven design rather than deleting intact motifs to force 3% equality.
- **04**: Keep reviewed patterned woven ends; reject plain kilim bands and fringe. Original handmade/worn design is asymmetric; preserve the woven design rather than deleting intact motifs to force 3% equality.
- **05**: Reviewed straight inward envelope of bowed/worn woven boundary; original corners retained as fallback prior. Original handmade/worn design is asymmetric; preserve the woven design rather than deleting intact motifs to force 3% equality.
- **06**: Reviewed straight inward envelope of bowed/worn woven boundary; original corners retained as fallback prior. Original handmade/worn design is asymmetric; preserve the woven design rather than deleting intact motifs to force 3% equality.
- **07**: Reviewed straight inward envelope of bowed/worn woven boundary; original corners retained as fallback prior. Original handmade/worn design is asymmetric; preserve the woven design rather than deleting intact motifs to force 3% equality.
- **08**: Reviewed straight inward envelope of bowed/worn woven boundary; original corners retained as fallback prior. 
- **09**: Reviewed straight inward envelope of bowed/worn woven boundary; original corners retained as fallback prior. Original handmade/worn design is asymmetric; preserve the woven design rather than deleting intact motifs to force 3% equality.
- **10**: Reviewed straight inward envelope of bowed/worn woven boundary; original corners retained as fallback prior. 
- **envato-2K7L5EB**: Fragment without complete outer rug border; excluded from whole-rug rotation. 
- **envato-6325SWE**: Photograph contains woven cloth up to its frame; no visible floor/wall/studio background to model. Retain reviewed enclosing frame. Original handmade/worn design is asymmetric; preserve the woven design rather than deleting intact motifs to force 3% equality.
- **envato-B7PV8QR**: Photograph contains woven cloth up to its frame; no visible floor/wall/studio background to model. Retain reviewed enclosing frame. Original handmade/worn design is asymmetric; preserve the woven design rather than deleting intact motifs to force 3% equality.
- **envato-EPRJ58X**: Photograph contains woven cloth up to its frame; no visible floor/wall/studio background to model. Retain reviewed enclosing frame. Original handmade/worn design is asymmetric; preserve the woven design rather than deleting intact motifs to force 3% equality.
- **envato-QSMGCAP**: Fragment without complete outer rug border; excluded from whole-rug rotation. 
- **envato-RBFEDY2**: Photograph contains woven cloth up to its frame; no visible floor/wall/studio background to model. Retain reviewed enclosing frame. 
- **envato-T834FYR**: Reviewed inward envelope preserves the kilim border and already removes the studio white; automatic fit moves outward into bowed edges. Original handmade/worn design is asymmetric; preserve the woven design rather than deleting intact motifs to force 3% equality.

- Manual inward envelopes on 05/06/07/08/09/10 exceed the preferred 1.2% in places (09 top ≈3.3%, 10 left ≈3.6% of original dimension). These explicit overrides remove the bowed outer sliver. The leakage search stays within 0.3–1.2%; symmetry balancing and aspect-preserving inward cuts can add more. Original corners remain untouched as fallback priors. This is a documented deviation from the target, not an automatic fit success.
- Independently reviewed symmetric pairs (01/03/06/09 L/R, 08/10 both) are balanced by small inward cuts to ≤3%. Other pairs keep the original asymmetry. 01/06/07/08/10 also receive paired inward cuts to aspect ratios .5/.656/1.391/20÷34/.549 so existing grid selection remains within its square-cell tolerance and does not add Ammo nodes. No pattern is stretched.
- Disabled 02 cannot meet the literal colour criterion without deleting border: the beige mat overlaps worn ivory/brown weaving. The clean outer rectangle could be visually improved, but it would not honestly pass the specified metric.
- Fragments 2K7L5EB/QSMGCAP remain disabled. A synthesized enclosing pattern would imply an original border that the photograph does not provide.
- The 0.4% woven edge darkens/desaturates only existing rug pixels with deterministic noise; both the unpolished cut and the final decoded WebP pass leakage checks. Quality 85/90/95 is checked in order; lossless is the final safety fallback. The final reviewed set passes at quality 85.
- No downloads, new attribution obligations, runtime shaders, draw calls, triangles, physics bodies, or Ammo work were introduced. Optional licensed sheets remain gitignored.

Research: [OpenCV robust line fitting](https://docs.opencv.org/4.13.0/d3/dc0/group__imgproc__shape.html), [OpenCV morphology](https://github.com/opencv/opencv/blob/5.x/doc/tutorials/imgproc/opening_closing_hats/opening_closing_hats.markdown), [libvips resampling](https://www.libvips.org/API/8.16/libvips-resample.html). The implementation is native JS + existing Sharp: morphology close/open, largest component/hole fill, Lab/texture foreground, prior-local half-pixel central-gradient boundary search, deterministic RANSAC/TLS, homography sampling at 1.5× output resolution and Lanczos3 downsampling. No dependency or browser resource cost was added.
