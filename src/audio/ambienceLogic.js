import { clamp01 } from './parameters.js';

export function seededAudioRandom(seed = 464) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export const voiceBudget = mobile => mobile ? 4 : 8; // Includes traffic and air.
export function selectFormats(formats, canPlayType) {
  return (Array.isArray(formats) ? formats : []).filter(f =>
    f && /^[a-z0-9-]+\.(m4a|mp3|wav|ogg|opus)$/.test(f.file) &&
    typeof f.mime === 'string' && ['probably','maybe'].includes(canPlayType(f.mime))
  ).sort((a,b) => Number(!/\.(m4a|mp3|wav)$/.test(a.file)) - Number(!/\.(m4a|mp3|wav)$/.test(b.file)));
}

// Sunset: scattered calls and play, with long quiet gaps between courtyard props.
const intervals = {birds:[7,17],kids:[16,32],dog:[38,78],swing:[25,55],tram:[65,115],door:[40,90],window:[48,100]};
export class AmbienceScheduler {
  constructor(clips, {random = seededAudioRandom(), mobile = false} = {}) {
    this.random = random; this.mobile = mobile; this.time = 0;
    this.groups = Object.keys(intervals).map(kind => ({kind,clips:clips.filter(c=>c.kind===kind),due:2+random()*intervals[kind][1]})).filter(g=>g.clips.length);
  }
  advance(dt, {activeVoices = 0, wind = 0} = {}) {
    this.time += Math.max(0, Number.isFinite(dt) ? dt : 0);
    const events = [];
    for (const group of this.groups) {
      if (group.due > this.time) continue;
      const [min,max] = intervals[group.kind];
      // Wind masks/quietens birds; phone event rate is half desktop's.
      const activity = group.kind === 'birds' ? 1 - clamp01(wind)*0.45 : 1;
      group.due = this.time + (min + this.random()*(max-min)) * (this.mobile?2:1) / activity;
      if (activeVoices + events.length >= voiceBudget(this.mobile)-2) continue;
      const clip = group.clips[Math.floor(this.random()*group.clips.length)];
      events.push({clip,pan:(this.random()-.5)*.65,distance:.35+this.random()*.55,rate:.97+this.random()*.06});
    }
    return events;
  }
}

export function distanceMix(kind, distance) {
  const d=clamp01(distance), base={bed:.18,birds:.16,kids:.12,dog:.13,swing:.1,tram:.13,door:.12,window:.1}[kind] || .1;
  return {gain:base*(1-d*.75),cutoff:kind==='birds'?5200-d*2600:3200-d*2400};
}
