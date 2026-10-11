import { wind } from '../scene/wind.js';
import { AmbienceScheduler, distanceMix, selectFormats, voiceBudget } from './ambienceLogic.js';

const base = import.meta.env?.BASE_URL || '/';
/** Owns one optional soundscape. Never awaited by game startup. */
export class Ambience {
  constructor(context, master, {mobile = () => false, fetcher = (...args) => globalThis.fetch(...args), document = globalThis.document, canPlayType} = {}) {
    this.context=context; this.mobile=typeof mobile==='function'?mobile:()=>mobile;
    this.fetcher=fetcher; this.document=document;
    const audio=globalThis.Audio ? new Audio() : null;
    this.canPlayType=canPlayType || (mime=>audio?.canPlayType(mime) || '');
    this.bus=context.createGain(); this.bus.gain.value=1; this.bus.connect(master);
    this.buffers=new Map(); this.voices=new Set(); this.wanted=false; this.disposed=false;
    this.sync=()=>this._sync();
    document?.addEventListener('visibilitychange',this.sync);
    context.addEventListener?.('statechange',this.sync);
  }
  setEnabled(on) { this.wanted=Boolean(on); this._sync(); }
  _canRun() { return this.wanted && !this.disposed && !this.document?.hidden && this.context.state==='running'; }
  _sync() {
    if (this.context.state==='closed') { this.dispose(); return; }
    if (!this._canRun()) { this._stop(); return; }
    if (!this.loadPromise && !this.loaded) this.loadPromise=this._load().finally(()=>{this.loadPromise=null; if (this._canRun() && !this.loaded) this._sync();});
    if (this.loaded && !this.timer) this._start();
  }
  async _load() {
    const controller=new AbortController(); this.controller=controller;
    const timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await this.fetcher(`${base}audio/manifest.json`,{signal:controller.signal});
      if (!response.ok) return;
      const manifest=await response.json();
      if (manifest.version!==1 || !Array.isArray(manifest.clips)) return;
      for (const clip of manifest.clips.slice(0,16)) {
        if (!this._canRun() || controller.signal.aborted) return;
        if (!clip || typeof clip.id!=='string' || !(clip.duration>0 && clip.duration<=25)) continue;
        if (this.buffers.has(clip.id)) continue;
        for (const format of selectFormats(clip.formats,this.canPlayType)) {
          try {
            const file=await this.fetcher(`${base}audio/${format.file}`,{signal:controller.signal});
            if (!file.ok) continue;
            const bytes=await file.arrayBuffer();
            if (bytes.byteLength>300000) continue;
            const buffer=await this.context.decodeAudioData(bytes);
            if (this.disposed || controller.signal.aborted) return;
            if (!(buffer.duration>0 && buffer.duration<=25.1)) continue;
            this.buffers.set(clip.id,{...clip,buffer}); break;
          } catch { if (controller.signal.aborted) return; }
        }
      }
    } catch { /* Optional recordings never prevent synthesized gameplay audio. */ }
    finally {
      clearTimeout(timeout);
      if (this.controller===controller) this.controller=null;
      // Abort on mute/visibility allows a later gesture to finish the remaining cache.
      this.loaded=!controller.interrupted;
      if (this.loaded && this._canRun()) this._start();
    }
  }
  _start() {
    if (this.timer || !this._canRun()) return;
    const clips=[...this.buffers.values()];
    this.scheduler=new AmbienceScheduler(clips,{mobile:this.mobile(),random:Math.random});
    this.bus.gain.cancelScheduledValues(this.context.currentTime);
    this.bus.gain.setValueAtTime(1,this.context.currentTime);
    const bed=clips.find(c=>c.kind==='bed');
    if (bed) this._play(bed,{distance:.7,pan:-.12,rate:1},true);
    this._air(); this.lastTime=this.context.currentTime;
    this.timer=setInterval(()=>this._tick(),500);
  }
  _tick() {
    if (!this._canRun()) { this._stop(); return; }
    const time=this.context.currentTime, strength=wind.strength();
    this.airGain?.gain.setTargetAtTime(.004+strength*.012,time,.5);
    this.airFilter?.frequency.setTargetAtTime(350+strength*650,time,.5);
    this.scheduler.mobile=this.mobile();
    // Downgrading live also trims existing one-shots to the new phone budget.
    const shots=[...this.voices].filter(v=>!v.loop);
    while (shots.length>voiceBudget(this.mobile())-2) shots.pop().stop();
    for (const event of this.scheduler.advance(Math.min(1,time-this.lastTime),{activeVoices:Math.min(shots.length,voiceBudget(this.mobile())-2),wind:strength})) this._play(event.clip,event);
    this.lastTime=time;
  }
  _source(buffer, loop, nodes) {
    const source=this.context.createBufferSource(); source.buffer=buffer; source.loop=loop;
    nodes.unshift(source);
    const voice={loop,stop:()=>{ try{source.stop();}catch{} cleanup(); }};
    const cleanup=()=>{ source.onended=null; nodes.forEach(n=>n.disconnect()); this.voices.delete(voice); };
    source.onended=cleanup; this.voices.add(voice);
    return {source,voice};
  }
  _play(clip,{distance=.6,pan=0,rate=1},loop=false) {
    const context=this.context, time=context.currentTime, mix=distanceMix(clip.kind,distance);
    const filter=context.createBiquadFilter(), gain=context.createGain(), nodes=[filter,gain];
    filter.type='lowpass'; filter.frequency.value=mix.cutoff; filter.Q.value=.5;
    filter.connect(gain); gain.connect(this.bus);
    const {source}=this._source(clip.buffer,loop,nodes);
    source.playbackRate.value=rate;
    if (context.createStereoPanner) {
      const panner=context.createStereoPanner(); panner.pan.value=pan; nodes.push(panner); source.connect(panner); panner.connect(filter);
    } else source.connect(filter);
    gain.gain.setValueAtTime(0,time); gain.gain.linearRampToValueAtTime(mix.gain,time+.15);
    if (!loop) {
      const end=time+clip.buffer.duration/rate;
      gain.gain.setValueAtTime(mix.gain,Math.max(time+.15,end-.25)); gain.gain.linearRampToValueAtTime(0,end);
    }
    source.start();
  }
  _air() {
    const context=this.context, buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate), data=buffer.getChannelData(0);
    for (let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
    const filter=context.createBiquadFilter(), gain=context.createGain();
    filter.type='lowpass'; filter.frequency.value=450; filter.Q.value=.5; gain.gain.value=.005;
    filter.connect(gain); gain.connect(this.bus);
    const {source}=this._source(buffer,true,[filter,gain]); source.connect(filter); source.start();
    this.airGain=gain; this.airFilter=filter;
  }
  duck() {
    if (!this._canRun() || !this.timer) return;
    const time=this.context.currentTime, gain=this.bus.gain;
    gain.cancelScheduledValues(time); gain.setValueAtTime(Math.min(1,gain.value),time);
    gain.linearRampToValueAtTime(.28,time+.012); gain.linearRampToValueAtTime(1,time+.15);
  }
  _stop() {
    if (this.timer) clearInterval(this.timer); this.timer=null;
    if (this.controller) { this.controller.interrupted=true; this.controller.abort(); }
    for (const voice of [...this.voices]) voice.stop();
    this.airGain=null; this.airFilter=null;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed=true; this._stop(); this.buffers.clear(); this.bus.disconnect();
    this.document?.removeEventListener('visibilitychange',this.sync);
    this.context.removeEventListener?.('statechange',this.sync);
  }
}
