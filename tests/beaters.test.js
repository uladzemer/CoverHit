import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BEATERS, createBeaterModel } from '../src/input/beaters/index.js';

describe('procedural beater collection', () => {
  it('matches the documented unlock order and shared contract', () => {
    expect(new Set(BEATERS.map(b => b.id)).size).toBe(6);
    expect(BEATERS.map(b => [b.id, b.unlockCarpets])).toEqual([
      ['soviet',0], ['plastic',2], ['rattan',4], ['sonne',7], ['victorian',10], ['bamboo',14],
    ]);
    for (const b of BEATERS) {
      expect(b.nameRu.length).toBeGreaterThan(0); expect(b.era.length).toBeGreaterThan(0);
      expect(['wire','rattan','plastic','spring','bamboo']).toContain(b.sound.preset);
      expect(b.feel.swingMass).toBeGreaterThanOrEqual(0.6); expect(b.feel.swingMass).toBeLessThanOrEqual(1.4);
      expect(b.feel.headRadius).toBeGreaterThan(0);
    }
  });
  for (const definition of BEATERS) it(`${definition.id}: real scale, bounded geometry and head colliders, reversible flex`, () => {
    const model = createBeaterModel(definition.id);
    expect(model.group).toBeInstanceOf(THREE.Group);
    const bounds = new THREE.Box3().setFromObject(model.group), size = bounds.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThanOrEqual(0.54); expect(size.y).toBeLessThanOrEqual(0.82);
    expect(model.group.children.length).toBeLessThanOrEqual(3);
    let triangles = 0;
    const originals = [];
    model.group.traverse(o => {
      if (!o.isMesh) return;
      triangles += o.geometry.index.count / 3;
      originals.push([o, o.geometry.attributes.position.array.slice()]);
      for (const n of o.geometry.attributes.position.array) expect(Number.isFinite(n)).toBe(true);
    });
    expect(triangles).toBeLessThan(25000);
    expect(model.colliders.length).toBeGreaterThan(10);
    for (const { offset, radius } of model.colliders) {
      expect(offset).toBeInstanceOf(THREE.Vector3); expect(radius).toBeGreaterThan(0);
      expect(offset.y).toBeGreaterThanOrEqual(model.group.userData.headBottom - 0.015);
      expect(bounds.clone().expandByScalar(0.016).containsPoint(offset)).toBe(true);
      expect(model.group.userData.headBounds.containsPoint(offset.clone().addScalar(radius))).toBe(true);
      expect(model.group.userData.headBounds.containsPoint(offset.clone().addScalar(-radius))).toBe(true);
    }
    model.flex(1, new THREE.Vector3(0,0,-1));
    expect(originals.some(([o, rest]) => o.geometry.attributes.position.array.some((n,i) => n !== rest[i]))).toBe(true);
    for (const [o,rest] of originals) {
      for (let i = 0; i < rest.length; i += 3) if (rest[i+1] <= 0.065) expect(Array.from(o.geometry.attributes.position.array.slice(i,i+3))).toEqual(Array.from(rest.slice(i,i+3)));
    }
    model.flex(0);
    for (const [o,rest] of originals) expect(o.geometry.attributes.position.array).toEqual(rest);
    model.dispose(); model.dispose(); expect(model.group.children.length).toBe(0);
  });
  it('rejects unknown IDs rather than silently substituting a model', () => { expect(() => createBeaterModel('missing')).toThrow(RangeError); });
});

// Nominal width / overall-length ratios from BEATERS.md; explicit geometric
// references for models whose source only specifies overall length.
const proportions = { soviet: [.18,.65], rattan: [.25,.75], sonne: [.19,.76], plastic: [.195,.55], victorian: [.238,.75], bamboo: [.173,.60] };
it.each(BEATERS)('$id loop width / length stays within ten percent of the specification', definition => {
  const model = createBeaterModel(definition.id);
  try {
    const total = new THREE.Box3().setFromObject(model.group).getSize(new THREE.Vector3());
    const head = new THREE.Box3();
    model.group.traverse(object => {
      if (!object.isMesh) return;
      const p = object.geometry.attributes.position;
      for (let i=0;i<p.count;i++) if (p.getY(i) >= model.group.userData.headBottom)
        head.expandByPoint(new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)));
    });
    const [width,length] = proportions[definition.id];
    expect(head.getSize(new THREE.Vector3()).x / total.y).toBeGreaterThanOrEqual(width / length * .9);
    expect(head.getSize(new THREE.Vector3()).x / total.y).toBeLessThanOrEqual(width / length * 1.1);
  } finally { model.dispose(); }
});
