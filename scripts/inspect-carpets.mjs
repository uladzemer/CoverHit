import sharp from 'sharp';
import {readdir, mkdir, readFile} from 'node:fs/promises';
await mkdir('assets-src/carpets/_debug',{recursive:true});
const files=(await readdir('assets-src/carpets')).filter(f=>f.endsWith('.jpg'));
const layers=[];
for(let i=0;i<files.length;i++) {
 const m=await sharp('assets-src/carpets/'+files[i]).metadata();
 console.log(files[i],m.width,m.height);
 await sharp('assets-src/carpets/'+files[i]).resize({height:800}).jpeg().toFile('assets-src/carpets/_debug/'+files[i].slice(0,2)+'.jpg');
 layers.push({input:await sharp('assets-src/carpets/'+files[i]).resize(280,300,{fit:'contain',background:'#aaa'}).jpeg().toBuffer(),left:(i%5)*280,top:Math.floor(i/5)*330});
 layers.push({input:Buffer.from(`<svg width="280" height="30"><text x="10" y="22" font-size="20">${files[i].slice(0,2)} ${m.width} x ${m.height}</text></svg>`),left:(i%5)*280,top:Math.floor(i/5)*330+300});
}
await sharp({create:{width:1400,height:990,channels:3,background:'#ccc'}}).composite(layers).jpeg().toFile('assets-src/carpets/_debug/sources.jpg');
const config=JSON.parse(await readFile('scripts/carpets.config.json','utf8'));
const crops=[];
for(const [i,c] of config.entries()) {
 crops.push({input:await sharp(`assets-src/carpets/_debug/${c.id}.crop.jpg`).resize(280,300,{fit:'contain',background:'#aaa'}).jpeg().toBuffer(),left:i%5*280,top:Math.floor(i/5)*330});
 crops.push({input:Buffer.from(`<svg width="280" height="30"><text x="10" y="22" font-size="20">${c.id}</text></svg>`),left:i%5*280,top:Math.floor(i/5)*330+300});
}
await sharp({create:{width:1400,height:990,channels:3,background:'#ccc'}}).composite(crops).jpeg().toFile('assets-src/carpets/_debug/crops.jpg');
