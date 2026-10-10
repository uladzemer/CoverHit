import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Cloth} from '../src/carpet/cloth.js';
import {carpetGeometry,carpetEntryType} from '../src/carpet/assets.js';
import {carpetType} from '../src/carpet/types.js';
import {Vector3} from 'three';

export async function physicsSourceHash(){
  const hash=createHash('sha256');
  for(const file of ['cloth','handThrow','barCollision','polarContact','layerCollision','nodeAccess'])hash.update(await readFile(new URL(`../src/carpet/${file}.js`,import.meta.url)));
  return hash.digest('hex');
}

export async function loadPhysicsAmmo() {
  const filename=fileURLToPath(new URL('../public/vendor/ammo/ammo.wasm.js',import.meta.url));
  const module={exports:{}};
  const context=vm.createContext({module,exports:module.exports,require:createRequire(import.meta.url),__dirname:fileURLToPath(new URL('../public/vendor/ammo/',import.meta.url)),process,console,Buffer,setTimeout,clearTimeout,performance});
  vm.runInContext(await readFile(filename,'utf8'),context,{filename});
  return module.exports({wasmBinary:await readFile(new URL('../public/vendor/ammo/ammo.wasm.wasm',import.meta.url))});
}

export {measureThrow} from './flip-amplitude-probe.js';

export async function amplitudeCases(ammo,ids=['05','03','06','01','tapestry']) {
  const manifest=JSON.parse(await readFile(new URL('../public/carpets/manifest.json',import.meta.url)));
  return ids.map(id=>{
    const entry=manifest.find(e=>e.id===id),type=entry?carpetEntryType(entry):carpetType(id);
    const aspect=entry?.aspect??type.size.width/type.size.height;
    return {id,type:type.id,create:()=>new Cloth({...type,...carpetGeometry(type,aspect),ammo,barPosition:new Vector3(0,0,.06)})};
  });
}
