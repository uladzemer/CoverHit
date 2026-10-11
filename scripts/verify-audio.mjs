import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium, webkit } from 'playwright';
import { validateAudio } from './validate-audio.mjs';

const out='docs/qa/audio';await mkdir(out,{recursive:true});
const report={assets:await validateAudio(),browsers:{}};
const html=`<!doctype html><link rel="icon" href="data:,"><button id="start">Start courtyard</button><script type="module">
import { Sfx } from '/src/audio/sfx.js';
import { wind } from '/src/scene/wind.js';
window.sfx=new Sfx({mobile:()=>window.phone});
window.phone=false;window.hidden=false;
document.getElementById('start').onclick=()=>{void sfx.unlock();sfx.ambience(true);};
Object.defineProperty(document,'hidden',{get:()=>window.hidden});
window.wind=wind;window.ready=true;
</script>`;
const server=await createServer({server:{host:'127.0.0.1',port:5196,strictPort:true},plugins:[{name:'audio-qa-fixture',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url!=='/audio-qa'){next();return;}res.setHeader('Content-Type','text/html');res.end(html);});}}]});
await server.listen();
try {
  for(const name of ['chromium','webkit']) {
    const browser=await (name==='chromium'?chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}):webkit.launch({headless:true}));
    try {
      const page=await browser.newPage(), errors=[], requests=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      page.on('response',r=>{if(r.status()>=400) console.error('HTTP',r.status(),r.url());});
      page.on('request',r=>{if(r.url().includes('/audio/'))requests.push(r.url());});
      await page.goto('http://127.0.0.1:5196/audio-qa');await page.waitForFunction(()=>window.ready);
      const capabilities=await page.evaluate(()=>({audioContext:typeof (globalThis.AudioContext||globalThis.webkitAudioContext),aac:new Audio().canPlayType('audio/mp4; codecs="mp4a.40.2"'),opus:new Audio().canPlayType('audio/ogg; codecs=opus')}));
      if(capabilities.audioContext==='undefined'){
        await page.click('#start');await page.waitForTimeout(200);
        assert.equal(requests.filter(u=>u.includes('/audio/manifest.json')).length,0);assert.deepEqual(errors,[]);
        report.browsers[name]={capabilities,skipped:true,reason:'Installed Windows WebKit exposes no AudioContext. Real iOS playback/unlock remains unverified.',gracefulNoAudio:true,errors};
        continue;
      }
      const beforePlay=requests.filter(u=>/\/audio\/(manifest|[^/]+\.(m4a|ogg))/.test(u));assert.equal(beforePlay.length,0);
      // A game start while muted must not fetch a manifest or recordings.
      await page.evaluate(()=>sfx.setVolume(0));await page.click('#start');
      await page.waitForTimeout(200);assert.equal(requests.filter(u=>u.includes('/audio/manifest.json')).length,0);
      await page.evaluate(()=>sfx.setVolume(.8));
      try { await page.waitForFunction(()=>window.sfx._yard?.loaded,null,{timeout:20000}); }
      catch(error) { console.error(name,await page.evaluate(()=>({context:sfx.context?.state,volume:sfx.volume,wanted:sfx._ambienceWanted,importing:!!sfx._yardImport,pending:!!sfx._unlockPending,yard:sfx._yard?{loaded:sfx._yard.loaded,buffers:sfx._yard.buffers.size,wanted:sfx._yard.wanted}:null}))); throw error; }
      const decoded=await page.evaluate(()=>[...sfx._yard.buffers.values()].map(c=>({id:c.id,duration:c.buffer.duration,channels:c.buffer.numberOfChannels,sampleRate:c.buffer.sampleRate})));
      assert.equal(decoded.length,10);assert(decoded.every(c=>c.channels===1 && c.duration<=25.1));
      // Explicitly check both shipped formats with the actual decoder.
      const formats=await page.evaluate(async()=>{
        const manifest=await(await fetch('/audio/manifest.json')).json(),results=[];
        for(const clip of manifest.clips)for(const format of clip.formats){
          if(!new Audio().canPlayType(format.mime)){results.push({file:format.file,supported:false});continue;}
          try{const buffer=await sfx.context.decodeAudioData(await(await fetch('/audio/'+format.file)).arrayBuffer());results.push({file:format.file,supported:true,duration:buffer.duration});}
          catch(e){results.push({file:format.file,supported:true,error:String(e)});}
        }return results;
      });
      assert(formats.filter(f=>f.supported).every(f=>!f.error));
      // Exercise the sunset scheduler over 120 simulated active seconds while sources run on the real audio clock.
      const performance=await page.evaluate(()=>{
        const yard=sfx._yard, samples=[];let maxVoices=0;
        for(let i=0;i<240;i++){
          wind.update(.5);yard.lastTime=sfx.context.currentTime-.5;
          const begin=window.performance.now();yard._tick();samples.push(window.performance.now()-begin);
          maxVoices=Math.max(maxVoices,yard.voices.size);
        }
        window.phone=true;yard._tick();const phoneVoices=yard.voices.size;
        for(const voice of [...yard.voices])if(!voice.loop)voice.stop();
        const bird=[...yard.buffers.values()].find(c=>c.kind==='birds');yard._play(bird,{}); // Real completion cleanup.
        window.finished=[...yard.voices].filter(v=>!v.loop);
        samples.sort((a,b)=>a-b);
        return {meanTickMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95TickMs:samples[Math.floor(samples.length*.95)],maxVoices,phoneVoices,airGain:yard.airGain.gain.value,wind:wind.strength()};
      });
      assert(performance.maxVoices<=8);assert(performance.phoneVoices<=4);
      await page.waitForTimeout(9000);
      assert.equal(await page.evaluate(()=>finished.some(v=>sfx._yard.voices.has(v))),false);
      performance.airGainSettled=await page.evaluate(()=>sfx._yard.airGain.gain.value);
      assert(Math.abs(performance.airGainSettled-(.004+performance.wind*.012))<.001);
      await page.evaluate(()=>{window.hidden=true;document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await page.evaluate(()=>sfx._yard.voices.size),0);
      await page.evaluate(()=>{window.hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await page.evaluate(()=>sfx._yard.voices.size),2);
      await page.evaluate(()=>sfx.context.suspend());assert.equal(await page.evaluate(()=>sfx._yard.voices.size),0);
      await page.click('#start');await page.waitForFunction(()=>sfx._yard.voices.size===2);
      await page.evaluate(()=>sfx.hit(.8));await page.waitForTimeout(200);
      assert(Math.abs(await page.evaluate(()=>sfx._yard.bus.gain.value)-1)<.01);
      await page.evaluate(()=>sfx.setVolume(0));assert.equal(await page.evaluate(()=>sfx._yard.voices.size),0);
      await page.evaluate(()=>sfx.dispose());assert.equal(await page.evaluate(()=>sfx._yard),null);
      assert.deepEqual(errors,[]);
      report.browsers[name]={capabilities,decoded,formats,performance,errors,beforePlayRequests:beforePlay.length,passed:true};
    } finally {await browser.close();}
  }
  report.passed=true;
} finally {
  await server.close();await writeFile(`${out}/browser.json`,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
