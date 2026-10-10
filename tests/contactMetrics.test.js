import {it,expect} from 'vitest';
import {contactThresholds,contactBudget,sampleContactPairs} from '../src/carpet/contactMetrics.js';
it('requires zero deep events independently of a good percentile',()=>{
 const good={events:0,p99:.0009,maxCorrection:.005,minClearance:.0001,maxSpeed:6,maxExtent:2,recoveries:0};
 expect(contactThresholds(good)).toBe(true);
 for(const bad of [{events:1},{p99:.0011},{maxCorrection:.006},{minClearance:-.0001},{recoveries:1},{maxSpeed:7},{maxExtent:5},{maxSpeed:null},{p99:NaN},{minClearance:Infinity},{maxCorrection:-1}])expect(contactThresholds({...good,...bad})).toBe(false);
});
it('enforces the extra frame CPU budget without treating missing timings as success',()=>{
 expect(contactBudget(3)).toBe(true);expect(contactBudget(3.001)).toBe(false);expect(contactBudget(NaN)).toBe(false);
});

it('independently identifies overlapping parallel-sheet node footprints',()=>{
 const cols=4,rows=8,p=new Float64Array(45*3),n=new Float64Array(45*3);
 for(let i=0;i<45;i++){const y=Math.floor(i/5);p[i*3]=i%5*.05;p[i*3+1]=Math.abs(y-4)*.05;p[i*3+2]=Math.sign(y-4)*.008;}
 let deep=0;sampleContactPairs(p,cols,rows,'v',.05,n,(i,j,gap)=>{if(gap<.007)deep++;});expect(deep).toBe(0);
 for(let i=0;i<45;i++)p[i*3+2]*=.375;
 sampleContactPairs(p,cols,rows,'v',.05,n,(i,j,gap)=>{if(gap<.007)deep++;});expect(deep).toBeGreaterThan(0);
});
