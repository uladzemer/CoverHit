import {readdir, readFile, writeFile, mkdir, mkdtemp, stat} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import yauzl from 'yauzl';
import sharp from 'sharp';
import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {MTLLoader} from 'three/addons/loaders/MTLLoader.js';
import {TGALoader} from 'three/addons/loaders/TGALoader.js';
import {Document, NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup, weld, simplify, textureCompress, prune, join, getBounds, flatten, compactPrimitive} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';

const root=fileURLToPath(new URL('../',import.meta.url));
const sourceUrls={
 'balcony-block':'https://elements.envato.com/multi-storey-building-with-balconies-and-sloped-ro-QK4A8DM',
 'panel-block':'https://elements.envato.com/multi-story-building-with-gridded-fenestration-and-63X2Y7T',
 garage:'https://elements.envato.com/small-utility-garage-AGGVK4W',
 deciduous:'https://elements.envato.com/kitbash-city-streets-tree-a-5CGSS5X',
 birch:'https://elements.envato.com/detailed-birch-tree-with-dense-foliage-TX7NAEQ',
 bench:'https://elements.envato.com/kitbash-city-streets-bench-a-YW8LWQE',
 lamp:'https://elements.envato.com/kitbash-city-streets-lamp-i-Z57MP5Y',
 dumpster:'https://elements.envato.com/green-industrial-dumpster-BGU7LS8',
};
export const models=[
 {id:'balcony-block',role:'building',prefix:'multi-storey-building-with-balconies',title:'Multi-storey building with balconies and sloped roof',height:17,budget:60000},
 {id:'panel-block',role:'horizon',prefix:'multi-story-building-with-gridded',title:'Multi-story building with gridded fenestration and balconies',height:27,budget:60000},
 {id:'garage',role:'garage',prefix:'small-utility-garage',title:'Small Utility Garage',height:2.6,budget:20000},
 {id:'deciduous',role:'tree',prefix:'kitbash-city-streets-tree-a',title:'Kitbash: City Streets - Tree A',height:9,budget:15000},
 {id:'birch',role:'birch',prefix:'detailed-birch',title:'Detailed birch tree with dense foliage',height:10,budget:25000},
 {id:'bench',role:'bench',prefix:'kitbash-city-streets-bench-a',title:'Kitbash: City Streets - Bench A',height:.9,budget:6000},
 {id:'lamp',role:'lamp',prefix:'kitbash-city-streets-lamp-i',title:'Kitbash: City Streets - Lamp I',height:5.4,budget:6000},
 {id:'dumpster',role:'dumpster',prefix:'green-industrial-dumpster',title:'Green Industrial Dumpster',height:1.4,budget:6000},
];
// Validate every entry, including ones we do not extract. Never trust zip paths,
// symlinks, embedded scripts, external material paths or external model URLs.
export function safeArchivePath(name){
 const normalized=name.replaceAll('\\','/');
 if(!normalized || normalized.includes('\0') || normalized.includes(':') || normalized.startsWith('/') || normalized.split('/').includes('..'))throw Error(`Unsafe archive entry: ${name}`);
 return normalized;
}
export async function extractArchive(file, destination){
 const zip=await new Promise((resolve,reject)=>yauzl.open(file,{lazyEntries:true,strictFileNames:true},(e,z)=>e?reject(e):resolve(z)));
 let bytes=0,entries=0;
 await new Promise((resolve,reject)=>{
  const fail=e=>{zip.close();reject(e);};zip.on('error',fail);zip.on('end',resolve);
  zip.on('entry',async entry=>{try{
   const name=safeArchivePath(entry.fileName),mode=(entry.externalFileAttributes>>>16)&0xf000;
   if(mode===0xa000)throw Error(`Archive symlink rejected: ${name}`);
   bytes+=entry.uncompressedSize;if(++entries>10000||bytes>2_000_000_000)throw Error('Archive extraction limit exceeded');
   if(!name.endsWith('/') && !name.startsWith('__MACOSX/') && /\.(glb|gltf|bin|fbx|obj|mtl|png|jpe?g|webp|tga|tiff?|bmp)$/i.test(name)){
    const target=path.resolve(destination,...name.split('/'));
    if(!target.startsWith(path.resolve(destination)+path.sep))throw Error('Archive escaped work directory');
    await mkdir(path.dirname(target),{recursive:true});
    const stream=await new Promise((res,rej)=>zip.openReadStream(entry,(e,s)=>e?rej(e):res(s)));
    await pipeline(stream,createWriteStream(target));
   }zip.readEntry();
  }catch(e){fail(e);}});zip.readEntry();
 });
}
async function walk(folder){const out=[];for(const e of await readdir(folder,{withFileTypes:true})){const f=path.join(folder,e.name);if(e.isDirectory())out.push(...await walk(f));else out.push(f);}return out;}
export function selectInterchange(files){return [...files].filter(f=>/\.(glb|gltf|fbx|obj)$/i.test(f)).sort((a,b)=>['.glb','.gltf','.fbx','.obj'].indexOf(path.extname(a).toLowerCase())-['.glb','.gltf','.fbx','.obj'].indexOf(path.extname(b).toLowerCase())||a.localeCompare(b))[0];}
function tris(doc){return doc.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((sum,p)=>sum+(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3,0),0);}
function bufferArray(b){return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}
async function png(file){const b=await readFile(file);if(/\.tga$/i.test(file)){const t=new TGALoader().parse(bufferArray(b));return sharp(t.data,{raw:{width:t.width,height:t.height,channels:4}}).png().toBuffer();}return sharp(b).png().toBuffer();}

async function birchCards(doc,warnings,originalFoliage){
 const leaves=doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).filter(p=>/leav/i.test(p.getMaterial()?.getName()));
 for(const p of doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).filter(p=>!leaves.includes(p))){
  const [indices]=MeshoptSimplifier.simplifySloppy(p.getIndices().getArray(),p.getAttribute('POSITION').getArray(),3,null,Math.min(24000,p.getIndices().getCount()),1);
  p.getIndices().setArray(indices);
 }
 const trunk=tris(doc)-leaves.reduce((n,p)=>n+p.getIndices().getCount()/3,0);
 if(trunk>=24000)throw Error('Birch trunk alone exceeds budget');
 const totalCards=Math.min(6500,Math.floor((24500-trunk)/2));
 for(const prim of leaves){
  const original=originalFoliage.find(e=>e.prim===prim),idx=original.indices,pos=original.positions,count=Math.floor(totalCards/leaves.length);
  const positions=new Float32Array(count*12),normals=new Float32Array(count*12),uv=new Float32Array(count*8),indices=new Uint32Array(count*6);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),u=new THREE.Vector3(),v=new THREE.Vector3(),n=new THREE.Vector3();
  for(let i=0;i<count;i++){
   const t=Math.floor(i/count*(idx.length/3))*3;
   a.fromArray(pos,idx[t]*3);b.fromArray(pos,idx[t+1]*3);c.fromArray(pos,idx[t+2]*3);
   u.subVectors(b,a).normalize();n.crossVectors(u,v.subVectors(c,a)).normalize();v.crossVectors(n,u).normalize();a.add(b).add(c).multiplyScalar(1/3);
   const w=.085+(i%7)*.009,h=w*1.6;
   for(let k=0;k<4;k++){const p=a.clone().addScaledVector(u,(k===0||k===3?-1:1)*w).addScaledVector(v,k<2?-h:h);p.toArray(positions,(i*4+k)*3);n.toArray(normals,(i*4+k)*3);}
   uv.set([0,0,1,0,1,1,0,1],i*8);indices.set([i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3],i*6);
  }
  const buffer=doc.getRoot().listBuffers()[0];prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer));
  for(const[semantic,array,type]of [['POSITION',positions,'VEC3'],['NORMAL',normals,'VEC3'],['TEXCOORD_0',uv,'VEC2']])prim.setAttribute(semantic,doc.createAccessor().setType(type).setArray(array).setBuffer(buffer));
  const mat=prim.getMaterial(),texture=mat.getBaseColorTexture();
  // The supplied JPEG has a flat green background. Flood-fill only connected
  // background pixels to bake alpha without punching holes in the green leaf.
  const {data,info}=await sharp(texture.getImage()).resize(1024,1024,{fit:'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const seen=new Uint8Array(info.width*info.height),queue=new Int32Array(seen.length);let start=0,end=0;const background=[data[0],data[1],data[2]];
  function push(i){if(i<0||i>=seen.length||seen[i])return;seen[i]=1;const d=i*4;if(background.some((c,k)=>Math.abs(data[d+k]-c)>16))return;queue[end++]=i;data[d+3]=0;}
  for(let x=0;x<info.width;x++){push(x);push((info.height-1)*info.width+x);}for(let y=0;y<info.height;y++){push(y*info.width);push(y*info.width+info.width-1);}
  while(start<end){const i=queue[start++],x=i%info.width;if(x>0)push(i-1);if(x<info.width-1)push(i+1);push(i-info.width);push(i+info.width);}
  texture.setImage(await sharp(data,{raw:info}).png().toBuffer()).setMimeType('image/png');mat.setAlphaMode('MASK').setAlphaCutoff(.45).setDoubleSided(true);
 }
 warnings.push(`Birch crown rebaked from source leaf JPEG into ${totalCards} alpha cards; decimated source trunk retained`);
}

async function convertThree(file,files,spec,warnings){
 // The stock loaders only parse data. TextureLoader is intercepted, so neither
 // DOM image loads nor requests to paths/URLs embedded in FBX/MTL can occur.
 const original=THREE.TextureLoader.prototype.load;
 THREE.TextureLoader.prototype.load=function(uri){const t=new THREE.Texture();t.userData.uri=uri;return t;};
 const manager=new THREE.LoadingManager();manager.addHandler(/\.tga$/i,new THREE.TextureLoader(manager));
 let object;
 try{
  const bytes=await readFile(file);
  if(/\.fbx$/i.test(file))object=new FBXLoader(manager).parse(bufferArray(bytes),'');
  else{
   const loader=new OBJLoader(manager),mtl=files.find(f=>f.toLowerCase()===file.replace(/\.obj$/i,'.mtl').toLowerCase());
   if(mtl){const materials=new MTLLoader(manager).parse(await readFile(mtl,'utf8'),'');materials.preload();loader.setMaterials(materials);}
   object=loader.parse(bytes.toString('utf8'));
  }
 }finally{THREE.TextureLoader.prototype.load=original;}
 object.updateMatrixWorld(true);
 // OBJ sources from TurboSquid are Z-up; Blender FBX exports contain the axis
 // conversion in their node transforms, which FBXLoader has already applied.
 if(/\.obj$/i.test(file)&&['building','horizon'].includes(spec.role)){object.rotation.x=-Math.PI/2;object.updateMatrixWorld(true);}
 const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3());
 if(!(size.y>0)||!Number.isFinite(size.y))throw Error('Empty or non-finite geometry');
 const scale=spec.height/size.y,center=bounds.getCenter(new THREE.Vector3());
 const normalize=new THREE.Matrix4().makeScale(scale,scale,scale).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('stock');
 const materialCache=new Map(),textureCache=new Map();
 const findTexture=uri=>{
  if(!uri)return null;const name=path.win32.basename(uri).toLowerCase();
  // Prefer grey 2K garage variant, otherwise prefer the smallest source image.
  return files.filter(f=>path.basename(f).toLowerCase()===name).sort((a,b)=>Number(!/grey 2k/i.test(a))-Number(!/grey 2k/i.test(b))||a.length-b.length)[0];
 };
 async function image(tex,opacity){
  if(!tex?.userData.uri)return null;
  const source=findTexture(tex.userData.uri);if(!source){warnings.push(`Missing texture: ${tex.userData.uri}`);return null;}
  const alpha=opacity?findTexture(opacity.userData.uri):files.find(f=>path.basename(f).toLowerCase()===path.basename(source).replace(/basecolor/i,'opacity').toLowerCase());
  const key=source+'|'+alpha;if(textureCache.has(key))return textureCache.get(key);
  let encoded=await png(source);
  if(alpha){const meta=await sharp(encoded).metadata();const a=await sharp(await png(alpha)).resize(meta.width,meta.height).greyscale().raw().toBuffer();encoded=await sharp(encoded).removeAlpha().joinChannel(a,{raw:{width:meta.width,height:meta.height,channels:1}}).png().toBuffer();}
  const texture=doc.createTexture(path.basename(source)).setImage(encoded).setMimeType('image/png');textureCache.set(key,texture);return texture;
 }
 async function material(m){
  if(materialCache.has(m))return materialCache.get(m);
  const mat=doc.createMaterial(m.name||'material').setBaseColorFactor([m.color.r,m.color.g,m.color.b,1]).setRoughnessFactor(.85).setMetallicFactor(/steel|metal|dumpster/i.test(m.name)?.35:0).setDoubleSided(m.side===THREE.DoubleSide);
  const tex=await image(m.map,m.alphaMap);if(tex){mat.setBaseColorTexture(tex).setBaseColorFactor([1,1,1,1]);mat.getBaseColorTextureInfo().setWrapS(10497).setWrapT(10497);}
  if(m.alphaMap||/leaf|leav|foliage/i.test(m.name)){mat.setAlphaMode('MASK').setAlphaCutoff(.45).setDoubleSided(true);}
  const normal=await image(m.normalMap);if(normal)mat.setNormalTexture(normal);
  materialCache.set(m,mat);return mat;
 }
 const meshes=[];object.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const o of meshes){
  const g=o.geometry.clone().applyMatrix4(normalize.clone().multiply(o.matrixWorld));
  if(g.attributes.uv)for(let i=0;i<g.attributes.uv.count;i++)g.attributes.uv.setY(i,1-g.attributes.uv.getY(i));
  if(!g.attributes.normal)g.computeVertexNormals();
  const mesh=doc.createMesh(o.name),materials=Array.isArray(o.material)?o.material:[o.material];
  const groups=g.groups.length?g.groups:[{start:0,count:g.index?.count||g.attributes.position.count,materialIndex:0}];
  const attributes={};for(const [name,semantic]of [['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0']]){const attr=g.attributes[name];if(attr)attributes[semantic]=doc.createAccessor().setType(attr.itemSize===2?'VEC2':'VEC3').setArray(new Float32Array(attr.array)).setBuffer(buffer);}
  for(const group of groups){if(!group.count)continue;const indices=new Uint32Array(group.count);for(let i=0;i<indices.length;i++)indices[i]=g.index?g.index.getX(group.start+i):group.start+i;
   const prim=doc.createPrimitive().setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer)).setMaterial(await material(materials[group.materialIndex]||materials[0]));
   for(const [semantic,attr]of Object.entries(attributes))prim.setAttribute(semantic,attr);mesh.addPrimitive(prim);
  }scene.addChild(doc.createNode(o.name).setMesh(mesh));g.dispose();
 }
 if(!textureCache.size)warnings.push('No texture images supplied/resolved; source material colours retained');
 return {doc,scale,sourceSize:size.toArray()};
}

async function defaultSource(){
 const local=path.join(root,'assets-src/yard/envato');if(await stat(local).then(s=>s.isDirectory(),()=>false))return local;
 const marker=path.sep+'.claude'+path.sep+'worktrees'+path.sep,index=root.indexOf(marker);
 return index>=0?path.join(root.slice(0,index),'assets-src/yard/envato'):local;
}
export async function importYardStock({folder,work=path.join(root,'assets-src/yard/_work'),out=path.join(root,'public/yard/stock')}={}){
 folder??=await defaultSource();
 await mkdir(work,{recursive:true});await mkdir(out,{recursive:true});
 const names=await readdir(folder).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
 const manifest=[],results=[];const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);await MeshoptSimplifier.ready;
 for(const spec of models){
  const archive=names.find(n=>n.startsWith(spec.prefix)&&n.endsWith('.zip'));if(!archive){console.log(`${spec.id}: source absent, procedural fallback`);continue;}
  const destination=await mkdtemp(path.join(work,`${spec.id}-`));await extractArchive(path.join(folder,archive),destination);
  const files=await walk(destination),file=selectInterchange(files),warnings=[];if(!file)throw Error(`${spec.id}: no interchange file`);
  let converted;
  if(/\.gl(?:b|tf)$/i.test(file)){
   // Resolve only validated, extracted resources. NodeIO never follows disk
   // paths or URLs supplied by the archive on its own.
   const bytes=await readFile(file);let doc;
   if(/\.glb$/i.test(file)){
    const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
    for(const entry of [...json.buffers||[],...json.images||[]])if(entry.uri&&!entry.uri.startsWith('data:'))throw Error('GLB must be self-contained');
    doc=await io.readBinary(bytes);
   }else{
    const json=JSON.parse(bytes.toString('utf8')),resources={};
    for(const entry of [...json.buffers||[],...json.images||[]])if(entry.uri&&!entry.uri.startsWith('data:')){
     const relative=safeArchivePath(decodeURIComponent(entry.uri)),target=path.resolve(path.dirname(file),relative);
     if(!files.includes(target))throw Error('glTF resource outside extracted archive');resources[entry.uri]=await readFile(target);
    }
    doc=await io.readJSON({json,resources});
   }
   await doc.transform(flatten(),join());converted={doc,scale:1};
  }else {
   try{converted=await convertThree(file,files,spec,warnings);}catch(e){
    const obj=files.find(f=>/\.obj$/i.test(f));
    if(!/\.fbx$/i.test(file)||!obj||!e.message.includes('version not supported'))throw e;
    warnings.push(`${e.message}; using OBJ+MTL`);converted=await convertThree(obj,files,spec,warnings);converted.sourceFormat='OBJ';
   }
  }
  const {doc,scale}=converted,before=tris(doc);
  await doc.transform(dedup(),weld(),join());
  const originalFoliage=spec.id==='birch'?doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).filter(p=>/leav/i.test(p.getMaterial()?.getName())).map(prim=>({prim,positions:prim.getAttribute('POSITION').getArray().slice(),indices:prim.getIndices().getArray().slice()})):[];
  for(const error of [.001,.01,.05,.2,1]){const count=tris(doc);if(count<=spec.budget)break;await doc.transform(simplify({simplifier:MeshoptSimplifier,ratio:spec.budget/count*.96,error}));}
  if(tris(doc)>spec.budget&&spec.id==='birch')await birchCards(doc,warnings,originalFoliage);
  if(tris(doc)>spec.budget)throw Error(`${spec.id}: cannot meet triangle budget (${tris(doc)})`);
  for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives())compactPrimitive(p);
  const finalBounds=getBounds(doc.getRoot().listScenes()[0]),finalScale=spec.height/(finalBounds.max[1]-finalBounds.min[1]);
  if(!Number.isFinite(finalScale)||finalScale<=0)throw Error(`${spec.id}: invalid geometry bounds`);
  const finalMatrix=new THREE.Matrix4().makeScale(finalScale,finalScale,finalScale).multiply(new THREE.Matrix4().makeTranslation(-(finalBounds.min[0]+finalBounds.max[0])/2,-finalBounds.min[1],-(finalBounds.min[2]+finalBounds.max[2])/2));
  const transformed=new Set();for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives()){const position=p.getAttribute('POSITION');if(transformed.has(position))continue;transformed.add(position);const array=position.getArray(),v=new THREE.Vector3();for(let i=0;i<array.length;i+=3)v.fromArray(array,i).applyMatrix4(finalMatrix).toArray(array,i);position.setArray(array);}
  await doc.transform(prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[spec.role==='building'||spec.role==='horizon'?2048:1024,spec.role==='building'||spec.role==='horizon'?2048:1024],quality:88}));
  const output=path.join(out,`${spec.id}.glb`);await io.write(output,doc);
  const b=getBounds(doc.getRoot().listScenes()[0]),size=b.max.map((v,i)=>+(v-b.min[i]).toFixed(3));
  const entry={id:spec.id,role:spec.role,title:spec.title,file:`${spec.id}.glb`,tris:tris(doc),scale:1,licence:'Envato Elements (personal)',sourceUrl:sourceUrls[spec.id],size};
  manifest.push(entry);const result={id:spec.id,sourceFormat:converted.sourceFormat||path.extname(file).slice(1).toUpperCase(),before,after:entry.tris,sizeMetres:size,sourceToMetres:scale*finalScale,megabytes:+((await stat(output)).size/1e6).toFixed(3),warnings};results.push(result);console.log(JSON.stringify(result));
 }
 await writeFile(path.join(out,'manifest.local.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile(path.join(out,'conversion.local.json'),JSON.stringify(results,null,2)+'\n');return results;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await importYardStock({folder:process.argv.find(a=>a.startsWith('--source='))?.slice(9)});

