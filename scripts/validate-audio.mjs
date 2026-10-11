import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';

export async function validateAudio(root = 'public/audio') {
  const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
  const credits=JSON.parse(await readFile(`${root}/credits.json`,'utf8'));
  const sources=await readFile(`${root}/SOURCES.md`,'utf8');
  const expected=new Set(['manifest.json','credits.json','SOURCES.md']);
  const records=[];
  if (manifest.version!==1 || manifest.clips.length<6 || manifest.clips.length>10) throw Error('Expected 6–10 clips');
  for (const clip of manifest.clips) {
    if (!(clip.duration>0 && clip.duration<=25)) throw Error(`Duration: ${clip.id}`);
    const credit=credits.find(c=>c.id===clip.id);
    if (!credit?.author || !credit.sourceUrl?.startsWith('https://') || !/^(CC0|CC BY |Public domain)/.test(credit.license) || !credit.licenseUrl || !credit.changes) throw Error(`Missing approved provenance: ${clip.id}`);
    if (!clip.formats.some(f=>/\.(m4a|mp3|wav)$/.test(f.file))) throw Error(`Missing iOS format: ${clip.id}`);
    for (const format of clip.formats) {
      if (!/^[a-z0-9-]+\.(m4a|ogg|opus|mp3|wav)$/.test(format.file) || expected.has(format.file)) throw Error(`Invalid/duplicate file: ${format.file}`);
      expected.add(format.file);
      const bytes=(await stat(`${root}/${format.file}`)).size;
      if (bytes!==format.bytes || !sources.includes('`'+format.file+'`') || !credit.files.includes(format.file)) throw Error(`Inventory mismatch: ${format.file}`);
      const decoded=spawnSync(ffmpeg,['-hide_banner','-i',`${root}/${format.file}`,'-f','null','-'],{encoding:'utf8'});
      if (decoded.status!==0 || !/Audio:.*mono/.test(decoded.stderr)) throw Error(`Invalid/non-mono audio: ${format.file}`);
      const duration=/Duration: (\d+):(\d+):([\d.]+)/.exec(decoded.stderr);
      const seconds=duration ? Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]) : 0;
      if (!(seconds>0 && seconds<=25 && Math.abs(seconds-clip.duration)<.25)) throw Error(`Encoded duration mismatch: ${format.file}`);
      records.push({file:format.file,bytes,duration:seconds});
    }
  }
  let totalBytes=0;
  for (const file of await readdir(root)) {
    if (!expected.has(file)) throw Error(`Unlisted shipped file: ${file}`);
    totalBytes+=(await stat(`${root}/${file}`)).size;
  }
  if (totalBytes>1800000) throw Error(`Audio exceeds 1.8 MB: ${totalBytes}`);
  return {clips:manifest.clips.length,files:records.length,totalBytes,budgetBytes:1800000,records};
}
if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) console.log(JSON.stringify(await validateAudio(),null,2));
