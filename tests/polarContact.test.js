import { it, expect } from 'vitest';
import { PolarContact, polarAngle, CONTACT_THICKNESS, MAX_CONTACT_CORRECTION } from '../src/carpet/polarContact.js';
import { Cloth } from '../src/carpet/cloth.js';

const vector = (x = 0, y = 0, z = 0) => ({ x: () => x, y: () => y, z: () => z, setValue(a, b, c) { x = a; y = b; z = c; } });
function fixture(a = 0, b = 40, gap = .01) {
  const nodes = Array.from({ length: 45 }, (_, i) => {
    const p = vector(10 + i, 10, 0), q = vector(10 + i, 10, 0), v = vector();
    let mass = 0;
    return { get_m_x: () => p, get_m_q: () => q, get_m_v: () => v, get_m_im: () => mass, mass(m) { mass = m; } };
  });
  for (const [i, r] of [[a, .08], [b, .08 + gap]]) {
    nodes[i].get_m_x().setValue(0, r, 0); nodes[i].get_m_q().setValue(0, r, 0); nodes[i].mass(1);
  }
  return { nodes, list: { at: i => nodes[i], size: () => nodes.length }, contact: new PolarContact(4, 8, .05), bar: { y: 0, z: 0 } };
}

it('approximates atan2 continuously through all quadrants', () => {
  for (let i = 0; i < 10000; i++) {
    const angle = i / 10000 * Math.PI * 2;
    expect(Math.abs(polarAngle(Math.cos(angle), Math.sin(angle)) - angle)).toBeLessThan(.000012);
  }
  expect(polarAngle(0, 0)).toBe(0);
});
it('separates radial layers using current geometric order in either rest direction', () => {
  for (const reverse of [false, true]) {
    const { nodes, list, contact, bar } = fixture();
    if (reverse) { nodes[0].get_m_x().setValue(0, .09, 0); nodes[40].get_m_x().setValue(0, .08, 0); }
    contact.project(list, bar);
    expect(Math.abs(nodes[40].get_m_x().y() - nodes[0].get_m_x().y())).toBeCloseTo(CONTACT_THICKNESS, 12);
    expect(nodes[40].get_m_x().y() > nodes[0].get_m_x().y()).toBe(!reverse);
  }
});
it('weights correction by inverse mass', () => {
  const { nodes, list, contact, bar } = fixture(); nodes[0].mass(2);
  contact.project(list, bar);
  expect(.08 - nodes[0].get_m_x().y()).toBeCloseTo(.004 * 2 / 3, 12);
  expect(nodes[40].get_m_x().y() - .09).toBeCloseTo(.004 / 3, 12);
});
it('caps the accumulated push across both sweeps at five millimetres', () => {
  const { nodes, list, contact, bar } = fixture(0, 40, 0);
  contact.project(list, bar);
  expect(contact.metrics.maxCorrection).toBeLessThanOrEqual(MAX_CONTACT_CORRECTION);
  for (const i of [0, 40]) expect(Math.abs(nodes[i].get_m_x().y() - .08)).toBeLessThanOrEqual(.005 + 1e-12);
});
it('redistributes correction after the lower neighbour exhausts its budget', () => {
  const c = new PolarContact(4, 8, .05); c.im.fill(1); c.dt = 1 / 60; c.used[0] = .005;
  c.resolve(0, 40, 1, 0, .011);
  expect(c.p[1]).toBe(0); expect(c.p[121]).toBeCloseTo(-.003, 12);
});
it('shifts Ammo history without manufacturing velocity', () => {
  const { nodes, list, contact, bar } = fixture(); contact.project(list, bar);
  for (const i of [0, 40]) {
    expect(nodes[i].get_m_q().y()).toBeCloseTo(nodes[i].get_m_x().y(), 12);
    expect(nodes[i].get_m_v().y()).toBe(0);
  }
});
it('handles neighbouring x and angular bins, including the angular seam', () => {
  const { nodes, list, contact, bar } = fixture();
  nodes[0].get_m_x().setValue(.0499, .08, -.00005);
  nodes[40].get_m_x().setValue(.0501, .09, .00005);
  contact.project(list, bar);
  expect(contact.metrics.contacts).toBeGreaterThan(0);
  expect(contact.metrics.maxCorrection).toBeLessThanOrEqual(.005);
});
it('retains the previous nearest-neighbour order in the radial dead band', () => {
  const { nodes, list, contact, bar } = fixture(0, 40, .001);
  contact.project(list, bar);
  nodes[0].get_m_x().setValue(0, .081, 0); nodes[40].get_m_x().setValue(0, .08, 0);
  contact.project(list, bar);
  expect(nodes[40].get_m_x().y()).toBeGreaterThan(nodes[0].get_m_x().y());
});
it('includes remote same-sheet folds and excludes three linked grid rings', () => {
  const { list, contact, bar } = fixture(0, 4); contact.project(list, bar);
  expect(contact.metrics.contacts).toBeGreaterThan(0);
  expect(contact.remote(0, 3)).toBe(false); expect(contact.remote(0, 15)).toBe(false); expect(contact.remote(0, 4)).toBe(true);
});
it('pins grip patches until release while allowing the opposite sheet to respond', () => {
  const { nodes, list, contact, bar } = fixture();
  contact.project(list, bar, 0, null, { age: .5, grips: [{ i: 0 }] });
  expect(nodes[0].get_m_x().y()).toBe(.08); expect(nodes[40].get_m_x().y()).toBeCloseTo(.094, 12);
  expect(contact.im[0]).toBe(0);
  contact.project(list, bar, 0, null, { age: 1, grips: [{ i: 0 }] }); expect(contact.im[0]).toBe(1);
});
it('never changes supported crown rows in the contact solve', () => {
  const { nodes, list, contact, bar } = fixture(10, 30);
  contact.project(list, bar, 0, null, { age: 1, grips: [] });
  expect(nodes[10].get_m_x().y()).toBe(.08); expect(nodes[30].get_m_x().y()).toBe(.09);
});
it('applies inelastic normal response and capped tangential drag without adding energy', () => {
  const c = new PolarContact(4, 8, .05); c.im.fill(1); c.dt = 1 / 60;
  c.v[0] = 2; c.v[1] = -1;
  const before = c.v.reduce((s, v) => s + v * v, 0);
  c.resolve(0, 40, 1, 0, .013);
  expect(c.v[120]).toBeGreaterThan(0); expect(c.v[0]).toBeLessThan(2);
  expect(c.v[1] - c.v[121]).toBeCloseTo(0, 12);
  expect(c.v.reduce((s, v) => s + v * v, 0)).toBeLessThanOrEqual(before);
});
it('uses the hanging separator where radial displacement would run along the panel', () => {
  const { nodes, list, contact, bar } = fixture();
  nodes[0].get_m_x().setValue(0, -.5, -.005); nodes[40].get_m_x().setValue(0, -.5, .005);
  contact.project(list, bar);
  expect(nodes[40].get_m_x().z() - nodes[0].get_m_x().z()).toBeCloseTo(CONTACT_THICKNESS, 12);
  expect(nodes[0].get_m_x().y()).toBe(-.5); expect(nodes[40].get_m_x().y()).toBe(-.5);
});
it('reuses all typed work buffers and its metrics object between steps', () => {
  const { list, contact, bar } = fixture(); const before = Object.entries(contact).filter(([, v]) => ArrayBuffer.isView(v)); const metrics = contact.metrics;
  for (let step = 0; step < 100; step++) contact.project(list, bar);
  for (const [key, buffer] of before) expect(contact[key]).toBe(buffer);
  expect(contact.metrics).toBe(metrics);
});
it('interpolates angular occupancy when the opposing edge vertices are in distant bins', () => {
  const { nodes, list, contact, bar } = fixture(0, 40);
  nodes[35].mass(1); nodes[35].get_m_x().setValue(0, .09, -.03);
  nodes[40].get_m_x().setValue(0, .09, .03);
  contact.project(list, bar);
  const surface = (nodes[35].get_m_x().y() + nodes[40].get_m_x().y()) / 2;
  expect(surface - nodes[0].get_m_x().y()).toBeGreaterThanOrEqual(CONTACT_THICKNESS - 1e-9);
});
it('redistributes pipe-blocked inward contact to the outer layer without exceeding either cap', () => {
  const { nodes, list, contact, bar } = fixture();
  contact.project(list, bar, .079);
  expect(nodes[0].get_m_x().y()).toBeGreaterThanOrEqual(.079 - 1e-12);
  expect(nodes[40].get_m_x().y() - nodes[0].get_m_x().y()).toBeCloseTo(CONTACT_THICKNESS, 12);
  expect(contact.metrics.maxCorrection).toBeLessThanOrEqual(MAX_CONTACT_CORRECTION);
});
it('launches hanging panels outward before they reach the pipe, once per travelling column', () => {
  const { nodes, list } = fixture();
  nodes[0].get_m_x().setValue(0, -.5, -.03);
  const cloth = Object.assign(Object.create(Cloth.prototype), {
    nodes: list, cols: 4, rows: 8, foldAxis: 'v', barAxis: { y: 0, z: 0 }, anchored: new Set(),
    flip: { age: .3, leading: 0, spread: .2, launched: new Uint8Array(45), sides: new Int8Array(45).fill(-1) },
  });
  cloth.throwWave();
  expect(nodes[0].get_m_v().y()).toBeGreaterThan(0);
  expect(nodes[0].get_m_v().z()).toBe(-1.8);
  const vy = nodes[0].get_m_v().y(); cloth.throwWave();
  expect(nodes[0].get_m_v().y()).toBe(vy);
  expect(cloth.flip.launched[4]).toBe(0);
});
