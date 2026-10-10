import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
export function shouldRemoveStock(file, includeStock = process.env.COVERHIT_INCLUDE_STOCK) {
  const normalized=file.replaceAll('\\','/');
  return includeStock !== '1' && (normalized.startsWith('envato-') || normalized === 'manifest.local.json' || normalized === 'yard/stock' || normalized.startsWith('yard/stock/'));
}
export function stockAssetFilterPlugin() {
  let outDir, yardStock;
  return {name:'exclude-licensed-stock',apply:'build',
    configResolved(config) {outDir=path.resolve(config.root,config.build.outDir,'carpets');yardStock=path.resolve(config.root,config.build.outDir,'yard/stock');},
    async closeBundle() {
      const files=await readdir(outDir).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
      for(const file of files) if(shouldRemoveStock(file)) await rm(path.join(outDir,file),{force:true});
      if(shouldRemoveStock('yard/stock')) await rm(yardStock,{recursive:true,force:true});
    }
  };
}
