import {it,expect} from 'vitest';
import {shouldRemoveStock,stockAssetFilterPlugin} from '../scripts/stock-build.mjs';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
it('excludes licensed images and local credits unless the owner opts in',()=>{
 for(const file of ['envato-test.webp','envato-test.thumb.webp','manifest.local.json']) {
  expect(shouldRemoveStock(file,'')).toBe(true);expect(shouldRemoveStock(file,'0')).toBe(true);expect(shouldRemoveStock(file,'1')).toBe(false);
 }
 for(const file of ['09.webp','09.thumb.webp','manifest.json'])expect(shouldRemoveStock(file,'')).toBe(false);
});
it('excludes every yard stock resource and honors the explicit include switch',()=>{
 for(const file of ['yard/stock','yard/stock/model.glb','yard/stock/manifest.local.json','yard\\stock\\nested\\texture.webp']){
  expect(shouldRemoveStock(file,'0')).toBe(true);expect(shouldRemoveStock(file,'1')).toBe(false);
 }
 expect(shouldRemoveStock('yard/asphalt.webp','0')).toBe(false);
});
it('removes the actual nested stock tree from output, or preserves it on opt-in',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'coverhit-stock-test-')),previous=process.env.COVERHIT_INCLUDE_STOCK;
 try{for(const include of ['0','1']){
  process.env.COVERHIT_INCLUDE_STOCK=include;
  await mkdir(path.join(folder,'dist/yard/stock/nested'),{recursive:true});await mkdir(path.join(folder,'dist/carpets'),{recursive:true});
  await writeFile(path.join(folder,'dist/yard/stock/nested/model.glb'),'licensed');await writeFile(path.join(folder,'dist/carpets/09.webp'),'museum');
  await writeFile(path.join(folder,'dist/carpets/envato-test.webp'),'licensed');await writeFile(path.join(folder,'dist/carpets/manifest.local.json'),'[]');
  const plugin=stockAssetFilterPlugin();plugin.configResolved({root:folder,build:{outDir:'dist'}});await plugin.closeBundle();
  expect(await readFile(path.join(folder,'dist/carpets/09.webp'),'utf8')).toBe('museum');
  for(const file of ['yard/stock/nested/model.glb','carpets/envato-test.webp','carpets/manifest.local.json']){
   const exists=await access(path.join(folder,'dist',file)).then(()=>true,()=>false);expect(exists).toBe(include==='1');
  }
 }}finally{if(previous===undefined)delete process.env.COVERHIT_INCLUDE_STOCK;else process.env.COVERHIT_INCLUDE_STOCK=previous;await rm(folder,{recursive:true,force:true});}
});
it('ignores licensed sources, work directories, output and screenshots',async()=>{
 const patterns=(await readFile('.gitignore','utf8')).split(/\r?\n/);
 for(const p of ['assets-src/yard/envato/','assets-src/yard/_work/','public/yard/stock/','docs/qa/yard3/*.png'])expect(patterns).toContain(p);
});
