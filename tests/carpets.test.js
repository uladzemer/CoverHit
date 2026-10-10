import {it,expect,vi} from 'vitest';
import {readFile,readdir,stat,mkdtemp,copyFile,rm,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import {buildCarpets} from '../scripts/build-carpets.mjs';
import {clothRestPosition,clothUv} from '../src/carpet/cloth.js';
import path from 'node:path';
import sharp from 'sharp';
import {carpetGeometry,carpetEntryType,createCarpetAssets,rotationEntries,loadCarpetManifest} from '../src/carpet/assets.js';
import {detectCarpetQuad,rectifyCarpet} from '../scripts/carpet-image.mjs';
import {importNewCarpets} from '../scripts/new-carpets.mjs';
const config=JSON.parse(await readFile('scripts/carpets.config.json','utf8'));
const cropAudit=JSON.parse(await readFile('scripts/carpets.audit.json','utf8'));
const manifest=JSON.parse(await readFile('public/carpets/manifest.json','utf8'));
const museumManifest=manifest.filter(c=>!c.id.startsWith('envato-'));
it('configures four in-bounds actual rug corners for every museum rug',async()=>{
 const files=(await readdir('assets-src/carpets')).filter(f=>f.endsWith('.jpg')&&!f.includes('tapestry')).sort();
 expect(config.filter(c=>!c.id.startsWith('envato-')).map(c=>c.source).sort()).toEqual(files);
 for(const c of config.filter(c=>!c.id.startsWith('envato-'))) {
  const m=await sharp('assets-src/carpets/'+c.source).metadata();expect(c.corners).toHaveLength(4);
  for(const [x,y] of c.corners){expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0);expect(x).toBeLessThan(m.width);expect(y).toBeLessThan(m.height);}
 }
});
it('factory geometry matches every processed image within 0.5% and has near-square uniform cells',async()=>{
 let bytes=0;
 for(const c of manifest) {
  const available=await stat('public/carpets/'+c.file).then(()=>true,error=>{if(error.code==='ENOENT'&&c.id.startsWith('envato-'))return false;throw error;});
  // Licensed pixels are intentionally absent from a clean checkout. Recorded
  // dimensions still verify the factory; available local files verify metadata too.
  const full=available ? await sharp('public/carpets/'+c.file).metadata() : {width:c.width,height:c.height};
  const thumb=available ? await sharp('public/carpets/'+c.thumb).metadata() : {width:256,height:256};
  const geometry=carpetGeometry(carpetEntryType(c),c.aspect);
  expect((geometry.cols+1)*(geometry.rows+1)).toBeLessThanOrEqual(1800);
  expect(Math.abs(geometry.width/geometry.height/(full.width/full.height)-1)).toBeLessThan(.005);
  expect(c.aspect).toBe(full.width/full.height);
  expect(Math.abs((geometry.width/geometry.cols)/(geometry.height/geometry.rows)-1)).toBeLessThan(.005);
  expect(Math.max(full.width,full.height)).toBeLessThanOrEqual(2048);expect(Math.max(thumb.width,thumb.height)).toBe(256);
  expect(c.credit).toBeTruthy();expect(c.sourceUrl).toMatch(/^https:\/\//);
  expect(['CC0','Envato Elements (personal)']).toContain(c.license);
  if(!c.id.startsWith('envato-'))for(const file of [c.file,c.thumb])bytes+=(await stat('public/carpets/'+file)).size;
 }
 expect(bytes).toBeLessThan(8*1024*1024);
});
it('retries unavailable scans and selects another real scan, never a procedural pattern',async()=>{
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 const loader=vi.fn(async entry=>{if(entry.id==='09')throw Error('404');return {isTexture:true,dispose(){}};});
 const assets=createCarpetAssets(museumManifest,loader),selected=await assets.next();
 expect(loader.mock.calls.filter(([c])=>c.id==='09')).toHaveLength(2);
 expect(selected.entry.id).toBe('03');expect(selected.map.isTexture).toBe(true);
 const failed=createCarpetAssets(museumManifest,async()=>{throw Error('404');});
 await expect(failed.next()).rejects.toThrow('No rug scan');
 for(const file of ['src/main.js','src/carpet/carpetMesh.js','src/carpet/types.js','src/carpet/assets.js'])expect(await readFile(file,'utf8')).not.toMatch(/pattern\.js|generatePattern/);
 assets.dispose();warn.mockRestore();
});
it('prefers stock photos after bright first rug and accepts an explicitly easy stock first rug',()=>{
 const stock={...manifest[1],id:'envato-B7PV8QR'};
 expect(rotationEntries([...museumManifest,stock]).slice(0,2).map(c=>c.id)).toEqual(['09',stock.id]);
 expect(rotationEntries([...museumManifest,{...stock,easy:true}])[0].id).toBe(stock.id);
 expect(rotationEntries(manifest).some(c=>c.type==='tapestry')).toBe(false);
});
it('auto-detects background museum photos copied to a temporary drop-in folder within 3% of reviewed corners',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'coverhit-carpets-'));
 try {
  const folder=path.join(temp,'envato');await mkdir(folder);
  const configFile=path.join(temp,'config.json');await writeFile(configFile,'[]');
  for(const [index,id] of ['03','04'].entries()) {
   const entry=config.find(c=>c.id===id),file=path.join(folder,['B7PV8QR.jpg','C8PW9RS.jpg'][index]);
   await copyFile('assets-src/carpets/'+entry.source,file);
   const detected=await detectCarpetQuad(file),meta=await sharp(file).metadata();
   // Foreground detection includes original kilim ends; the reviewed gameplay
   // crop subsequently excludes those bands. Keep the independent detector oracle.
   const foreground=cropAudit[id].beforeCorners;
   for(let i=0;i<4;i++){expect(Math.abs(detected[i][0]-foreground[i][0])/meta.width).toBeLessThan(.03);expect(Math.abs(detected[i][1]-foreground[i][1])/meta.height).toBeLessThan(.03);}
  }
  const imported=await importNewCarpets({folder,configFile,debug:path.join(temp,'_debug')});
  expect(imported).toHaveLength(2);expect(imported[0].license).toBe('Envato Elements (personal)');expect(imported[0].credit).toBe('Envato Elements, item B7PV8QR');
  expect(await importNewCarpets({folder,configFile,debug:path.join(temp,'_debug')})).toHaveLength(2);
 } finally {await rm(temp,{recursive:true,force:true});}
},15000);
it('rectifies a keystoned pixel grid to straight rectangular edges',async()=>{
 const input=Buffer.from('<svg width="120" height="160"><rect width="120" height="160" fill="white"/><polygon points="20,10 100,20 110,150 10,140" fill="red"/></svg>');
 const image=await rectifyCarpet(input,[[23,14],[97,23],[107,147],[13,137]]);
 const {data,info}=await image.raw().toBuffer({resolveWithObject:true});
 for(const [x,y] of [[0,0],[info.width-1,0],[0,info.height-1],[info.width-1,info.height-1]]){const i=(y*info.width+x)*3;expect(data[i]).toBeGreaterThan(240);expect(data[i+1]).toBeLessThan(20);}
});

it('fold preserves every row and column link length including the top strip',()=>{
 for(const c of manifest) {
  const p=carpetGeometry(carpetEntryType(c),c.aspect);
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  for(let y=0;y<p.rows;y++) {
   expect(distance(clothRestPosition(0,y,p),clothRestPosition(0,y+1,p))).toBeCloseTo(p.height*(clothUv(0,y,p)[1]-clothUv(0,y+1,p)[1]),12);
   expect(distance(clothRestPosition(0,y,p),clothRestPosition(1,y,p))).toBeCloseTo(p.width*(clothUv(1,y,p)[0]-clothUv(0,y,p)[0]),12);
  }
 }
});
it('builds a museum-only manifest when optional Envato originals are absent and removes stale stock outputs',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'coverhit-optional-'));
 try {
  await Promise.all(['scripts','assets-src/carpets','public/carpets'].map(f=>mkdir(path.join(root,f),{recursive:true})));
  const museum=config[0],stock={...museum,id:'envato-B7PV8QR',source:'envato/B7PV8QR.jpg',license:'Envato Elements (personal)'};
  await copyFile('assets-src/carpets/'+museum.source,path.join(root,'assets-src/carpets',museum.source));
  await writeFile(path.join(root,'scripts/carpets.config.json'),JSON.stringify([museum,stock]));
  await writeFile(path.join(root,'public/carpets/envato-B7PV8QR.webp'),'stale');
  const built=await buildCarpets({root});expect(built.map(c=>c.id)).toEqual([museum.id]);
  expect(await readdir(path.join(root,'public/carpets'))).not.toContain('envato-B7PV8QR.webp');
  expect(JSON.parse(await readFile(path.join(root,'public/carpets/manifest.json'),'utf8')).map(c=>c.id)).toEqual([museum.id]);
  await mkdir(path.join(root,'assets-src/carpets/envato'));
  await copyFile('assets-src/carpets/'+museum.source,path.join(root,'assets-src/carpets/envato/B7PV8QR.jpg'));
  await buildCarpets({root});
  expect(JSON.parse(await readFile(path.join(root,'public/carpets/manifest.json'),'utf8')).map(c=>c.id)).toEqual([museum.id]);
  expect(JSON.parse(await readFile(path.join(root,'public/carpets/manifest.local.json'),'utf8')).map(c=>c.id)).toEqual([stock.id]);

 } finally {await rm(root,{recursive:true,force:true});}
},30000);

it('loads only shipped museum credits and rotates without repeats when local manifest is absent',async()=>{
 const fetcher=vi.fn(async url=>url.endsWith('manifest.local.json')?{ok:false,status:404}:{ok:true,json:async()=>manifest});
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 const loaded=await loadCarpetManifest('/carpets/',fetcher);
 expect(loaded.every(c=>!c.id.startsWith('envato-'))).toBe(true);
 const loader=vi.fn(async()=>({dispose(){}})),assets=createCarpetAssets(loaded,loader),ids=[];
 for(let i=0;i<museumManifest.length;i++)ids.push((await assets.next()).entry.id);
 expect(ids).toEqual(['09','03','01','06','04','07','05','08','10']);
 expect(loader).toHaveBeenCalledTimes(museumManifest.length);expect(warn).not.toHaveBeenCalled();warn.mockRestore();
});
it('merges a present local manifest into rotation and credits',async()=>{
 const local={...manifest[0],id:'envato-test',easy:true};
 const loaded=await loadCarpetManifest('/',async url=>({ok:true,headers:new Headers({'content-type':'application/json'}),json:async()=>url.endsWith('manifest.local.json')?[local]:manifest}));
 expect(loaded).toContainEqual(local);expect(rotationEntries(loaded)[0]).toEqual(local);
});
it('failure in the middle walks forward and continues after the selected fallback',async()=>{
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 const loader=vi.fn(async entry=>{if(entry.id==='01')throw Error('404');return {dispose(){}};});
 const assets=createCarpetAssets(manifest,loader);
 expect((await assets.next()).entry.id).toBe('09');expect((await assets.next()).entry.id).toBe('03');
 expect((await assets.next()).entry.id).toBe('06');expect((await assets.next()).entry.id).toBe('04');
 expect(loader.mock.calls.map(([c])=>c.id)).toEqual(['09','03','01','01','06','04']);warn.mockRestore();
});

 it.each([
  ['SPA HTML',()=>new Response('<html></html>',{headers:{'content-type':'text/html'}})],
  ['invalid JSON',()=>new Response('{bad',{headers:{'content-type':'application/json'}})],
  ['404',()=>new Response('',{status:404})],
  ['network error',()=>{throw new TypeError('Failed to fetch');}],
  ...[{},[null],[{id:'bad'}],[{...manifest[0],aspect:0}],[{...manifest[0],type:'unknown'}]].map(value=>['invalid shape',()=>Response.json(value)])
 ])('uses only base manifest on optional local %s',async(_,local)=>{
  const loaded=await loadCarpetManifest('/',async url=>url.endsWith('manifest.local.json')?local():Response.json(manifest));
  expect(loaded).toEqual(manifest);
 });
