import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--ch-([\w-]+):\s*(#[\da-f]{6}|rgba\([^;]+\))/gi)].map(m => [m[1],m[2]]));
const rgb = value => value.startsWith('#') ? [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)) : value.match(/[\d.]+/g).map(Number);
const lum = color => rgb(color).slice(0,3).map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
const ratio = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
// A translucent surface is tested over both extremes; white is its worst case.
const panel = backdrop => { const c=rgb(tokens.panel);return '#'+c.slice(0,3).map(v=>Math.round(v*c[3]+backdrop*(1-c[3])).toString(16).padStart(2,'0')).join(''); };
export const pairs = [
 ['ink','paper'],['red','paper'],['red-dark','paper'],['muted','paper'],['green-dark','paper'],
 ['paper','red'],['paper','red-dark'],['paper','red-light'],['ink','ochre'],['ink','green'],
 ['paper','ink'],['ochre','ink'],['green','ink'],
 ...[0,255].flatMap(v=>['paper'].map(f=>[f,`panel/${v}`,panel(v)])),
];
describe('all HUD text token pairs meet WCAG AA (including small text)',()=>{
 for(const [fg,bg,resolved] of pairs) it(`${fg} / ${bg}`,()=>{
   const result=ratio(tokens[fg],resolved||tokens[bg]);
   console.log(`${fg.padEnd(12)} / ${bg.padEnd(12)} ${result.toFixed(2)}:1`);
   expect(result).toBeGreaterThanOrEqual(4.5);
 });
});
