import {readFile} from 'node:fs/promises';
import {debugQuad} from './carpet-image.mjs';
const config=JSON.parse(await readFile('scripts/carpets.config.json','utf8'));
const audit=JSON.parse(await readFile('scripts/carpets.audit.json','utf8'));
for(const c of config)if(audit[c.id].fieldCorners)await debugQuad('assets-src/carpets/'+c.source,audit[c.id].fieldCorners,`assets-src/carpets/_debug/${c.id}.field.jpg`);
