// Commons discovery is deliberately separate from the reviewed asset recipe.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const dir='artifacts/natural';await mkdir(dir,{recursive:true});
const headers={'User-Agent':'CoverHit/1.0 (Commons photographic courtyard research)'};
async function get(url){for(let n=0;n<4;n++){const r=await fetch(url,{headers});if(r.ok)return r;await new Promise(r=>setTimeout(r,2000*(n+1)));}throw Error(url);}
async function api(params){const u=new URL('https://commons.wikimedia.org/w/api.php');u.search=new URLSearchParams({action:'query',format:'json',...params});return (await get(u)).json();}
const categories=['1-464 (type of buildings)','1-335','1-447 (type of buildings)','II-49','1-468','Khrushchev houses','Panel houses in Russia','Panel houses in Ukraine','Panel houses in Belarus','Panel houses in Kazakhstan'];
const titles=new Set();
for(const category of categories){const d=await api({list:'categorymembers',cmtitle:'Category:'+category,cmtype:'file',cmlimit:'500'});for(const p of d.query?.categorymembers||[])titles.add(p.title);console.log(category,d.query?.categorymembers?.length||0);}
for(const variant of ['beige 0','red 01','red 02','red 04','white 01','white 02','white 03'])titles.add('File:Moscow car show 2025-08-03 VAZ-2101 '+variant+'.jpg');
let records=[];const all=[...titles];const strip=s=>(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim();
for(let i=0;i<all.length;i+=10){const d=await api({prop:'imageinfo',iiprop:'url|size|extmetadata',iiurlwidth:'1000',titles:all.slice(i,i+10).join('|')});for(const p of Object.values(d.query?.pages||{})){const s=p.imageinfo?.[0];if(!s)continue;const car=p.title.includes('Moscow car show');const license=strip(s.extmetadata.LicenseShortName?.value);if(!/^(CC0|Public domain|CC BY(?:-SA)? [234]\.[05])$/.test(license))continue;if(!car&&(s.width<3000||s.width/s.height<1.2||s.width/s.height>2.5))continue;records.push({id:records.length,title:p.title.slice(5),url:s.url,page:s.descriptionurl,thumbnail:s.thumburl,width:s.width,height:s.height,author:strip(s.extmetadata.Artist?.value),license,car});}await writeFile(dir+'/catalog.json',JSON.stringify(records,null,2));console.log('metadata',i,records.length);}
await writeFile(dir+'/catalog.json',JSON.stringify(records,null,2)+'\n');
for(let i=0;i<records.length;i+=3)await Promise.all(records.slice(i,i+3).map(async s=>{const file=dir+'/'+s.id+'.jpg';try{await readFile(file);}catch{await writeFile(file,Buffer.from(await(await get(s.thumbnail)).arrayBuffer()));}}));
console.log('Downloaded',records.length,'licensed previews');
