import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// Extract the CC0 ZIP linked in public/fx/SOURCES.md first. No source ZIP is shipped.
const source = process.argv[2] || join(tmpdir(), 'coverhit-fx-smoke', 'PNG', 'White puff');
const frames = (await readdir(source)).filter(f => f.endsWith('.png')).sort();
if (frames.length < 2) throw Error('Expected Kenney white-puff frames');
await mkdir('public/fx', { recursive: true });
const composite = [];
for (let i = 0; i < 16; i++) {
  const frame = frames[Math.round(i * (frames.length - 1) / 15)];
  // Two-pixel transparent gutters protect adjacent frames during linear filtering.
  const input = await sharp(join(source, frame)).resize(124, 124, { fit: 'contain', background: '#00000000' }).extend({top:2,bottom:2,left:2,right:2,background:'#00000000'}).png().toBuffer();
  composite.push({ input, left: (i % 4) * 128, top: Math.floor(i / 4) * 128 });
}
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#00000000' } }).composite(composite).webp({ lossless: true }).toFile('public/fx/dust-flipbook.webp');
const bytes = (await stat('public/fx/dust-flipbook.webp')).size;
if (bytes > 1.5 * 1024 * 1024) throw Error('Flipbook budget exceeded');
console.log({ frames:16, bytes });
