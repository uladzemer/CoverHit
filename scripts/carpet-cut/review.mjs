// Apply reviewed inward envelopes without altering the historic fallback priors.
import {readFile,writeFile} from 'node:fs/promises';
import {carpetHomography,quadSize} from '../carpet-image.mjs';
const config=JSON.parse(await readFile('scripts/carpets.config.json','utf8'));
const audit=JSON.parse(await readFile('scripts/carpets.audit.json','utf8'));
const reviewed={
 '05':[12,22,8,35], '06':[35,12,15,21], '07':[6,8,6,26],
 '08':[24,6,25,6], '09':[61,7,8,14], '10':[8,21,8,38],
};
for(const c of config) {
 if(reviewed[c.id]) {
  const [t,r,b,l]=reviewed[c.id],s=quadSize(c.corners),p=carpetHomography(c.corners);
  c.cut={manualCorners:[[l,t],[s.width-1-r,t],[s.width-1-r,s.height-1-b],[l,s.height-1-b]].map(([x,y])=>p(x,y)),reason:'Reviewed straight inward envelope of bowed/worn woven boundary; original corners retained as fallback prior.'};
 }
 if(['03','04'].includes(c.id))c.cut={keepEnds:true,reason:'Keep reviewed patterned woven ends; reject plain kilim bands and fringe.'};
 if(['envato-6325SWE','envato-EPRJ58X','envato-B7PV8QR','envato-RBFEDY2'].includes(c.id))c.cut={fullBleed:true,manual:true,reason:'Photograph contains woven cloth up to its frame; no visible floor/wall/studio background to model. Retain reviewed enclosing frame.'};
 if(c.id==='envato-T834FYR')c.cut={manual:true,reason:'Reviewed inward envelope preserves the kilim border and already removes the studio white; automatic fit moves outward into bowed edges.'};
 if(c.id==='02') {c.enabled=false;c.cut={manual:true,reason:'Disabled: uneven worn boundary against beige display mat cannot satisfy literal colour-only DeltaE<12 leakage without deleting woven border; wooden photo frame also confounds automatic segmentation.'};}
 const pairs={'01':['lr'],'03':['lr'],'06':['lr'],'07':[],'08':['lr','tb'],'09':['lr'],'10':['lr','tb']}[c.id];
 const outputAspect={'01':.5,'06':.656,'07':1.391,'08':20/34,'10':.549}[c.id];
 if(pairs)c.cut={...c.cut,symmetry:{pairs,fieldCorners:audit[c.id].fieldCorners},...(outputAspect?{outputAspect}:{})};
 if(c.id==='08')c.cut.symmetry.pixelBias=[3,0,0,0];
}
await writeFile('scripts/carpets.config.json',JSON.stringify(config,null,2)+'\n');
