// Read-only HEAD comparison server: never replaces working tree files.
import {createServer} from 'vite';
import {execFileSync} from 'node:child_process';
import {readdir} from 'node:fs/promises';
const originals=new Map();
originals.set('src/scene/yard.js',execFileSync('git',['show','HEAD:src/scene/yard.js'],{encoding:'utf8'}));
for(const file of ['facade','buildings','car','performance']){
 const path=`src/scene/yard/${file}.js`;
 originals.set(path,execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8'}));
}
const assets=new Map();
for(const file of await readdir('public/yard/photos')){
 try{assets.set('/yard/photos/'+file,execFileSync('git',['show','HEAD:public/yard/photos/'+file],{stdio:['ignore','pipe','ignore']}));}catch{}
}
const server=await createServer({server:{host:'127.0.0.1',port:5188},plugins:[{
 name:'read-only-head-baseline',enforce:'pre',
 transform(code,id){for(const [path,source]of originals)if(id.replaceAll('\\','/').endsWith('/'+path))return source;},
 configureServer(server){server.middlewares.use((req,res,next)=>{
  const file=req.url?.split('?')[0];if(!assets.has(file))return next();
  res.setHeader('Content-Type',file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'application/json');res.end(assets.get(file));
 });}
}]});
await server.listen();server.printUrls();
