import { readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Only CC/museum inputs. Never traverse stock or local licensed manifests.
export async function buildLiteAssets() {
  const report = { files: [], bytes: 0 };
  async function walk(relative) {
    const folder = path.join('public', relative);
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (/stock|envato|local|reference|outline/i.test(entry.name)) continue;
      const file = path.join(relative, entry.name);
      if (entry.isDirectory()) { if (!/laundry/.test(file)) await walk(file); continue; }
      if (!/\.(webp|png|jpe?g)$/i.test(file)) continue;
      const target = path.join('public/lite', file.replace(/\.(png|jpe?g)$/i, '.webp'));
      await mkdir(path.dirname(target), {recursive:true});
      await sharp(path.join('public',file)).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).webp({quality:75}).toFile(target);
      const bytes = (await stat(target)).size;
      report.files.push({file:target.replaceAll('\\','/'),bytes}); report.bytes += bytes;
    }
  }
  await walk('yard'); await walk('carpets');
  if (report.bytes >= 10 * 1024 ** 2) throw Error(`Lite derivatives exceed 10 MB: ${report.bytes}`);
  await writeFile('public/lite/budget.json',JSON.stringify(report,null,2)+'\n');
  console.log(`Lite assets: ${report.files.length} files, ${(report.bytes/1048576).toFixed(2)} MB; no HDR or licensed stock`);
  return report;
}
if (process.argv[1]?.endsWith('build-lite-assets.mjs')) await buildLiteAssets();
