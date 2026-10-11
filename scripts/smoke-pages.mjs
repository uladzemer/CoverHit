import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function javascriptUrls(html, pageUrl) {
  return [...new Set([...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
    .map(match => new URL(match[1], pageUrl).href)
    .filter(url => /\/assets\/[^/]+\.js$/.test(new URL(url).pathname)))];
}
export async function smokePages(pageUrl, request = fetch) {
  const page = await request(pageUrl, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  assert.equal(page.status, 200, `Page HTTP ${page.status}`);
  const urls = javascriptUrls(await page.text(), pageUrl);
  assert.ok(urls.length, 'No /assets/*.js references in index.html');
  for (const url of urls) {
    const response = await request(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    assert.equal(response.status, 200, `${url}: HTTP ${response.status}`);
    assert.match(response.headers.get('content-type') || '', /javascript/i, `${url}: expected JavaScript, not an HTML fallback`);
    await response.arrayBuffer();
  }
  return urls;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (let attempt = 0; ; attempt++) {
    try { const urls = await smokePages(process.argv[2]); console.log(`Pages smoke passed: page + ${urls.length} JS assets`); break; }
    catch (error) { if (attempt === 5) throw error; console.warn(`Pages propagation: ${error.message}; retrying in 10 s`); await new Promise(resolve => setTimeout(resolve, 10000)); }
  }
}
