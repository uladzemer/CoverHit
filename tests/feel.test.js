import { describe, it, expect } from 'vitest';
import { feel, strikeQuality, hitStopSeconds, effectTimeScale, shakeAmount, soundIntensity } from '../src/game/feel.js';
import { dirtLook, createDirtNoise, DirtMap, findDirtyZones } from '../src/carpet/dirt.js';
import { Game } from '../src/game/state.js';
import { advanceGameplayFrame } from '../src/game/frame.js';
const strength = charge => .25 + .75 * charge;
describe('strike feel', () => {
  it('includes both ideal boundaries but rejects overcharge', () => {
    for (const q of feel.idealWindow) expect(strikeQuality(strength(q))).toBe('excellent');
    expect(strikeQuality(strength(.619))).toBe('good');
    expect(strikeQuality(strength(.821))).toBe('good');
    expect(strikeQuality(strength(.399))).toBe('weak');
    expect(strikeQuality(strength(.4))).toBe('good');
    expect(strikeQuality(NaN)).toBe('weak');
  });
  it('scales stop to 40?60ms and disables motion on request', () => {
    expect(hitStopSeconds(0)).toBe(.04); expect(hitStopSeconds(1)).toBe(.06);
    expect(hitStopSeconds(.5)).toBeCloseTo(.05);
    expect(effectTimeScale(.01)).toBe(.08); expect(effectTimeScale(0)).toBe(1);
    expect(effectTimeScale(.05,true)).toBe(1); expect(shakeAmount(.02,1,true)).toBe(0);
    expect(shakeAmount(.035,1)).toBe(.035); expect(soundIntensity(2)).toBe(1);
  });
  it('awards 25% only in the ideal window and emits HUD quality', () => {
    const game = new Game(); game.start(); const events=[]; game.on('hit', e=>events.push(e));
    const s=strength(.7); expect(game.onHit({strength:s})).toBe(Math.round(10*s*1.25));
    expect(events[0].quality).toBe('excellent');
    expect(game.onHit({strength:1})).toBe(10); expect(events[1].quality).toBe('good');
  });
  it('visual dips preserve fixed physics and game time during hitches', () => {
    let gameTime=0, visualTime=0, physicsTime=0;
    const game={update:dt=>gameTime+=dt};
    const beater={update:dt=>visualTime+=dt*effectTimeScale(.05),beforePhysics(){},afterPhysics(){}};
    const cloth={integrate:dt=>physicsTime+=dt,refreshGeometry(){}};
    advanceGameplayFrame({game,beater,cloth},.25);
    expect(gameTime).toBeCloseTo(.25); expect(physicsTime).toBeCloseTo(.25); expect(visualTime).toBeCloseTo(.02);
  });
  it('starts and resets the visible side before publishing playing state', () => {
    const game=new Game(); expect(game.visibleSide).toBe(0); game.start();
    game.visibleSide=1; game.setState('carpetDone'); let side;
    game.on('state',()=>side=game.visibleSide); game.nextCarpet(); expect(side).toBe(0);
  });
});
describe('matte dirt film', () => {
  it('preserves a clean scan exactly and fades smoothly', () => {
    expect(dirtLook(0)).toEqual({film:0,desaturation:0,brightness:1});
    expect(dirtLook(1).desaturation).toBeGreaterThan(.3);
    expect(dirtLook(1).brightness).toBeLessThan(.82);
    expect(dirtLook(.001).film).toBeLessThan(.00001);
    expect(dirtLook(.999).film).toBeGreaterThan(.99999);
    expect(dirtLook(NaN)).toEqual(dirtLook(0));
  });
  it('invalidates side summaries after strikes and direct uploaded mask edits', () => {
    const dirt=new DirtMap({size:32,foldAxis:'v'});expect(dirt.halfCleanliness(0)).toBe(0);
    dirt.hit(.5,.25,1);expect(dirt.halfCleanliness(0)).toBeGreaterThan(0);expect(dirt.halfCleanliness(1)).toBe(0);
    dirt.grid.fill(0);dirt.texture.needsUpdate=true;
    expect(dirt.halfCleanliness(0)).toBe(1);expect(dirt.halfCleanliness(1)).toBe(1);dirt.texture.dispose();
  });
  it('finds an off-grid peak only on the displayed side', () => {
    const dirt=new DirtMap({size:32,foldAxis:'v'});dirt.grid.fill(.1);
    dirt.grid[3*32+7]=.9;dirt.grid[20*32+7]=1;
    const zones=findDirtyZones(dirt);expect(zones[0].value).toBeCloseTo(.9);
    expect(zones[0].u).toBe(7.5/32);expect(zones[0].v).toBe(3.5/32);
    dirt.visibleSide=1;expect(findDirtyZones(dirt)[0].value).toBe(1);dirt.texture.dispose();
  });
  it('generates tiny deterministic non-colour noise', () => {
    const a=createDirtNoise(),b=createDirtNoise(); expect(a.image.data).toEqual(b.image.data);
    expect(a.image.data.length).toBe(1024); a.dispose();b.dispose();
  });
  it('clears the displayed half without changing the hidden half', () => {
    for(const foldAxis of ['u','v']) {
      const dirt=new DirtMap({foldAxis,size:32}); const u=foldAxis==='u'?.75:.5,v=foldAxis==='v'?.25:.5;
      dirt.hit(u,v,1);expect(dirt.halfCleanliness(0)).toBeGreaterThan(0);expect(dirt.halfCleanliness(1)).toBe(0);
      dirt.visibleSide=1; dirt.hit(1-u,1-v,1);expect(dirt.halfCleanliness(1)).toBeGreaterThan(0);dirt.texture.dispose();
    }
  });
});
