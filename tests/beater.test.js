import { describe, it, expect, vi, afterEach } from "vitest";
import * as THREE from "three";
import { BEATERS } from "../src/input/beaters/index.js";
import { Beater } from "../src/input/beater.js";
import { Game } from '../src/game/state.js';
import { advanceGameplayFrame } from '../src/game/frame.js';

afterEach(() => vi.unstubAllGlobals());
function setup() {
  vi.stubGlobal("document", {
    createElement: () => ({ style: { setProperty() {} }, remove() {} }),
    body: { append() {} },
  });
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
  const dom = {
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
  const camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 20);
  camera.position.z = 4;
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.1),
    new THREE.MeshBasicMaterial(),
  );
  mesh.updateMatrixWorld();
  const beater = new Beater(camera, dom, () => mesh);
  const cloth = { setBeaterPose: vi.fn(), hasBeaterContact: () => false };
  const event = { button: 0, pointerId: 1, clientX: 400, clientY: 300 };
  const step = (count) => {
    for (let i = 0; i < count; i++) {
      beater.update(1 / 120);
      beater.beforePhysics(cloth, mesh);
      beater.afterPhysics(cloth);
    }
  };
  const dispose = () => {
    beater.dispose();
    mesh.geometry.dispose();
    mesh.material.dispose();
  };
  return { beater, cloth, mesh, event, step, dispose };
}
describe("beater event and kinematic integration without WASM", () => {
  it.each([1 / 60, 0.13])('grows combo after 8 and 12 real 400 ms holds / 250 ms releases with %s second frames', frameDt => {
    const { beater, cloth, mesh, event, dispose } = setup();
    cloth.integrate = vi.fn(); cloth.refreshGeometry = vi.fn();
    const game = new Game({ rng: () => 0 }); game.start();
    const times = [];
    const points = [];
    beater.onHit(hit => { times.push(game.time); points.push(game.onHit(hit)); });
    beater.onMiss = () => game.onHit({ miss: true });
    let accumulator = 0;
    const advance = seconds => {
      while (seconds > 1e-9) {
        const dt = Math.min(frameDt, seconds);
        accumulator = advanceGameplayFrame({ game, beater, cloth, mesh }, dt, accumulator);
        seconds -= dt;
      }
    };
    try {
      for (let i = 0; i < 12; i++) {
        beater.down(event); advance(0.4); beater.up(event); advance(0.25);
        if (i === 7) expect(game.comboMultiplier).toBeGreaterThanOrEqual(2);
      }
      expect(times).toHaveLength(12);
      expect(game.comboMultiplier).toBeGreaterThanOrEqual(3);
      expect(points[11]).toBeGreaterThanOrEqual(points[0] * 3 - 1);
      expect(game.time).toBeCloseTo(7.8, 5);
      for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeCloseTo(0.65, 5);
    } finally { dispose(); }
  });
  it('builds combo from eight 350 ms holds plus 250 ms gaps, timestamped at impact', () => {
    const {beater,cloth,mesh,event,dispose}=setup();
    const game=new Game({rng:()=>0});game.start();
    const times=[];
    beater.onHit(hit=>{times.push(game.time);game.onHit(hit);});
    const advance=count=>{for(let i=0;i<count;i++) {game.update(1/120);beater.update(1/120);beater.beforePhysics(cloth,mesh);beater.afterPhysics(cloth);}};
    for(let i=0;i<8;i++) {beater.down(event);advance(42);beater.up(event);advance(30);}
    expect(times).toHaveLength(8);
    expect(times[0]).toBeGreaterThan(0.35);
    for(let i=1;i<times.length;i++) expect(times[i]-times[i-1]).toBeCloseTo(0.6,5);
    expect(game.streak).toBe(7);expect(game.comboMultiplier).toBe(2);
    dispose();
  });
  it('selects the visible panel even when the hidden panel swings closer to the camera',()=>{
    const {beater,mesh,dispose}=setup();
    const geometry=new THREE.BufferGeometry();
    const positions=[],uvs=[],indices=[];
    for(const [layer,z,v] of [[0,.15,.75],[1,0,.25]]) {
      positions.push(-1,-1,z,1,-1,z,-1,1,z,1,1,z);
      for(let i=0;i<4;i++)uvs.push(.5,v);
      const n=layer*4;indices.push(n,n+1,n+2,n+2,n+1,n+3);
    }
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
    mesh.geometry.dispose();mesh.geometry=geometry;
    beater.isVisibleUv=uv=>uv.y<=.5;
    const hit=beater.aim(new THREE.Vector2(0,0));
    expect(hit.uv.y).toBe(.25);expect(hit.point.z).toBeCloseTo(0,8);dispose();
  });
  it("emits one impact after release and recovers with finite geometry", () => {
    const { beater, cloth, event, step, dispose } = setup();
    const hits = vi.fn();
    beater.onHit(event => {
      hits(event);
      const head = beater.headCenter.clone().applyMatrix4(beater.group.matrixWorld);
      expect(head.distanceTo(event.point)).toBeCloseTo(.018, 5);
      const face = new THREE.Vector3(0,0,1).applyQuaternion(beater.group.quaternion);
      expect(face.dot(event.normal)).toBeCloseTo(1, 5);
    });
    beater.down(event);
    step(26);
    expect(hits).not.toHaveBeenCalled();
    beater.up(event);
    step(45);
    expect(hits).toHaveBeenCalledTimes(1);
    expect(hits.mock.calls[0][0].strength).toBeGreaterThan(0.65);
    expect(hits.mock.calls[0][0].physicalContact).toBe(false);
    expect(beater.phase).toBe("idle");
    expect(cloth.setBeaterPose).toHaveBeenCalledTimes(71);
    beater.model.group.traverse(object => {
      if (object.geometry)
        expect(object.geometry.attributes.position.array.every(Number.isFinite)).toBe(true);
    });
    dispose();
  });
  it("consumes a moth swing once before carpet hits", () => {
    const { beater, event, step, dispose } = setup();
    const hits = vi.fn();
    beater.onHit(hits);
    beater.interceptSwing = vi.fn(() => true);
    beater.down(event);
    step(12);
    beater.up(event);
    step(45);
    expect(beater.interceptSwing).toHaveBeenCalledTimes(1);
    expect(hits).not.toHaveBeenCalled();
    dispose();
  });
  it("cancels a hold on pointer cancellation without a strike", () => {
    const { beater, event, step, dispose } = setup();
    const hits = vi.fn();
    beater.onHit(hits);
    beater.down(event);
    step(80);
    beater.cancel();
    beater.up(event);
    step(45);
    expect(hits).not.toHaveBeenCalled();
    expect(beater.phase).toBe("idle");
    dispose();
  });
});

it.each(BEATERS)('$id has uniform world scale at idle, full wind-up and strike', definition => {
  const { beater, event, dispose } = setup();
  try {
    beater.setBeater(definition.id);
    const check = () => {
      beater.update(0); beater.group.updateMatrixWorld(true);
      beater.group.traverse(object => {
        const scale = new THREE.Vector3().setFromMatrixScale(object.matrixWorld);
        expect(scale.x).toBeCloseTo(scale.y, 6); expect(scale.y).toBeCloseTo(scale.z, 6);
      });
    };
    check(); beater.down(event); beater.update(.8); check();
    beater.up(event);
    for (const seconds of [.025, .04, .02, .06, .135]) { beater.update(seconds); check(); }
  } finally { dispose(); }
});
