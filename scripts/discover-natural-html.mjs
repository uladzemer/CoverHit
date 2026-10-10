// Public HTML fallback when Commons API traffic is throttled.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const dir='artifacts/natural';await mkdir(dir,{recursive:true});
async function get(url){const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);return r;}
const decode=s=>s.replace(/&amp;/g,'&').replace(/&#039;/g,"'").replace(/&quot;/g,'"');
const categories=['1-464_(type_of_buildings)','1-335_(type_of_buildings)','1-447_(type_of_buildings)','II-49','1-468_(type_of_buildings)','Khrushchev_houses'];
const records=[];
for(const cat of categories){let html;try{html=await(await get('https://commons.wikimedia.org/wiki/Category:'+cat)).text();}catch{continue;}
 for(const block of html.split('class="gallerybox"').slice(1)){
  const image=block.match(/<img[^>]*src="([^"]+)"/),title=block.match(/class="gallerytext"[\s\S]*?href="\/wiki\/File:([^"]+)"/),dims=block.match(/([\d,]+) × ([\d,]+)/);if(!image||!title||!dims)continue;
  const width=Number(dims[1].replaceAll(',','')),height=Number(dims[2].replaceAll(',',''));if(width<3000||width/height<1.2||width/height>2.5)continue;
  const name=decodeURIComponent(decode(title[1])).replaceAll('_',' ');if(records.some(s=>s.title===name))continue;
  const thumb=decode(image[1]).replace(/\/\d+px-/,'/960px-');records.push({id:records.length,title:name,thumbnail:thumb,page:'https://commons.wikimedia.org/wiki/File:'+title[1],width,height,car:false});
 }
}
for(const variant of ['beige 0','red 01','red 02','red 04','white 01','white 02','white 03']){
 const title='Moscow car show 2025-08-03 VAZ-2101 '+variant+'.jpg',page='https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(title.replaceAll(' ','_'));
 const html=await(await get(page)).text();const url=decode(html.match(/class="fullImageLink"[^>]*>[\s\S]*?href="([^"]+)"/)[1]);
 records.push({id:records.length,title,page,url,thumbnail:url,width:5184,height:3456,car:true,author:'Retired electrician',license:'CC0'});
}
await writeFile(dir+'/catalog.json',JSON.stringify(records,null,2));
for(const s of records){const file=dir+'/'+s.id+'.jpg';try{await readFile(file);}catch{try{const bytes=Buffer.from(await(await get(s.thumbnail)).arrayBuffer());await writeFile(file,bytes);}catch(e){console.log(e.message);s.failed=true;}}console.log(s.id,s.title);}
await writeFile(dir+'/catalog.json',JSON.stringify(records.filter(s=>!s.failed),null,2));
