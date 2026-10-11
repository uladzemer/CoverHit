// Discovery only: outputs Commons licence metadata; never ships search results.
import { writeFile, mkdir } from 'node:fs/promises';
const results = [];
for (const query of ['children playground', 'children playing', 'sparrow', 'swallow bird', 'traffic city', 'dog bark', 'swing creak', 'tram bell', 'door slam', 'window opening']) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:`${query} filetype:audio -intitle:En- -intitle:LL-`,gsrnamespace:'6',gsrlimit:'30',prop:'imageinfo',iiprop:'url|extmetadata|size'});
  const json = await (await fetch(url)).json();
  const allowed = Object.values(json.query?.pages || {}).flatMap(p => {
    const i=p.imageinfo?.[0], m=i?.extmetadata, license=m?.LicenseShortName?.value || '';
    if (!/^(CC0|CC BY |Public domain)/.test(license)) return [];
    return [{query,title:p.title,url:i.url.split('?')[0],sourceUrl:i.descriptionurl,license,licenseUrl:m.LicenseUrl?.value || '',author:m.Artist?.value.replace(/<[^>]*>/g,'') || '',description:m.ImageDescription?.value.replace(/<[^>]*>/g,'').slice(0,500),size:i.size}];
  });
  results.push(...allowed); console.log(query, JSON.stringify(allowed));
}
await mkdir('artifacts/audio-source',{recursive:true});
await writeFile('artifacts/audio-source/discovery.json',JSON.stringify(results,null,2));
