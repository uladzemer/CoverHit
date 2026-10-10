import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {detectCarpetQuad,quadSize,debugQuad} from './carpet-image.mjs';
import {analyzeSource} from './carpet-cut/segment.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function importNewCarpets({folder=path.join(root,'assets-src/carpets/envato'),configFile=path.join(root,'scripts/carpets.config.json'),debug=path.join(root,'assets-src/carpets/_debug')}={}) {
 await mkdir(folder,{recursive:true});await mkdir(debug,{recursive:true});
 const config=JSON.parse(await readFile(configFile,'utf8'));
 for(const name of (await readdir(folder)).filter(f=>/\.(jpe?g|png)$/i.test(f)).sort()) {
  const itemId=name.match(/(?:^|[^A-Z0-9])([A-Z0-9]{7})(?=[^A-Z0-9]|$)/i)?.[1]?.toUpperCase();
  if(!itemId){console.warn(`Skipping ${name}: filename needs a 7-character Envato item ID`);continue;}
  const id=`envato-${itemId}`;
  if(config.some(c=>c.id===id))continue;
  const file=path.join(folder,name),prior=await detectCarpetQuad(file),cut=await analyzeSource(file,prior),corners=cut.corners,size=quadSize(corners),aspect=size.width/size.height;
  await debugQuad(file,corners,path.join(debug,`${id}.crop.jpg`));
  config.push({id,source:`envato/${name}`,title:`Carpet ${itemId} (review title)`,archetype:'Envato frontal carpet photograph',type:aspect<.55?'runner':'wool',corners,credit:`Envato Elements, item ${itemId}`,license:'Envato Elements (personal)',sourceUrl:`https://elements.envato.com/${itemId}`,draft:true});
  console.log(`${id}: draft added; review green quad in _debug/${id}.crop.jpg`);
 }
 await writeFile(configFile,JSON.stringify(config,null,2)+'\n');
 return config;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await importNewCarpets();
