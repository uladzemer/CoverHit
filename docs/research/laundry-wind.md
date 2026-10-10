# Laundry and shared wind — 2026-10-10

Decision: original Node damped-Verlet bake with structural, shear and bending
constraints; an RGBA8 bounding-box position VAT; GPU interpolation and wind-level
blending. No Blender, third-party VAT code or downloaded art is required.

Verified primary references:

- [three DataTexture](https://threejs.org/docs/pages/DataTexture.html): raw byte
  buffers, RGBA interpretation, nearest filtering and disabled mipmaps. We set
  these explicitly, leave data in linear/no colour space, and interpolate frames
  manually. RGBA8 avoids half-float portability and uses 1,391,616 bytes.
- [three InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): shared
  geometry/material reduces submissions; animated geometry needs conservative
  bounds. These twelve small instances disable frustum culling.
- [Matthias Müller cloth demo](https://matthias-research.github.io/pages/tenMinutePhysics/14-cloth.html):
  constraint-based cloth with adjustable bending compliance. Used as a conceptual
  comparison only; implementation here is original.

Options considered:

| Method | Runtime work | Result / decision |
| --- | --- | --- |
| VAT from offline constraints | GPU position fetches; no cloth CPU simulation | Selected: folds, pinned corners, gravity and inertia captured offline |
| Analytic vertex waves | Lowest bandwidth, a few sine evaluations | Only used for small free-edge flutter; insufficient alone for hanging folds |
| CPU Verlet strips | Solver iterations and recurring vertex uploads | Rejected: repeated CPU work competes with carpet Ammo |

Four reusable templates (sheet, shirt, trousers, rope) retain 12×16 nodes, three
5-second / 30 fps clips each. Reuse keeps ten garments plus two ropes under 2 MiB.
The last 0.5 seconds blend smoothly into the first pose; final and first encoded
frames are identical. Normals come from neighbouring animated vertices, avoiding
a second atlas. Pins stay fixed in the cloth bake. Runtime normal amplitude is
restricted to 0.32 m per normalized metre to retain the rear-left play clearance.

Shared wind uses three incommensurate gust sines plus seeded smooth value noise,
slow direction drift, a height power law and travelling fronts. Point velocities
are bounded at approximately 6 m/s; strength is normalized. Factories support
replays; the singleton matches the other streams' exact contract. The main loop
advances it once, and grass, foliage, cloth, carpet and fringe borrow the model.

The laundry material remains the existing yard laundry material so the static
yard optimizer preserves the two instanced batches. Animated custom depth uses
the same VAT and trousers cutout. No stock shader sway hooks exist in stock.js.
No downloaded files or attribution-panel additions are needed.
