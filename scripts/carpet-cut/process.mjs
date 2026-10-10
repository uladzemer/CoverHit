import sharp from 'sharp';
import {rectifyCarpet,quadSize} from '../carpet-image.mjs';
import {analyzeSource} from './segment.mjs';
import {finishCut} from './finish.mjs';
import {imageMetrics} from './metrics.mjs';
import {balanceCut} from './symmetry.mjs';

export async function processCarpet(file,c) {
 const analysis=await analyzeSource(file,c.corners,c.cut);
 const corners=c.cut?.manualCorners??analysis.corners;
 const method=c.cut?.manualCorners?'manual inward envelope':analysis.method;
 let finished=await finishCut(await rectifyCarpet(file,corners,{maxSize:2048,oversample:1.5}),analysis.clusters,{minFraction:c.cut?.fullBleed?0:.003});
 // An automatic hypothesis must beat the safe prior and pass pre-polish QA.
 if((!finished.withinBudget||finished.unpolished.outerLeakage||finished.unpolished.nextLeakage>.005)&&!c.cut?.manualCorners) {
  finished=await finishCut(await rectifyCarpet(file,c.corners,{maxSize:2048,oversample:1.5}),analysis.clusters);
  analysis.corners=c.corners;analysis.method='manual prior fallback';
 }
 if(!finished.withinBudget||finished.unpolished.outerLeakage||finished.unpolished.nextLeakage>.005)throw Error(`${c.id}: no safe cut within inset budget: ${JSON.stringify(finished.unpolished)}`);
 finished=await balanceCut(file,c.cut?.manualCorners??analysis.corners,finished,analysis.clusters,c.cut);
 const raw={width:finished.width,height:finished.height,channels:3};
 let encoded=await sharp(finished.data,{raw}).webp({quality:85,effort:4}).toBuffer(),metrics=await imageMetrics(encoded,analysis.clusters),encoding='quality 85';
 for(const quality of [90,95]) {
  if(!metrics.outerLeakage&&metrics.nextLeakage<=.005)break;
  encoded=await sharp(finished.data,{raw}).webp({quality,effort:4}).toBuffer();metrics=await imageMetrics(encoded,analysis.clusters);encoding=`quality ${quality} (edge colour safety)`;
 }
 if(metrics.outerLeakage||metrics.nextLeakage>.005) {
  encoded=await sharp(finished.data,{raw}).webp({lossless:true,effort:4}).toBuffer();metrics=await imageMetrics(encoded,analysis.clusters);encoding='lossless (edge colour safety)';
 }
 if(metrics.outerLeakage||metrics.nextLeakage>.005)throw Error(`${c.id}: encoded edge fails leakage acceptance`);
 const size=quadSize(corners),residual=Math.max(0,...analysis.lines.map((l,i)=>l?l.residual/(i%2?size.height:size.width):0));
 return {encoded,finished,analysis,report:{id:c.id,method:c.cut?.manualCorners?method:analysis.method,corners:c.cut?.manualCorners??analysis.corners,insets:finished.insets,symmetryInsets:finished.symmetryInsets,borders:finished.borders,clusters:analysis.clusters,unpolished:finished.unpolished,after:{...metrics,straightnessResidual:residual,cornerAngleError:0},encoding,reason:c.cut?.reason??c.cropNote}};
}
