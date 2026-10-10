import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// In unlock order; dimensions and thresholds follow docs/BEATERS.md.
export const BEATERS = [
  { id: 'soviet', nameRu: 'Советская', era: 'СССР 1950–80', unlockCarpets: 0, sound: { preset: 'wire' }, feel: { swingMass: 1, headRadius: 1 } },
  { id: 'plastic', nameRu: 'Пластмассовая с рынка', era: '90-е–2000-е', unlockCarpets: 2, sound: { preset: 'plastic' }, feel: { swingMass: 0.65, headRadius: 0.95 } },
  { id: 'rattan', nameRu: 'Ротанговая', era: 'СССР / ГДР / ПНР', unlockCarpets: 4, sound: { preset: 'rattan' }, feel: { swingMass: 0.85, headRadius: 1.15 } },
  { id: 'sonne', nameRu: 'Немецкая Sonne', era: 'ФРГ / Австрия XX в.', unlockCarpets: 7, sound: { preset: 'rattan' }, feel: { swingMass: 1.05, headRadius: 1 } },
  { id: 'victorian', nameRu: 'Викторианская пружинная', era: 'Англия / США 1890–1920', unlockCarpets: 10, sound: { preset: 'spring' }, feel: { swingMass: 1.3, headRadius: 1.1 } },
  { id: 'bamboo', nameRu: 'Японская футон-татаки', era: 'Япония', unlockCarpets: 14, sound: { preset: 'bamboo' }, feel: { swingMass: 0.75, headRadius: 0.95 } },
];

const TAU = Math.PI * 2;
const v = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const spline = (points, closed = false) => {
  const vertices = points.map(p => Array.isArray(p) ? v(...p) : p);
  // A repeated endpoint on an open Catmull-Rom curve creates mismatched seam
  // tangents. Close the curve and let TubeGeometry transport and close frames.
  if (vertices.length > 2 && vertices[0].distanceToSquared(vertices.at(-1)) < 1e-12) {
    vertices.pop(); closed = true;
  }
  return new THREE.CatmullRomCurve3(vertices, closed, 'centripetal');
};
const sampled = (fn, count = 100, closed = false) => spline(Array.from({ length: count + 1 }, (_, i) => fn(i / count)), closed);

/** All geometry is in metres, grip centre at zero, striking face normal +Z. */
export function createBeaterModel(id) {
  if (!BEATERS.some(b => b.id === id)) throw new RangeError(`Unknown beater: ${id}`);
  const group = new THREE.Group();
  group.name = `beater:${id}`;
  const colliders = [];
  const parts = [[], [], []];
  const steel = id === 'victorian' ? '#424952' : '#bcc5c9';
  const materials = [
    new THREE.MeshPhysicalMaterial({ color: 'white', vertexColors: true, roughness: 0.52, clearcoat: 0.15 }),
    new THREE.MeshStandardMaterial({ color: 'white', vertexColors: true, metalness: 0.85, roughness: 0.45 }),
    new THREE.MeshPhysicalMaterial({ color: 'white', vertexColors: true, roughness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.22 }),
  ];
  function add(geometry, slot, color, weather = false) {
    const positions = geometry.getAttribute('position');
    const colors = new Float32Array(positions.count * 3);
    const base = new THREE.Color(color), rust = new THREE.Color('#86543c');
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const grain = 0.96 + 0.04 * Math.sin(y * 1100 + x * 170 + z * 320);
      // Sparse oxidation at the shoulders and crown, never a uniform rusty wash.
      const bend = weather ? Math.max(0, Math.sin(y * 49 + x * 33) - 0.82) * 1.3 : 0;
      const c = base.clone().multiplyScalar(grain).lerp(rust, bend);
      c.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts[slot].push(geometry);
  }
  function tube(curve, radius, slot, color, segments = 64, radial = 6, weather = false) {
    add(new THREE.TubeGeometry(curve, segments, radius, radial, curve.closed), slot, color, weather);
  }
  function collision(curve, radius = 0.014, count = 24) {
    for (let i = 0; i < count; i++) colliders.push({ offset: curve.getPoint(i / (count - 1)), radius });
  }
  function shaft(top, color, radius = 0.006, slot = 0) {
    tube(spline([[0, -0.065], [0, 0.1], [0, top]]), radius, slot, color, 24, 8);
  }
  function ring(y, radius, slot, color, tubeRadius = 0.002) {
    tube(sampled(t => v(Math.cos(t * TAU) * radius, y, Math.sin(t * TAU) * radius), 40), tubeRadius, slot, color, 48);
  }
  function wrap(start, end, radius, turns, color, tubeRadius = 0.0013, slot = 0) {
    tube(sampled(t => v(radius * Math.cos(t * TAU * turns), start + t * (end - start), radius * Math.sin(t * TAU * turns)), turns * 10), tubeRadius, slot, color, turns * 12, 5);
  }
  function ferrule(y, color = '#c4b68b') {
    const g = new THREE.CylinderGeometry(0.0145, 0.0145, 0.022, 16);
    g.translate(0, y, 0); add(g, 1, color);
    ring(y - 0.009, 0.0146, 1, color); ring(y + 0.009, 0.0146, 1, color);
  }
  function woodenHandle(color) {
    const profile = [];
    for (let i = 0; i <= 52; i++) {
      const t = i / 52;
      let r = 0.012 + 0.002 * Math.sin(Math.PI * t);
      if (t < 0.045 || t > 0.955) r *= 0.7;
      if ([0.12, 0.18, 0.78, 0.84].some(g => Math.abs(t - g) < 0.014)) r -= 0.0014;
      profile.push(new THREE.Vector2(r, -0.065 + t * 0.13));
    }
    add(new THREE.LatheGeometry(profile, 20), 2, color);
    ferrule(0.074, id === 'victorian' ? '#bc9655' : '#b8bec2');
  }
  function heart(bottom, top, width) {
    const h = top - bottom;
    return spline([[0, bottom], [-width * 0.6, bottom + h * 0.28], [-width, bottom + h * 0.69], [-width * 0.85, top - h * 0.06], [-width * 0.4, top], [0, top - h * 0.12], [width * 0.4, top], [width * 0.85, top - h * 0.06], [width, bottom + h * 0.69], [width * 0.6, bottom + h * 0.28], [0, bottom]]);
  }
  function rosette(center, rx, ry, petals, phase = 0, zPhase = 0) {
    return sampled(t => {
      const a = TAU * t + phase;
      const r = 0.67 + 0.33 * Math.cos(petals * a);
      return v(rx * r * Math.sin(a), center + ry * r * Math.cos(a), 0.0045 * Math.sin(petals * a * 2 + zPhase));
    }, 120);
  }
  function wovenRosette(center, rx, ry, petals, strand) {
    // A projected (2, petals) torus knot: each reed travels through every
    // petal, crossing alternately above and below the other half of the knot.
    const points = Array.from({ length: 241 }, (_, i) => {
      const a = TAU * i / 240, r = 0.67 + 0.33 * Math.cos(petals * a);
      return v(r * Math.sin(2 * a), r * Math.cos(2 * a), 0.010 * Math.sin(petals * a));
    });
    const bounds = new THREE.Box3().setFromPoints(points);
    const middle = bounds.getCenter(new THREE.Vector3()), extent = bounds.getSize(new THREE.Vector3());
    points.forEach(p => { p.x = (p.x - middle.x) * 2 * rx / extent.x; p.y = center + (p.y - middle.y) * 2 * ry / extent.y; });
    const path = spline(points);
    return sampled(t => {
      const p = path.getPoint(t), tangent = path.getTangent(t);
      const side = v(-tangent.y, tangent.x).normalize();
      return p.addScaledVector(side, (strand - 1) * 0.0068);
    }, 240);
  }
  let flexStart, headBottom;
  if (id === 'soviet') {
    woodenHandle('#612b25');
    const outline = heart(0.35, 0.58, 0.09);
    // Each cable is three actual helically wound steel strands about a planar centreline.
    function cable(curve, turns, segments) {
      for (let strand = 0; strand < 3; strand++) {
        const helix = sampled(t => {
          const p = curve.getPoint(t), tangent = curve.getTangent(t);
          const side = v(-tangent.y, tangent.x).normalize();
          const angle = t * TAU * turns + strand * TAU / 3;
          return p.addScaledVector(side, Math.cos(angle) * 0.0021).add(v(0, 0, Math.sin(angle) * 0.0021));
        }, segments);
        tube(helix, 0.0026, 1, steel, segments, 5, true);
      }
    }
    // Nine samples per turn retain the twisted silhouette within the triangle budget.
    cable(outline, 40, 360);
    for (const sign of [-1, 1]) cable(spline([[sign * 0.005, 0.077], [sign * 0.009, 0.28], [sign * 0.03, 0.40]]), 17, 150);
    collision(outline); flexStart = 0.10; headBottom = 0.35;
  } else if (id === 'rattan' || id === 'sonne') {
    const sonne = id === 'sonne', top = sonne ? 0.705 : 0.68;
    shaft(top - 0.12, '#c09a5b', 0.008);
    wrap(-0.061, 0.095, 0.009, 38, '#deba7d');
    ferrule(-0.063);
    const center = top - 0.13, rx = sonne ? 0.089 : 0.119;
    const palette = sonne ? ['#d9af38', '#b84431', '#e7c985'] : ['#d3ad70', '#e6c78e', '#bc9459'];
    for (let i = 0; i < 3; i++) {
      const curve = wovenRosette(center, rx, 0.126, sonne ? 5 : 3, i);
      tube(curve, 0.0033, 0, palette[i], 240, 6); collision(curve, 0.012, 30);
      tube(spline([[ (i - 1) * 0.005, 0.09], [(i - 1) * 0.009, center - 0.16], [(i - 1) * 0.018, center - 0.075]]), 0.0033, 0, palette[i], 30);
    }
    if (sonne) {
      const guard = new THREE.SphereGeometry(1, 20, 8); guard.scale(0.039, 0.011, 0.018); guard.translate(0, 0.10, 0);
      add(guard, 0, '#ad743b');
      tube(spline([[-0.008, -0.063], [-0.012, -0.083], [0, -0.092], [0.012, -0.083], [0.008, -0.063]]), 0.002, 1, '#bcb4a2', 32);
    }
    flexStart = 0.11; headBottom = center - 0.135;
  } else if (id === 'plastic') {
    const color = ['#f32622', '#165eff', '#f4df10'][Math.floor(Math.random() * 3)];
    materials[2].roughness = 0.19;
    shaft(0.34, color, 0.008, 2);
    for (let i = 0; i < 16; i++) ring(-0.058 + i * 0.008, 0.009, 2, color, 0.0015);
    tube(spline([[-0.006, -0.06], [-0.013, -0.08], [0, -0.09], [0.013, -0.08], [0.006, -0.06]]), 0.003, 2, color, 32);
    const curve = rosette(0.358, 0.103, 0.098, 3);
    // A rectangular 10 x 4 mm moulded ribbon swept along the trefoil centreline.
    const ribbon = new THREE.TubeGeometry(curve, 180, 1, 4, curve.closed);
    const pos = ribbon.attributes.position;
    for (let i = 0; i <= 180; i++) {
      const p = curve.getPointAt(i / 180), tangent = curve.getTangentAt(i / 180), side = v(-tangent.y, tangent.x).normalize();
      for (let j = 0; j <= 4; j++) {
        const corners = [[-1,-1], [1,-1], [1,1], [-1,1], [-1,-1]][j];
        const q = p.clone().addScaledVector(side, corners[0] * 0.005); q.z += corners[1] * 0.002;
        pos.setXYZ(i * 5 + j, q.x, q.y, q.z);
      }
    }
    ribbon.computeVertexNormals(); add(ribbon, 2, color);
    for (const s of [-1, 1]) tube(spline([[0, 0.24], [s * 0.034, 0.32], [s * 0.053, 0.36]]), 0.0025, 2, color, 24);
    collision(curve, 0.013, 36); flexStart = 0.10; headBottom = 0.26;
  } else if (id === 'victorian') {
    woodenHandle('#342018');
    wrap(0.095, 0.195, 0.014, 11, steel, 0.0023, 1);
    for (const sign of [-1, 1]) tube(spline([[sign * 0.012, 0.185], [sign * 0.016, 0.34], [sign * 0.04, 0.46]]), 0.0025, 1, steel, 36);
    const outline = heart(0.405, 0.68, 0.114);
    tube(outline, 0.0045, 1, steel, 100, 8, true); collision(outline, 0.014, 32);
    // Hex cells clipped against the sampled heart polygon, including edge fragments.
    const polygon = outline.getPoints(160);
    const inside = p => {
      let yes = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) yes = !yes;
      }
      return yes;
    };
    const edgeKeys = new Set(), r = 0.014;
    for (let col = -6; col <= 6; col++) for (let row = 0; row < 13; row++) {
      const cx = col * r * 1.5, cy = 0.413 + row * Math.sqrt(3) * r + (Math.abs(col) % 2) * Math.sqrt(3) * r / 2;
      for (let k = 0; k < 6; k++) {
        const a = v(cx + r * Math.cos(k * TAU / 6), cy + r * Math.sin(k * TAU / 6));
        const b = v(cx + r * Math.cos((k + 1) * TAU / 6), cy + r * Math.sin((k + 1) * TAU / 6));
        const key = [a,b].map(p => `${p.x.toFixed(5)},${p.y.toFixed(5)}`).sort().join(':');
        if (edgeKeys.has(key)) continue; edgeKeys.add(key);
        const steps = Array.from({ length: 9 }, (_, n) => a.clone().lerp(b, n / 8)).filter(inside);
        if (steps.length > 1) tube(spline(steps), 0.0018, 1, '#697079', 2, 5);
      }
    }
    flexStart = 0.095; headBottom = 0.405;
  } else {
    shaft(0.49, '#d9bc7e', 0.008);
    wrap(-0.06, 0.16, 0.009, 18, '#ba9556', 0.0016);
    for (const y of [0.19, 0.30]) ring(y, 0.009, 0, '#a78a51', 0.0018);
    // A palm-shaped slatted paddle with bound perimeter and splayed bamboo fingers.
    const outline = spline([[0,0.29],[-0.044,0.35],[-0.082,0.45],[-0.07,0.51],[-0.03,0.53],[0.03,0.53],[0.07,0.51],[0.082,0.45],[0.044,0.35],[0,0.29]]);
    tube(outline, 0.004, 0, '#dec58e', 90, 8); collision(outline, 0.013, 30);
    for (let i = -3; i <= 3; i++) {
      const curve = spline([[i * 0.002,0.28],[i * 0.012,0.40],[i * 0.02,0.49],[i * 0.019,0.518]]);
      const g = new THREE.TubeGeometry(curve, 36, 0.004, 6, curve.closed); add(g,0, i % 2 ? '#d5b779' : '#e5cf99');
      collision(curve, 0.012, 5);
    }
    for (let i = 0; i < 7; i++) {
      const y = 0.365 + i * 0.021, width = 0.035 + Math.sin(i / 6 * Math.PI) * 0.039;
      tube(sampled(t => v((t * 2 - 1) * width, y + t * 0.007, 0.004 * Math.cos(t * TAU * 3)), 32), 0.0013, 0, '#ac894e', 36, 5);
    }
    flexStart = 0.15; headBottom = 0.29;
  }
  const meshes = [];
  parts.forEach((geometries, slot) => {
    if (!geometries.length) { materials[slot].dispose(); return; }
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, materials[slot]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh); meshes.push({ mesh, rest: geometry.attributes.position.array.slice() });
  });
  group.userData.headBounds = new THREE.Box3();
  for (const c of colliders) {
    group.userData.headBounds.expandByPoint(c.offset.clone().addScalar(c.radius));
    group.userData.headBounds.expandByPoint(c.offset.clone().addScalar(-c.radius));
  }
  group.userData.headBottom = headBottom;
  let disposed = false, lastAmount = 0, lastDirection = 0;
  return {
    group, colliders,
    flex(amount0to1, dir = 1) {
      if (disposed) return;
      const amount = THREE.MathUtils.clamp(Number.isFinite(amount0to1) ? amount0to1 : 0, 0, 1);
      const component = typeof dir === 'number' ? dir : dir?.z ?? 1;
      const direction = amount === 0 ? 0 : Math.sign(Number.isFinite(component) ? component : 1);
      if (amount === lastAmount && direction === lastDirection) return;
      for (const { mesh, rest } of meshes) {
        const p = mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
          const length = Math.max(0, y - flexStart), angle = amount * direction * length * 0.8;
          p.setXYZ(i, x, y - length * (1 - Math.cos(angle)), z + length * Math.sin(angle));
        }
        p.needsUpdate = true; mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
      }
      lastAmount = amount; lastDirection = direction;
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const { mesh } of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); }
      group.clear();
    },
  };
}
