import {it,expect} from 'vitest';
import {laundry,laundryPositions,laundryHeight,servicePad,inside} from '../src/scene/yard/layout.js';
it('keeps laundry, posts and garment edges in the rear service pad',()=>{
 for(const z of [laundry.from,laundry.to,...laundryPositions])for(const x of laundry.lines)expect(inside(servicePad,x,z)).toBe(true);
 for(const z of laundryPositions){expect(z+.15).toBeLessThan(0);expect(z-.15).toBeGreaterThan(servicePad.z0);expect(laundryHeight(z)).toBeGreaterThan(2.5);}
 expect(laundryHeight(laundry.from)).toBeCloseTo(2.74);expect(laundryHeight(laundry.to)).toBeCloseTo(2.74);
});
