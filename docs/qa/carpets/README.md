# Carpet QA

All ten museum corner overlays and rectified outputs, plus the five included Envato photographs, were inspected visually. `corners.jpg` shows source corners; `rectified.jpg` shows the output rectangles. Individual `<id>-rest.png` screenshots show every rug (Envato screenshots are gitignored licensed evidence) hanging after 2.5 seconds of normal physics with wind disabled and dirt cleared for inspection. Cloth remains live, with no forced positions or paused solver. `rotation.png` collects those browser screenshots in manifest order 01-10. `browser.json` records exact factory aspects, grid counts, finite solver positions, map transforms, and the forced texture-failure result.

| Scan | Deskew / crop review |
| --- | --- |
| 01 Anhalt | Outer woven corners; mildly uneven bottom and widening removed by four-corner rectification. Original narrow medallion proportions preserved. |
| 02 Kashan | Manually configured corners inside the mount; wooden frame and right-side colour checker excluded. Full woven border retained. Automatic segmentation is not used for this framed scan. |
| 03 Tekke A | Sloping top edge and slight taper corrected; grey background and fringe excluded. Plain woven top/bottom bands restored instead of cropping to the patterned pile. Hand-reviewed corners also serve as the detector regression reference. |
| 04 Tekke B | Unequal left/right slopes corrected; white backdrop excluded. Worn plain end bands preserved. Hand-reviewed corners also serve as the detector regression reference. |
| 05 Salor | Small rotation/taper corrected from outer woven corners; grey surround excluded. |
| 06 Yomut | Top tilt and asymmetric side taper corrected; cream border retained and grey surround excluded. |
| 07 Shirvan | Landscape orientation retained exactly. Top/bottom tilt rectified; grey surround removed; lattice and Kufic border preserved. This real rug is wider than it is tall. |
| 08 Caucasian | Widening at bottom corrected; left checker and grey backdrop excluded; salmon medallion and perimeter border retained. |
| 09 Kazak | Slight rotation/taper rectified; frayed surround excluded. Ivory/red star design retained. Bright, light palas remains first unless an Envato draft explicitly sets `easy: true`. |
| 10 Ushak | Tilt/taper rectified; mount, black frame and checker excluded; faded medallion retained. |
| 11-13 paintings | Removed from gameplay and published processed assets because they are paintings, not real rug scans. Original sources retained for provenance. |

Natural woven edge/border waviness and age-related wear remain part of the scans; a four-corner homography corrects camera rotation and perspective without repainting or inventing details. Projection onto a physically bending cloth naturally changes the screen silhouette; the authored cloth surface aspect and full-image UV mapping stay correct.

Decisions: use the whole woven rug, including plain kilim ends; keep the source landscape orientation of 07; remove painting-derived tapestries; preserve 09 as the proven easy first rug; prefer stock photos immediately after it; let `easy: true` opt a stock rug into first position. Raw/private stock assets are never included in committed evidence.

Seven Envato files arrived during implementation with owner notes. Five complete-rug photos were added; their titles and item links follow those notes. B7PV8QR is explicitly easy and first, with light mass/dirt settings. The hanging bar now accommodates the widest source aspect without squeezing any rug.

| Envato item | Deskew / crop review |
| --- | --- |
| B7PV8QR | Detector quad trims the thin red surround; complete medallion and border retained. Bright first rug; original landscape proportions retained. |
| 6325SWE | Automatic segmentation split at disconnected motifs. Replaced with manually reviewed full-frame corners, retaining the entire cream border. |
| EPRJ58X | Full frontal rectangle retained; original landscape proportions. |
| RBFEDY2 | Full portrait rectangle including bottom border retained. |
| T834FYR | Detected quad was tightened inside the bowed woven edges after browser review to remove white slivers; red/teal kilim border retained. |
| 2K7L5EB | Disabled: owner notes identify a fragment without the outer rug border. |
| QSMGCAP | Disabled: owner notes identify a striped textile fragment, not a complete rug. |

Unfinished: none for the supplied complete-rug photographs. The two fragment entries remain explicitly disabled. Future automatic detections are drafts; very busy images filling the frame may require manual corner correction, as demonstrated by 6325SWE.
