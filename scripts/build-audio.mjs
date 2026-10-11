// Reproducible field-recording derivatives. Originals stay in ignored artifacts/.
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
const selections = [
  ['kids-a','kids','209901 foongaz city-playground-boxhagenerplatz-berlin.wav',8,8],
  ['kids-b','kids','209901 foongaz city-playground-boxhagenerplatz-berlin.wav',30,8],
  ['sparrows-a','birds','Joseph Sardin - Passer domesticus tschilp call.oga',0,5],
  ['sparrows-b','birds','House Sparrow 202279702.wav',0,6],
  ['traffic','bed','Sunday in the city street noise1.ogg',35,24],
  ['dog','dog','Personality-of-Wild-Male-Crested-Macaques-(Macaca-nigra)-pone.0069383.s001.oga',0,5],
  ['swing','swing','Playground swings (Gravity Sound).wav',0,6],
  ['tram','tram','Tram sound in Lyon, France.ogg',0,12],
  ['door','door','Slam closet door (Gravity Sound).wav',0,3],
  ['window','window','Flapping window opening.ogg',0,4],
];
await mkdir('public/audio',{recursive:true});
await mkdir('artifacts/audio-source',{recursive:true});
await mkdir('docs/qa/audio',{recursive:true});
const clips=[], credits=[], evidence=[];
for (const [id,kind,title,start,seconds] of selections) {
  const api=new URL('https://commons.wikimedia.org/w/api.php');
  api.search=new URLSearchParams({action:'query',format:'json',titles:`File:${title}`,prop:'imageinfo',iiprop:'url|extmetadata|size'});
  const json=await (await fetch(api)).json();
  const info=Object.values(json.query.pages)[0].imageinfo?.[0];
  if (!info) throw Error(`Missing Commons file: ${title}`);
  const m=info.extmetadata, license=m.LicenseShortName?.value;
  if (!/^(CC0|CC BY |Public domain)/.test(license)) throw Error(`Unapproved licence: ${license}`);
  const url=info.url.split('?')[0], sourceUrl=info.descriptionurl;
  const author=m.Artist?.value.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim();
  if (!author) throw Error(`Missing author: ${title}`);
  const original=`artifacts/audio-source/${encodeURIComponent(title)}`;
  try { await stat(original); } catch {
    let response;
    for (let attempt=0;attempt<5;attempt++) {
      response=await fetch(url,{headers:{'User-Agent':'CoverHit-audio-assets/1.0 (CC0/CC-BY courtyard game; Wikimedia Commons)'}});
      if (response.status!==429 && response.status!==503) break;
      await new Promise(resolve=>setTimeout(resolve,10000*(attempt+1)));
    }
    if (!response.ok) throw Error(`Download ${response.status}: ${title}`);
    await writeFile(original,Buffer.from(await response.arrayBuffer()));
  }
  const pcm=`artifacts/audio-source/${id}.wav`;
  const run=args=>{ const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'}); if(r.status!==0)throw Error(r.stderr); };
  const base=['-ss',String(start),'-t',String(seconds),'-i',original];
  const norm='aformat=sample_rates=22050:channel_layouts=mono,loudnorm=I=-23:TP=-3:LRA=9,aresample=22050';
  run([...base,'-af',kind==='bed'?norm:`${norm},afade=t=in:d=0.06,areverse,afade=t=in:d=0.15,areverse`,'-ac','1','-ar','22050',pcm]);
  if (kind==='bed') {
    // Rotate the seam into a 1.5 s PCM tail/head crossfade. Avoid codec/filter timestamp offsets.
    const wav=await readFile(pcm); let offset=12, samples;
    while(offset+8<=wav.length){const n=wav.readUInt32LE(offset+4);if(wav.toString('ascii',offset,offset+4)==='data'){samples=wav.subarray(offset+8,offset+8+n);break;}offset+=8+n+(n%2);}
    const count=samples.length/2, fade=Math.round(1.5*22050), output=Buffer.alloc((count-fade)*2);
    samples.copy(output,0,fade*2,(count-fade)*2);
    for(let i=0;i<fade;i++){const t=i/(fade-1);output.writeInt16LE(Math.round(samples.readInt16LE((count-fade+i)*2)*(1-t)+samples.readInt16LE(i*2)*t),(count-2*fade+i)*2);}
    const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+output.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(22050,24);header.writeUInt32LE(44100,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(output.length,40);
    await writeFile(pcm,Buffer.concat([header,output]));
  }
  const formats=[];
  for (const [ext,codec,mime] of [['m4a','aac','audio/mp4; codecs="mp4a.40.2"'],['ogg','libopus','audio/ogg; codecs=opus']]) {
    const file=`${id}.${ext}`;
    run(['-i',pcm,'-ac','1','-ar',ext==='ogg'?'24000':'22050','-c:a',codec,'-b:a','32k',...(ext==='m4a'?['-movflags','+faststart']:[]),`public/audio/${file}`]);
    formats.push({file,mime,bytes:(await stat(`public/audio/${file}`)).size});
  }
  // Read exact PCM duration, including short source recordings.
  const wav=await readFile(pcm); let offset=12,duration=0;
  while(offset+8<=wav.length){const n=wav.readUInt32LE(offset+4);if(wav.toString('ascii',offset,offset+4)==='data'){duration=n/(22050*2);break;}offset+=8+n+(n%2);}
  if (!(duration>0&&duration<=25))throw Error(`Invalid duration: ${id}`);
  clips.push({id,kind,duration,loop:kind==='bed',formats});
  credits.push({id,title,author,credit:author,sourceUrl,originalUrl:url,license,licenseUrl:m.LicenseUrl?.value || 'https://en.wikipedia.org/wiki/Public_domain',files:formats.map(f=>f.file),changes:`Excerpt at ${start}s; mono, 22.05 kHz, loudness normalisation, ${kind==='bed'?'1.5 s loop crossfade':'edge fades'}; AAC/Opus 32 kbps.`});
  evidence.push({title,checked:new Date().toISOString(),apiUrl:api.href,metadata:Object.fromEntries(['Artist','LicenseShortName','LicenseUrl','Copyrighted','UsageTerms','ImageDescription'].map(k=>[k,m[k]?.value]))});
  console.log(id,duration.toFixed(2),formats.map(f=>f.bytes).join(' + '));
}
await writeFile('public/audio/manifest.json',JSON.stringify({version:1,clips},null,2)+'\n');
await writeFile('public/audio/credits.json',JSON.stringify(credits,null,2)+'\n');
await writeFile('docs/qa/audio/provenance.json',JSON.stringify(evidence,null,2)+'\n');
await writeFile('public/audio/SOURCES.md','# Courtyard field recordings\n\nOnly CC0, CC BY and public-domain recordings. Licence metadata was checked with the Commons API; evidence is in `docs/qa/audio/provenance.json`. Run `node scripts/build-audio.mjs` to regenerate. AAC is preferred for Safari/iOS; Opus is the alternative. Originals and intermediate PCM stay in ignored `artifacts/audio-source/`. These are real recordings, adapted to a fictional Soviet courtyard, not recordings made there.\n\n| Shipped files | Author | Source | Licence | Changes |\n| --- | --- | --- | --- | --- |\n'+credits.map(c=>`| ${c.files.map(f=>'`'+f+'`').join(', ')} | ${c.author} | [${c.title}](${c.sourceUrl}) | [${c.license}](${c.licenseUrl}) | ${c.changes} |`).join('\n')+'\n\nmanifest.json and credits.json are local inventories. Children are distant Berlin playground walla; Russian speech is not claimed. Door is a recorded closet slam used as a distant entrance door. Window is a recorded hopper window. Birds are identified house sparrows; no swallow recording is claimed.\n');
