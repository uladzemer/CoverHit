# Final phone canvas presentation

`MOBILE_URL=http://127.0.0.1:5323/ node scripts/verify-canvas-presented.mjs`
passes iPhone 14 Pro and SE, full/lite/minimal/automatic selection, portrait and
landscape, live full → lite → minimal, adaptive fallback, mute/flip/menu touch,
and the deliberately hidden-canvas negative control. All eight cases pass;
all captures have zero green-background leakage. `report.json` contains the
numbers. Images remain locally in this folder.

Full-profile landscape is checked before downgrading. That stronger check
exposed the same WebKit drawing-buffer resize failure on full rotation.
Full phones now retain output/composer resolution after startup, while camera
aspect follows the canvas CSS rect. Desktop full continues to resize normally.
Like the pre-existing direct path, retained phone buffers can soften the axis
that grows in landscape; framing and aim remain correct.
