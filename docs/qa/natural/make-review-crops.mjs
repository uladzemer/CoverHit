import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const regions={
 'facade-close':[0,0,1100,850],'facade-mid':[0,0,1100,900],
 'facade-far':[0,180,1440,570],'default':[1190,320,250,190],
 'aim-left':[0,0,1440,480],'aim-right':[520,340,920,130],
 'wide':[970,340,320,180],'car-side':[410,290,700,280],
 'car-three-quarter':[370,230,850,490],'car-front':[480,230,480,430],
};
for(const [view,[left,top,width,height]]of Object.entries(regions)){
 const images=await Promise.all(['baseline','photo'].map(mode=>sharp(`docs/qa/natural/${mode}-${view}.png`).extract({left,top,width,height}).resize({width:720}).toBuffer()));
 const size=await sharp(images[0]).metadata();
 await sharp({create:{width:1440,height:size.height,channels:3,background:'#222'}}).composite(images.map((input,i)=>({input,left:i*720,top:0}))).jpeg({quality:92}).toFile(`docs/qa/natural/review-${view}.jpg`);
}
await writeFile('docs/qa/natural/crop-regions.json',JSON.stringify(regions,null,2)+'\n');
