import { activeProfile, mobileDevice, loadProfileTexture } from '../boot/mobileAssets.js';
﻿import * as THREE from 'three';
import {carpetType} from './types.js';

export function fitCarpetSize(type, aspect) {
  if (!Number.isFinite(aspect) || aspect <= 0) throw new RangeError('Invalid carpet aspect');
  const size=type.size ?? type;
  const length=Math.max(size.width ?? 0,size.height ?? 0);
  if (!Number.isFinite(length) || length <= 0) throw new RangeError('Invalid physical length');
  // Type dimensions describe the long side; the scan supplies the exact short side.
  return aspect>1 ? {width:length,height:length/aspect} : {width:length*aspect,height:length};
}

// Per-scan large wool sizes retain the type's existing material and gameplay properties.
export function carpetEntryType(entry, typeId=entry.type) {
  const type=carpetType(typeId);
  return entry.size && typeId===entry.type ? {...type,size:entry.size} : type;
}

// Crosswise fold: short side along the bar, fold perpendicular to the long axis.
export function foldLayout({width,height}) {
  return width>height ? {foldAxis:'u',span:height,drop:width/2} : {foldAxis:'v',span:width,drop:height/2};
}

// Equal intervals in each axis; integer grid counts approximate square cells.
export function carpetGeometry(type, aspect) {
  const size=fitCarpetSize(type,aspect);
  const layout=foldLayout(size);
  let rows=42,cols=28,error=Infinity,bestCount=Infinity;
  for(let candidate=12;candidate<=100;candidate++) {
    if(layout.foldAxis==='v' && candidate%2)continue;
    const nx=Math.max(2,layout.foldAxis==='u' ? Math.round(candidate*aspect/2)*2 : Math.round(candidate*aspect));
    const count=(nx+1)*(candidate+1);
    if(count>1800)continue;
    const mismatch=Math.abs(aspect*candidate/nx-1);
    // Prefer a moderate grid with square cells within 0.5%; unusual scan
    // aspects retain the exact-aspect fallback rather than stretching their UVs.
    const preferred=Math.max(nx,candidate)>=34 && Math.max(nx,candidate)<=48 && mismatch<.005;
    if(preferred && count<bestCount){bestCount=count;rows=candidate;cols=nx;}
    else if(bestCount===Infinity && mismatch<error){error=mismatch;rows=candidate;cols=nx;}
  }
  return {...size,cols,rows,...foldLayout(size)};
}
export function rotationEntries(manifest) {
  const order=['09','03','01','06','02','04','07','05','08','10'];
  const stock=manifest.filter(c=>c.id.startsWith('envato-')).sort((a,b)=>Number(b.easy===true)-Number(a.easy===true)||a.id.localeCompare(b.id));
  const museum=order.map(id=>manifest.find(c=>c.id===id)).filter(Boolean);
  // Keep the proven bright/easy first rug unless a stock draft is marked easy.
  return stock[0]?.easy ? [...stock,...museum] : [museum[0],...stock,...museum.slice(1)].filter(Boolean);
}
export function createCarpetAssets(manifest, loadTexture) {
  const entries=rotationEntries(manifest), cache=new Map();
  if(!entries.length) throw new Error('No rug scans available');
  const load=async entry=> {
    if(cache.has(entry.id)) return cache.get(entry.id);
    for(let attempt=0;attempt<2;attempt++) {
      try {const map=await loadTexture(entry);cache.set(entry.id,map);return map;}
      catch(error) {if(attempt===1) console.warn(`Carpet ${entry.id}: scan unavailable`,error);}
    }
    return null;
  };
  let cursor=0;
  return {manifest,entries,preload(){return load(entries[0]);},reset(){cursor=0;},async next(typeId,assetId) {
    const requested=assetId ? entries.findIndex(c=>c.id===assetId) : typeId ? entries.findIndex(c=>c.type===typeId) : -1;
    const start=requested>=0 ? requested : cursor%entries.length;
    for(let offset=0;offset<entries.length;offset++) {
      const index=(start+offset)%entries.length,entry=entries[index];
      const map=await load(entry);
      if(!map) continue;
      cursor=(index+1)%entries.length;
      const physicalType=carpetEntryType(entry,typeId ?? entry.type);
      const type=entry.easy ? {...physicalType,dirtAmount:.95} : physicalType;
      return {entry,map,type:{...type,size:fitCarpetSize(type,entry.aspect)}};
    }
    throw new Error('No rug scan could be loaded. Retry when images are available.');
  },dispose(){for(const map of cache.values()) map.dispose();cache.clear();}};
}
export async function loadCarpetManifest(base, fetchManifest=fetch, includeStock=true) {
  const response=await fetchManifest(`${base}manifest.json`);
  if(!response.ok) throw new Error('Unable to load carpet manifest');
  const manifest=await response.json();
  if (!includeStock) return manifest.filter(entry=>!entry.id.startsWith('envato-'));
  try {
    const local=await fetchManifest(`${base}manifest.local.json`);
    if(!local.ok || !local.headers.get('content-type')?.toLowerCase().includes('json')) return manifest;
    const entries=await local.json();
    if(!Array.isArray(entries) || !entries.every(entry=>entry &&
      ['id','file','type'].every(key=>typeof entry[key]==='string' && entry[key].length>0) &&
      carpetType(entry.type) && Number.isFinite(entry.aspect) && entry.aspect>0)) return manifest;
    return [...new Map([...manifest,...entries].map(entry=>[entry.id,entry])).values()];
  } catch {
    // Local scans are optional, including on SPA hosts that return index.html.
    return manifest;
  }
}
export async function loadCarpetAssets(renderer) {
  const base=`${import.meta.env.BASE_URL}carpets/`;
  const manifest=await loadCarpetManifest(base, fetch, activeProfile === 'full' && !mobileDevice);
  const loader=new THREE.TextureLoader();
  return createCarpetAssets(manifest,async entry=>{
    const map=await loadProfileTexture(loader,base+entry.file);
    map.colorSpace=THREE.SRGBColorSpace;
    map.anisotropy=activeProfile==='full'?renderer.capabilities.getMaxAnisotropy():2;
    map.generateMipmaps=true;
    map.minFilter=THREE.LinearMipmapLinearFilter;
    return map;
  });
}
