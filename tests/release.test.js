import { it, expect, vi, afterEach } from 'vitest';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadCarpetManifest } from '../src/carpet/assets.js';
import { loadStockManifest } from '../src/scene/yard/stock.js';
import { stockAssetFilterPlugin } from '../scripts/stock-build.mjs';
import { snapshotViolation, checkSnapshot } from '../scripts/check-public-snapshot.mjs';
import { javascriptUrls, smokePages } from '../scripts/smoke-pages.mjs';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it.each([false, true])('production stock opt-in %s controls optional manifest requests', async enabled => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_STOCK', enabled ? '1' : '0');
  const fetcher = vi.fn(async () => Response.json([]));
  await loadCarpetManifest('/carpets/', fetcher);
  expect(fetcher).toHaveBeenCalledTimes(enabled ? 2 : 1);
  fetcher.mockClear(); await loadStockManifest('/yard/stock/manifest.local.json', fetcher);
  expect(fetcher).toHaveBeenCalledTimes(enabled ? 1 : 0);
});
it('development permits local manifests and mobile exclusion still avoids carpet stock', async () => {
  vi.stubEnv('DEV', true); vi.stubEnv('VITE_STOCK', '0');
  const fetcher = vi.fn(async () => Response.json([]));
  await loadCarpetManifest('/carpets/', fetcher); expect(fetcher).toHaveBeenCalledTimes(2);
  fetcher.mockClear(); await loadCarpetManifest('/carpets/', fetcher, false); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('personal include builds define the runtime stock flag', () => {
  vi.stubEnv('COVERHIT_INCLUDE_STOCK', '1');
  expect(stockAssetFilterPlugin().config()).toEqual({ define: { 'import.meta.env.VITE_STOCK': '"1"' } });
  vi.stubEnv('COVERHIT_INCLUDE_STOCK', '0'); expect(stockAssetFilterPlugin().config()).toEqual({});
});
it.each(['assets-src/carpets/envato/source.jpg', 'public/yard/stock/model.glb', 'public/carpets/envato-B7PV8QR.webp', 'public/carpets/manifest.local.json', 'docs/qa/licensed-stock-menu.png', 'PHOTO.ZIP', 'public\\yard\\STOCK\\x'])('rejects forbidden snapshot path %s', file => {
  expect(snapshotViolation(file, 1)).toBe('forbidden path');
});
// Source code and docs that merely handle optional stock assets are publishable.
it.each(['scripts/stock-build.mjs', 'src/scene/yard/stock.js', 'tests/yardStock.test.js', 'docs/qa/colour/after.json'])('allows %s', file => {
  expect(snapshotViolation(file, 1)).toBeNull();
});
it('enforces the exact per-file size boundary and rejects symlinks', () => {
  expect(snapshotViolation('safe.webp', 8 * 1024 ** 2)).toBeNull();
  expect(snapshotViolation('safe.webp', 8 * 1024 ** 2 + 1)).toMatch(/8 MiB/);
  expect(snapshotViolation('safe.webp', 1, true)).toBe('symbolic link');
});
it('audits nested snapshot contents before publishing and reports totals', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'coverhit-release-')); vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await mkdir(path.join(root, 'public/yard/photos'), { recursive: true });
    for (const file of ['LICENSE', 'NOTICE.md', 'public/yard/photos/credits.json']) await writeFile(path.join(root, file), '[]');
    expect(await checkSnapshot(root)).toEqual({ count: 3, bytes: 6 });
    await writeFile(path.join(root, 'public/yard/photos/private.zip'), 'bad');
    await expect(checkSnapshot(root)).rejects.toThrow(/private.zip: forbidden path/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
const html = '<script type="module" src="/CoverHit/assets/main-1.js"></script><link rel="modulepreload" href="/CoverHit/assets/three-2.js"><img src="/CoverHit/photo.webp">';
it('resolves and deduplicates Pages JS entrypoints and preload chunks', () => {
  expect(javascriptUrls(html + html, 'https://example.org/CoverHit/')).toEqual(['https://example.org/CoverHit/assets/main-1.js', 'https://example.org/CoverHit/assets/three-2.js']);
});
it('smokes page and every JS reference and rejects missing assets/HTML fallbacks', async () => {
  const request = vi.fn(async url => url.endsWith('.js') ? new Response('export{}', { headers: { 'content-type': 'text/javascript' } }) : new Response(html));
  expect(await smokePages('https://example.org/CoverHit/', request)).toHaveLength(2); expect(request).toHaveBeenCalledTimes(3);
  await expect(smokePages('https://example.org/CoverHit/', async () => new Response('', { status: 404 }))).rejects.toThrow(/404/);
  await expect(smokePages('https://example.org/CoverHit/', async url => new Response(url.endsWith('.js') ? '' : html, { headers: { 'content-type': 'text/html' } }))).rejects.toThrow(/HTML fallback/);
  await expect(smokePages('https://example.org/CoverHit/', async () => new Response('<html></html>'))).rejects.toThrow(/No \/assets/);
});
it('credits fetch references only an existing shipped inventory', async () => {
  const source = await readFile('src/ui/modalFlow.js', 'utf8');
  expect(source).not.toContain('BASE_URL}yard/credits.json');
  const credits = JSON.parse(await readFile('public/yard/photos/credits.json', 'utf8'));
  expect(credits.length).toBeGreaterThan(0);
  for (const entry of credits) { expect(entry.author).toBeTruthy(); expect(entry.url).toMatch(/^https:/); expect(entry.license).toBeTruthy(); }
});
