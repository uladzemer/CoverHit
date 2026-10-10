import {readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {homedir} from 'node:os';

let playwright;
try { playwright=await import('playwright'); } catch {
 const cache=`${homedir()}/AppData/Local/npm-cache/_npx`;
 for(const directory of await readdir(cache)) {
  try { playwright=await import(pathToFileURL(`${cache}/${directory}/node_modules/playwright/index.mjs`));break; } catch {}
 }
 if(!playwright)throw Error('Install Playwright to run browser QA');
}
export const chromium=playwright.chromium;
