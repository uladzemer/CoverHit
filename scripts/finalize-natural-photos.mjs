import {readFile,writeFile,stat,readdir} from 'node:fs/promises';
const dir='public/yard/photos',recipe=JSON.parse(await readFile('scripts/natural-recipe.json'));
const active=new Set([...Object.values(recipe.facades).map(c=>c.source),...recipe.cars.map(c=>c.source)]);
const sources=JSON.parse(await readFile('scripts/natural-sources.json')).filter(s=>active.has(s.id));
const manifest=JSON.parse(await readFile(dir+'/manifest.json'));manifest.version=4;manifest.photographicSections=recipe.facades;manifest.billboards=recipe.cars;
for(const s of sources){const entry={...s,index:s.id,url:s.url.split('?')[0]};delete entry.thumbnail;manifest.sources=manifest.sources.filter(r=>r.index!==entry.index);manifest.sources.push(entry);}
for(const f of manifest.files){const family=f.file.split('-')[0];if((family in recipe.facades||['nine','tower'].includes(family))&&/-(albedo|windows)\.webp$/.test(f.file)){
 f.sources=[recipe.facades[family]?.source||recipe.facades.panel.source,'polyhaven'];f.transform='complete five-floor photograph; one reviewed homography, whole-floor lens/pitch correction, bounded flat field, 16px edge join; plain CC0 concrete atlas strip; no generated panes/noise/emission';
}}
for(const c of recipe.cars){const file='car-'+c.name+'-cutout.webp';manifest.files=manifest.files.filter(f=>f.file!==file);manifest.files.push({file,sources:[c.source],transform:'whole photograph; polygon-seeded GrabCut; morphological cleanup; 1px feather and nearest interior RGB bleed; no paint reconstruction'});}
manifest.runtime=['panel-albedo.webp','panel335-albedo.webp','brick-albedo.webp',...['panel','brick','nine','tower'].map(f=>f+'-impostor-albedo.webp'),...recipe.cars.map(c=>'car-'+c.name+'-cutout.webp')];
await writeFile(dir+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const credits=JSON.parse(await readFile(dir+'/credits.json'));for(const s of sources)if(!credits.some(c=>c.title===s.title))credits.push({title:s.title,author:s.author,url:s.page,license:s.license});await writeFile(dir+'/credits.json',JSON.stringify(credits,null,2)+'\n');
const marker='<!-- natural-photo-sections -->';let doc=await readFile('public/yard/SOURCES.md','utf8');doc=doc.split(marker)[0].trimEnd();
doc+='\n\n'+marker+'\n## Whole photographs (natural revision)\n\nDerivative photographs retain their source licence. Series names in the renderer are material slots, not a claim of architectural identity. Historical cell atlases/car cards remain inventoried as inactive references.\n\n| Source / derivative | Author | URL | Licence |\n| --- | --- | --- | --- |\n';
for(const s of sources)doc+=`| ${s.title} | ${s.author} | ${s.page} | ${s.license} |\n`;
for(const f of manifest.files.filter(f=>f.sources.some(i=>active.has(i)))){const owners=f.sources.map(i=>sources.find(s=>s.id===i)).filter(Boolean);doc+=`| photos/${f.file} | ${owners.map(s=>s.author).join('; ')}${f.sources.includes('polyhaven')?'; Amal Kumar / Poly Haven':''} | ${owners.map(s=>s.page).join('; ')} | ${owners.map(s=>s.license).join('; ')}${f.sources.includes('polyhaven')?'; CC0':''} |\n`;}
await writeFile('public/yard/SOURCES.md',doc);
let notice=await readFile('NOTICE.md','utf8');notice=notice.split(marker)[0].trimEnd();notice+='\n\n'+marker+'\nWhole facade/car photographs in `public/yard/photos/`: '+sources.map(s=>`${s.title} — ${s.author} (${s.license}; ${s.page})`).join('; ')+'. The facade derivatives preserve photographic panes, curtains and balcony fittings; alpha car derivatives preserve paint and trim. BY-SA derivatives are CC BY-SA 4.0; BY derivatives remain CC BY 3.0. The concrete atlas strip uses Amal Kumar / Poly Haven concrete_slab_wall_02 (CC0). Full per-file attribution: public/yard/SOURCES.md and public/yard/photos/credits.json.\n';await writeFile('NOTICE.md',notice);
let bytes=0;for(const f of await readdir(dir))bytes+=(await stat(dir+'/'+f)).size;console.log('Photo bytes',bytes);if(bytes>=15e6)throw Error('Photo storage budget exceeded');
