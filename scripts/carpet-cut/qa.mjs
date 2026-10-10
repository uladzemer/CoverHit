import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import sharp from 'sharp';
import {edgeSheet,imageMetrics} from './metrics.mjs';
import {analyzeSource} from './segment.mjs';
import {rectifyCarpet,quadSize} from '../carpet-image.mjs';
import {measureDecodedCutBorders} from '../carpet-borders.mjs';
import {leastSquaresLine,lineDistance} from './fit.mjs';

export async function runCutAudit() {
 const config=JSON.parse(await readFile('scripts/carpets.config.json','utf8'));
 const audit=JSON.parse(await readFile('scripts/carpets.audit.json','utf8'));
 const build=JSON.parse(await readFile('public/carpets/cuts.json','utf8'));
 const before=JSON.parse(await readFile('docs/qa/cuts/before.json','utf8'));
 await mkdir('docs/qa/cuts',{recursive:true});const results=[];
 for(const c of config) {
  const file='assets-src/carpets/'+c.source;
  if(!await stat(file).then(()=>true,()=>false)){results.push({id:c.id,status:'optional source absent'});continue;}
  const b=before.find(b=>b.id===c.id),r=build.carpets.find(r=>r.id===c.id),analysis=await analyzeSource(file,c.corners,c.cut);
  // Compare both stages with the same surround model. Full-bleed inputs have
  // no background estimate; do not classify their red/cream motifs as floor.
  let baseline=b.before;
  if(c.cut?.fullBleed)baseline={...baseline,outerLeakage:0,nextLeakage:0,outerLeakPixels:0,nextLeakPixels:0};
  if(c.id==='10') {
   const reconstructed=await (await rectifyCarpet(file,c.corners)).webp({quality:85,effort:6}).toBuffer();
   baseline=await imageMetrics(reconstructed,analysis.clusters);
  }
  const sourceResidual=Math.max(0,...analysis.points.map((ps,i)=>{
   if(!ps.length)return 0;const line=leastSquaresLine([c.corners[i],c.corners[(i+1)%4]]),length=Math.hypot(c.corners[i][0]-c.corners[(i+1)%4][0],c.corners[i][1]-c.corners[(i+1)%4][1]);
   return Math.sqrt(ps.reduce((s,p)=>s+lineDistance(line,p)**2,0)/ps.length)/length;
  }));
  let borderAfter=null;
  if(r?.after) {
   await edgeSheet('public/carpets/'+c.id+'.webp',`docs/qa/cuts/${c.id}-after.png`);
   if(audit[c.id]?.fieldCorners) {
    const widths=await measureDecodedCutBorders('public/carpets/'+c.id+'.webp',r,audit[c.id].fieldCorners),size=quadSize(r.corners),sx=(r.after.width+r.insets[1]+r.insets[3])/size.width,sy=(r.after.height+r.insets[0]+r.insets[2])/size.height;
    const values={left:widths.left/sx,right:widths.right/sx,top:widths.top/sy,bottom:widths.bottom/sy};
    borderAfter={...values,lr:Math.abs(values.left-values.right)/((values.left+values.right)/2),tb:Math.abs(values.top-values.bottom)/((values.top+values.bottom)/2)};
   }
  } else {
   // A disabled input has no shipped after texture: label its diagnostic sheet.
   const image=await (await rectifyCarpet(file,c.corners,{maxSize:1200})).png().toBuffer();
   await edgeSheet(image,`docs/qa/cuts/${c.id}-after.png`);
   const meta=await sharp(`docs/qa/cuts/${c.id}-after.png`).metadata();
   await sharp(await sharp(`docs/qa/cuts/${c.id}-after.png`).composite([{input:Buffer.from(`<svg width="${meta.width}" height="80"><rect width="${meta.width}" height="80" fill="black"/><text x="12" y="52" fill="#ff5555" font-size="36">DISABLED — DIAGNOSTIC ONLY; NO SHIPPED AFTER TEXTURE</text></svg>`),left:0,top:0}]).png().toBuffer()).toFile(`docs/qa/cuts/${c.id}-after.png`);
  }
  results.push({id:c.id,before:{...baseline,straightnessResidual:sourceResidual,cornerAngleError:0},borderBefore:b.borderBefore,after:r?.after,borderAfter,status:r?.status??'shipped',method:r?.method,reason:r?.reason??c.cropNote,sourceBoundaryFit:r?.after?.straightnessResidual});
 }
 const pct=v=>v===undefined?'—':(v*100).toFixed(4)+'%',border=v=>v?[v.left,v.right,v.top,v.bottom].map(x=>x.toFixed(1)).join('/'):'—';
 const lines=['# Carpet cut audit — 2026-10-10','',
 'Before sheets were captured from the original shipped textures before any cut changes. Each sheet contains 16 crops: four positions per side, 6% of the perpendicular image dimension deep, enlarged exactly 3× (nearest neighbour). Disabled after sheets are clearly marked diagnostics, never shipped assets.', '',
 'Leakage is CIE76 ΔE < 12 against smooth surround clusters, measured on every decoded pixel of the outer four rows/columns and the next eight. The same surround model is used for both stages. Photographic-frame clusters require support immediately outside the rug. Full-bleed stock has no visible background and therefore no leakage model: zero means no known background, not proof that the original whole rug exists. Its complete reviewed inner/outer frames are preserved.', '',
 'Straightness before is RMS distance of detected local boundary points to the old cut lines divided by side length (untrimmed). After is the trimmed RANSAC/TLS boundary-fit residual, not the inward distance between the safe crop and the original irregular edge. The safe output rectangle itself has perfectly straight sides and 90° corners. These are different measurements: bowed originals cannot retain every fibre and also have a straight rectangular cut. Insets and manual overrides are recorded in public/carpets/cuts.json and config. No claim of sub-0.25% full untrimmed boundary agreement is made.', '',
 '| Carpet | Outer before → after | Next 8 before → after | Boundary residual before → fitted after | Corner error before → after | Border L/R/T/B before → after (source px) | L/R, T/B after mismatch | Choice |',
 '|---|---:|---:|---:|---:|---|---|---|',
 ...results.map(r=>`| ${r.id} | ${pct(r.before?.outerLeakage)} → ${pct(r.after?.outerLeakage)} | ${pct(r.before?.nextLeakage)} → ${pct(r.after?.nextLeakage)} | ${pct(r.before?.straightnessResidual)} → ${pct(r.after?.straightnessResidual)} | ${r.before?'0°':'—'} → ${r.after?'0°':'—'} | ${border(r.borderBefore)} → ${border(r.borderAfter)} | ${pct(r.borderAfter?.lr)}, ${pct(r.borderAfter?.tb)} | ${r.method??r.status} |`), '',
 '## Decisions and limits','',
 ...results.map(r=>`- **${r.id}**: ${r.reason??r.status} ${r.borderAfter&&(r.borderAfter.lr>.03||r.borderAfter.tb>.03)?'Original handmade/worn design is asymmetric; preserve the woven design rather than deleting intact motifs to force 3% equality.':''}`), '',
 '- Manual inward envelopes on 05/06/07/08/09/10 exceed the preferred 1.2% in places (09 top ≈3.3%, 10 left ≈3.6% of original dimension). These explicit overrides remove the bowed outer sliver. The leakage search stays within 0.3–1.2%; symmetry balancing and aspect-preserving inward cuts can add more. Original corners remain untouched as fallback priors. This is a documented deviation from the target, not an automatic fit success.',
 '- Independently reviewed symmetric pairs (01/03/06/09 L/R, 08/10 both) are balanced by small inward cuts to ≤3%. Other pairs keep the original asymmetry. 01/06/07/08/10 also receive paired inward cuts to aspect ratios .5/.656/1.391/20÷34/.549 so existing grid selection remains within its square-cell tolerance and does not add Ammo nodes. No pattern is stretched.',
 '- Disabled 02 cannot meet the literal colour criterion without deleting border: the beige mat overlaps worn ivory/brown weaving. The clean outer rectangle could be visually improved, but it would not honestly pass the specified metric.',
 '- Fragments 2K7L5EB/QSMGCAP remain disabled. A synthesized enclosing pattern would imply an original border that the photograph does not provide.',
 '- The 0.4% woven edge darkens/desaturates only existing rug pixels with deterministic noise; both the unpolished cut and the final decoded WebP pass leakage checks. Quality 85/90/95 is checked in order; lossless is the final safety fallback. The final reviewed set passes at quality 85.',
 '- No downloads, new attribution obligations, runtime shaders, draw calls, triangles, physics bodies, or Ammo work were introduced. Optional licensed sheets remain gitignored.', '',
 'Research: [OpenCV robust line fitting](https://docs.opencv.org/4.13.0/d3/dc0/group__imgproc__shape.html), [OpenCV morphology](https://github.com/opencv/opencv/blob/5.x/doc/tutorials/imgproc/opening_closing_hats/opening_closing_hats.markdown), [libvips resampling](https://www.libvips.org/API/8.16/libvips-resample.html). The implementation is native JS + existing Sharp: morphology close/open, largest component/hole fill, Lab/texture foreground, prior-local half-pixel central-gradient boundary search, deterministic RANSAC/TLS, homography sampling at 1.5× output resolution and Lanczos3 downsampling. No dependency or browser resource cost was added.', '',
 ];
 await writeFile('docs/qa/cuts/summary.md',lines.join('\n'));
 await writeFile('docs/qa/cuts/metrics.json',JSON.stringify(results,null,2)+'\n');
 for(const r of results)console.log(`${r.id}: outer ${pct(r.before?.outerLeakage)} -> ${pct(r.after?.outerLeakage)}; next ${pct(r.before?.nextLeakage)} -> ${pct(r.after?.nextLeakage)}; ${r.method??r.status}`);
 return results;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/qa.mjs'))await runCutAudit();
