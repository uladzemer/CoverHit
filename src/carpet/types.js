import { seededRandom } from './random.js';
export const CARPET_TYPES = [
  { id:'palas', nameRu:'Палас', size:{width:1.5,height:2.2}, mass:2, stiffness:0.82, bending:0.10, slack:0.065, aeroDrag:1.15, damping:0.018, dirtAmount:0.95, pile:0.002 },
  { id:'wool', nameRu:'Ковёр шерстяной', size:{width:2,height:3}, mass:6, stiffness:0.90, bending:0.22, slack:0.05, aeroDrag:0.65, damping:0.025, dirtAmount:1.05, pile:0.009 },
  { id:'runner', nameRu:'Дорожка', size:{width:0.9,height:3}, mass:2.5, stiffness:0.86, bending:0.14, slack:0.055, aeroDrag:0.95, damping:0.02, dirtAmount:1, pile:0.004 },
  { id:'tapestry', nameRu:'Гобелен', size:{width:2.7,height:2.2}, mass:2.5, stiffness:0.94, bending:0.28, slack:0.025, aeroDrag:1.1, damping:0.03, dirtAmount:1, pile:0.0015 },
];
export function carpetType(id) { return CARPET_TYPES.find(t=>t.id===id); }
// Each bag contains every type once; avoid repeating across bag boundaries.
export function createTypeSequence(seed) {
  const random=seededRandom(`${seed}:types`); let bag=[], previous;
  return () => {
    if (!bag.length) {
      bag=[...CARPET_TYPES];
      for(let i=bag.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; }
      if(bag.at(-1).id===previous) [bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];
    }
    const next=bag.pop(); previous=next.id; return next;
  };
}
