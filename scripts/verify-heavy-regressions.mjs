import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
const results=[];
try{
 for(const name of ['fold','crown','layers','bar-clip']){
  const out=`docs/qa/heavy/${name}`;await mkdir(out,{recursive:true});
  console.log(`Checking ${name}…`);
  const exit=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[`scripts/verify-${name}.mjs`],{env:{...process.env,QA_URL:server.resolvedUrls.local[0].replace(/\/$/,''),QA_OUT:out},stdio:'inherit'});child.on('error',reject);child.on('exit',resolve);});
  results.push({name,exit});
 }
 await writeFile('docs/qa/heavy/regressions.json',JSON.stringify(results,null,2));
 console.table(results);if(results.some(r=>r.exit!==0))process.exitCode=1;
}finally{await server.close();}
