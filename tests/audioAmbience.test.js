import { describe, it, expect, vi, afterEach } from 'vitest';
import { AmbienceScheduler, seededAudioRandom, voiceBudget, selectFormats, distanceMix } from '../src/audio/ambienceLogic.js';
import { Ambience } from '../src/audio/ambience.js';

const clips=['birds','birds','kids','kids','dog','swing','tram','door','window'].map((kind,i)=>({kind,id:String(i),duration:3}));
describe('courtyard scheduler',()=>{
  const run=(mobile=false,wind=0)=>{
    const scheduler=new AmbienceScheduler(clips,{mobile,random:seededAudioRandom(23)}), events=[];
    for(let i=0;i<3600;i++) events.push(...scheduler.advance(.5,{wind}));
    return events;
  };
  it('replays the same seeded sequence, including spatial variation',()=>{
    expect(run()).toEqual(run());
    expect(run().length).toBeGreaterThan(100);
    for(const e of run()){expect(Math.abs(e.pan)).toBeLessThanOrEqual(.325);expect(e.rate).toBeGreaterThanOrEqual(.97);expect(e.rate).toBeLessThanOrEqual(1.03);}
  });
  it('halves phone density and includes both beds in the voice cap',()=>{
    expect(voiceBudget(true)).toBe(voiceBudget(false)/2);
    expect(run(true).length/run().length).toBeGreaterThan(.4);
    expect(run(true).length/run().length).toBeLessThan(.6);
    for(const mobile of [false,true]){
      const s=new AmbienceScheduler(clips,{mobile});
      expect(s.advance(200,{activeVoices:voiceBudget(mobile)-2})).toEqual([]);
      expect(s.advance(.1)).toEqual([]); // Missed events do not burst when voices free.
      expect(s.advance(200,{activeVoices:voiceBudget(mobile)-3})).toHaveLength(1);
    }
  });
  it('quietens birds in strong wind and filters distant voices',()=>{
    expect(run(false,1).filter(e=>e.clip.kind==='birds').length).toBeLessThan(run(false,0).filter(e=>e.clip.kind==='birds').length);
    for(const kind of ['kids','dog','tram','birds']){
      expect(distanceMix(kind,1).gain).toBeLessThan(distanceMix(kind,0).gain);
      expect(distanceMix(kind,1).cutoff).toBeLessThan(distanceMix(kind,0).cutoff);
    }
  });
});

describe('audio format negotiation',()=>{
  const formats=[{file:'birds.ogg',mime:'audio/ogg; codecs=opus'},{file:'birds.m4a',mime:'audio/mp4; codecs="mp4a.40.2"'}];
  it('prefers AAC, supports iOS-only and Opus-only devices, and rejects unsupported formats',()=>{
    expect(selectFormats(formats,()=> 'probably').map(f=>f.file)).toEqual(['birds.m4a','birds.ogg']);
    expect(selectFormats(formats,m=>m.startsWith('audio/mp4')?'maybe':'')).toEqual([formats[1]]);
    expect(selectFormats(formats,m=>m.startsWith('audio/ogg')?'probably':'')).toEqual([formats[0]]);
    expect(selectFormats(formats,()=> '')).toEqual([]);
    expect(selectFormats(null,()=> 'probably')).toEqual([]);
  });
  it('only fetches safe manifest filenames',()=>{
    expect(selectFormats([{file:'../missing.m4a',mime:'audio/mp4'},{file:'https://other/test.ogg',mime:'audio/ogg'},null],()=> 'probably')).toEqual([]);
  });
});

function fixture(fetcher, options={}) {
  const nodes=[], listeners=new Map();
  const param=()=>({value:1,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),setTargetAtTime:vi.fn(),cancelScheduledValues:vi.fn()});
  const node=()=>{const n={connect:vi.fn(),disconnect:vi.fn(),gain:param(),frequency:param(),Q:param(),pan:param(),playbackRate:param(),start:vi.fn(),stop:vi.fn()}; nodes.push(n);return n;};
  const context={state:'running',currentTime:0,sampleRate:1000,createGain:node,createBiquadFilter:node,createBufferSource:node,createStereoPanner:node,createBuffer:()=>({getChannelData:()=>new Float32Array(2000)}),decodeAudioData:vi.fn(async()=>({duration:3})),addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:vi.fn()};
  const document={hidden:false,addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:vi.fn()};
  const ambience=new Ambience(context,node(),{fetcher,document,canPlayType:()=> 'probably',...options});
  return {ambience,context,document,nodes,listeners};
}
const manifest={version:1,clips:[{id:'bed',kind:'bed',duration:3,formats:[{file:'bed.m4a',mime:'audio/mp4'}]},...clips.map(c=>({...c,formats:[{file:`clip-${c.id}.m4a`,mime:'audio/mp4'}]}))]};
const fetchGood=()=>vi.fn(async url=>url.endsWith('.json')?{ok:true,json:async()=>manifest}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
afterEach(()=>vi.useRealTimers());
describe('mixer lifecycle',()=>{
  it('does not fetch before play, releases voices on hiding/mute and resumes on unlock',async()=>{
    vi.useFakeTimers(); const fetcher=fetchGood(),f=fixture(fetcher,{mobile:true});
    expect(fetcher).not.toHaveBeenCalled();
    f.ambience.setEnabled(true); await vi.advanceTimersByTimeAsync(1);
    expect(f.ambience.voices.size).toBe(2);
    for(let i=0;i<80;i++){f.context.currentTime+=.5;await vi.advanceTimersByTimeAsync(500);expect(f.ambience.voices.size).toBeLessThanOrEqual(4);}
    const count=fetcher.mock.calls.length;
    f.document.hidden=true; f.listeners.get('visibilitychange')();
    expect(f.ambience.voices.size).toBe(0);expect(f.ambience.timer).toBeNull();
    f.context.state='suspended'; f.document.hidden=false; f.listeners.get('visibilitychange')();
    expect(f.ambience.voices.size).toBe(0);
    f.context.state='running';f.listeners.get('statechange')();
    expect(f.ambience.voices.size).toBe(2);expect(fetcher.mock.calls.length).toBe(count);
    f.ambience.duck();expect(f.ambience.bus.gain.linearRampToValueAtTime).toHaveBeenCalledWith(.28,f.context.currentTime+.012);
    expect(f.ambience.bus.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1,f.context.currentTime+.15);
    f.ambience.setEnabled(false);expect(f.ambience.voices.size).toBe(0);
    f.ambience.dispose();expect(f.document.removeEventListener).toHaveBeenCalled();expect(f.context.removeEventListener).toHaveBeenCalled();
    expect(f.nodes.every(n=>n.disconnect.mock.calls.length || n===f.nodes[0])).toBe(true);
  });
  it('cleans finished one-shot graphs and trims live profile downgrades',async()=>{
    vi.useFakeTimers();let mobile=false;const f=fixture(fetchGood(),{mobile:()=>mobile});
    f.ambience.setEnabled(true);await vi.advanceTimersByTimeAsync(1);
    const clip=[...f.ambience.buffers.values()].find(c=>c.kind==='birds');
    for(let i=0;i<6;i++)f.ambience._play(clip,{});
    expect(f.ambience.voices.size).toBe(8);mobile=true;f.context.currentTime=.5;f.ambience._tick();expect(f.ambience.voices.size).toBe(4);
    const source=f.nodes.find(n=>n.onended && !n.loop);source.onended();expect(source.disconnect).toHaveBeenCalled();expect(f.ambience.voices.size).toBe(3);
    f.ambience.dispose();
  });
  it('gracefully handles unavailable manifest without probing guessed filenames',async()=>{
    vi.useFakeTimers();const fetcher=vi.fn(async()=>({ok:false})),f=fixture(fetcher);
    f.ambience.setEnabled(true);await vi.advanceTimersByTimeAsync(1);f.ambience.setEnabled(false);f.ambience.setEnabled(true);
    expect(fetcher).toHaveBeenCalledTimes(1);expect(f.ambience.buffers.size).toBe(0);f.ambience.dispose();
  });
  it('tries a declared format fallback after decode failure',async()=>{
    vi.useFakeTimers();const formats=[{file:'bed.m4a',mime:'audio/mp4'},{file:'bed.ogg',mime:'audio/ogg'}];
    const fetcher=vi.fn(async url=>url.endsWith('.json')?{ok:true,json:async()=>({version:1,clips:[{...manifest.clips[0],formats}]})}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
    const f=fixture(fetcher);f.context.decodeAudioData.mockRejectedValueOnce(Error('unsupported codec'));
    f.ambience.setEnabled(true);await vi.advanceTimersByTimeAsync(1);
    expect(fetcher.mock.calls.map(c=>c[0])).toEqual(['/audio/manifest.json','/audio/bed.m4a','/audio/bed.ogg']);
    expect(f.ambience.buffers.size).toBe(1);f.ambience.dispose();
  });
  it('cancels an in-flight load on mute and handles an immediate unmute',async()=>{
    vi.useFakeTimers();let first=true;
    const good=fetchGood(), fetcher=vi.fn((url,options)=>{
      if(!first)return good(url,options);
      first=false;
      return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
    });
    const f=fixture(fetcher);f.ambience.setEnabled(true);f.ambience.setEnabled(false);f.ambience.setEnabled(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.ambience.buffers.size).toBe(manifest.clips.length);expect(f.ambience.voices.size).toBe(2);f.ambience.dispose();
  });
  it('does not load in a hidden tab and releases ownership when the context closes',async()=>{
    vi.useFakeTimers();const fetcher=fetchGood(),f=fixture(fetcher);
    f.document.hidden=true;f.ambience.setEnabled(true);expect(fetcher).not.toHaveBeenCalled();
    f.document.hidden=false;f.listeners.get('visibilitychange')();await vi.advanceTimersByTimeAsync(1);
    f.context.state='closed';f.listeners.get('statechange')();
    expect(f.ambience.disposed).toBe(true);expect(f.ambience.buffers.size).toBe(0);expect(f.ambience.voices.size).toBe(0);
  });
});
