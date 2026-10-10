import { seededRandom } from './random.js';

export const WINDUP = .25;
export const RELEASE = .95;
const smooth = t => { t=Math.max(0,Math.min(1,t));return t*t*(3-2*t); };

// Pure gesture description: no native allocations, material/mass changes or RNG
// consumption during a step. Tests may force a style without changing the seed.
export function handThrow(cloth, seed, style) {
  const rng=seededRandom(seed);
  style ??= rng()<.3?'corner':'both';
  const leading=rng()<.5?0:1, delay=.18+rng()*.04, lead=.03+rng()*.07;
  const acrossCount=cloth.foldAxis==='u'?cloth.rows:cloth.cols;
  const end=cloth.visibleSide===0?0:(cloth.foldAxis==='u'?cloth.cols:cloth.rows);
  const grips=[];
  for(const fraction of style==='corner'?[leading===0?0:1]:[.15,.85]) {
    const column=Math.round(fraction*acrossCount);
    for(let offset=-1;offset<=1;offset++) {
      const c=column+offset;if(c<0||c>acrossCount)continue;
      const i=cloth.foldAxis==='u'?c*(cloth.cols+1)+end:end*(cloth.cols+1)+c;
      grips.push({i,column:c,delay:(fraction<.5?0:1)===leading?0:delay});
    }
  }
  return {style,leading,delay,lead,grips,spread:style==='corner'?.32:.2,launchSpread:style==='corner'?.46:.2};
}

export function handPosition(start, axis, age, delay, lead) {
  const wind=smooth((age-delay)/WINDUP), t=smooth((age-WINDUP-delay)/(RELEASE-WINDUP));
  // A compact scooping arc bunches the hem before it clears the crown.
  const lift=Math.sin(Math.PI*t);
    return [start[0],start[1]-.055*wind+(axis.y-start[1]+.8+lead)*lift,
    axis.z+(start[2]-axis.z-.1*wind)*Math.cos(Math.PI*t)-.85*Math.sin(2*Math.PI*t)];
}
