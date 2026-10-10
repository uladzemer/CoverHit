import {it,expect} from 'vitest';
import {loadPhysicsAmmo,amplitudeCases,measureThrow} from '../scripts/flip-amplitude-physics.mjs';

it('throws the real Ammo hem above the pipe with a broad smooth arc at both render rates',async()=>{
  const ammo=await loadPhysicsAmmo();
  for(const test of await amplitudeCases(ammo))for(const hz of [60,30])for(const style of ['both','corner']) {
    const c=test.create();
    try {
      const r=measureThrow(c,style,hz);
      expect(r.peak,`${test.id}/${style}/${hz} hem peak`).toBeGreaterThanOrEqual(.55);
      expect(r.sweep,`${test.id}/${style}/${hz} depth sweep`).toBeGreaterThanOrEqual(1.6);
      expect(r.duration).toBeGreaterThanOrEqual(1.2);expect(r.duration).toBeLessThanOrEqual(1.7);
      expect(r.spread).toBeGreaterThanOrEqual(style==='corner'?.25:.15);
      expect(r.crestEndSpread,`${test.id}/${style}/${hz} hem crest travel`).toBeGreaterThanOrEqual(style==='corner'?.25:.15);
      if(hz===60)expect(r.jump).toBeLessThanOrEqual(.35);
      expect(r.speed).toBeLessThanOrEqual(9.00001);expect(r.extent).toBeLessThan(3);expect(r.recoveries).toBe(0);
      for(const g of c.lastFlip.grips)expect(c.nodes.at(g.i).get_m_im()).toBe(g.inverseMass);
    } finally {c.dispose();}
  }
},60000);
