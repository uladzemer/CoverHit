import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const out='docs/qa/flipcontact';await mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
const results=[];
try {
 for(const name of ['bar-clip','fold','layers','crown']){
  const start=Date.now();
  const code=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[`scripts/verify-${name}.mjs`],{stdio:'inherit',env:{...process.env,QA_URL:server.resolvedUrls.local[0].replace(/\/$/,''),QA_OUT:`${out}/${name}`}});
   child.on('error',reject);child.on('exit',resolve);
  });
  results.push({name,code,elapsedMs:Date.now()-start});
 }
 await writeFile(`${out}/regressions.json`,JSON.stringify({passed:results.every(r=>r.code===0),results},null,2));
 if(results.some(r=>r.code!==0))process.exitCode=1;
} finally {await server.close();}
