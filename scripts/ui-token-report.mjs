import { readFileSync, writeFileSync } from 'node:fs';
const css=readFileSync(new URL('../src/ui/tokens.css',import.meta.url),'utf8');
const table=[...css.matchAll(/--ch-([\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2]]);
const tokens=Object.fromEntries(table);
const rgb=s=>s[0]==='#'?[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)):s.match(/[\d.]+/g).map(Number);
const lum=s=>rgb(s).slice(0,3).map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((a,c,i)=>a+c*[.2126,.7152,.0722][i],0);
const panel=b=>{const c=rgb(tokens.panel);return '#'+c.slice(0,3).map(v=>Math.round(v*c[3]+b*(1-c[3])).toString(16).padStart(2,'0')).join('');};
const pairs=[['ink','paper'],['red','paper'],['red-dark','paper'],['muted','paper'],['green-dark','paper'],['paper','red'],['paper','red-dark'],['paper','red-light'],['ink','ochre'],['ink','green'],['paper','ink'],['ochre','ink'],['green','ink'],['paper','panel/black',panel(0)],['paper','panel/white',panel(255)]];
let report='# CoverHit UI tokens and contrast\n\n| Token | Value |\n| --- | --- |\n'+table.map(([a,b])=>`| ${a} | ${b} |`).join('\n')+'\n\n| Text / background | Ratio | AA body |\n| --- | --- | --- |\n';
for(const [a,b,resolved] of pairs){const x=lum(tokens[a]),y=lum(resolved||tokens[b]);const r=(Math.max(x,y)+.05)/(Math.min(x,y)+.05);if(r<4.5)throw Error(`${a}/${b} fails`);report+=`| ${a} / ${b} | ${r.toFixed(2)}:1 | PASS |\n`;}
console.log(report);writeFileSync(new URL('../docs/qa/ui/tokens-and-contrast.md',import.meta.url),report);
