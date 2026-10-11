import { readdir, lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Licensed local-only ASSETS are forbidden. Source files that merely handle optional stock assets
// (scripts/stock-build.mjs, src/scene/yard/stock.js, tests) are code and must remain publishable.
const FORBIDDEN_ASSET = /(^|\/)(assets-src\/[^/]+\/envato|public\/yard\/stock)(\/|$)|(^|\/)(envato-[^/]*|licensed-stock-[^/]*|manifest\.local\.json)$|\.zip$/i;
const DATA_EXT = /\.(png|jpe?g|webp|gif|glb|gltf|fbx|obj|hdr|exr|mp3|m4a|ogg|wav|zip)$/i;
export function snapshotViolation(file, bytes, symbolicLink = false) {
  const normalized = file.replaceAll('\\', '/');
  if (FORBIDDEN_ASSET.test(normalized) || (/envato/i.test(normalized) && DATA_EXT.test(normalized))) return 'forbidden path';
  if (symbolicLink) return 'symbolic link';
  if (bytes > 8 * 1024 ** 2) return 'file exceeds 8 MiB';
  return null;
}

export async function checkSnapshot(root) {
  const violations = []; let count = 0, bytes = 0;
  async function walk(relative = '') {
    for (const name of await readdir(path.join(root, relative))) {
      if (!relative && name === '.git') continue;
      const file = path.join(relative, name), info = await lstat(path.join(root, file));
      const violation = snapshotViolation(file, info.isDirectory() ? 0 : info.size, info.isSymbolicLink());
      if (violation) violations.push(`${file}: ${violation}`);
      if (info.isDirectory()) await walk(file);
      else { count++; bytes += info.size; }
    }
  }
  await walk();
  console.log(`Snapshot: ${count} files, ${(bytes / 1024 ** 2).toFixed(2)} MiB`);
  console.log('Licence summary: own code MIT; assets CC0 / PD / CC BY 3.0 / CC BY-SA 3.0 and 4.0; Ammo zlib; dependencies per NOTICE.md.');
  for (const file of ['LICENSE', 'NOTICE.md', 'public/yard/photos/credits.json']) await readFile(path.join(root, file));
  if (violations.length) throw Error(`Refusing public snapshot:\n${violations.join('\n')}`);
  return { count, bytes };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await checkSnapshot(path.resolve(process.argv[2]));
