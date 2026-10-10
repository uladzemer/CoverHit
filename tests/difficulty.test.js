import {it,expect} from 'vitest';
import {difficultyFor} from '../src/game/difficulty.js';
import {DirtMap} from '../src/carpet/dirt.js';
import {seededRandom} from '../src/carpet/random.js';
import {rotationEntries,carpetGeometry,carpetEntryType} from '../src/carpet/assets.js';
import {readFileSync} from 'node:fs';
const entries=rotationEntries(JSON.parse(readFileSync('public/carpets/manifest.json','utf8')));
it('makes random 0.75-strength hits easy initially and allows 1.6x playing time on carpets 1..8',()=>{
  const counts=[];
  for(let n=1;n<=8;n++) {
    const difficulty=difficultyFor(n),type=carpetEntryType(entries[n-1]);
    const layout=carpetGeometry(type,entries[n-1].aspect);
    const dirt=new DirtMap({dirtAmount:type.dirtAmount*difficulty.dirtAmount,foldAxis:layout.foldAxis,width:layout.width,height:layout.height});
    let hits=0,halves=[];
    for(let side=0;side<2;side++) {
      const random=seededRandom('difficulty:'+side);dirt.visibleSide=side;let count=0;
      while(dirt.halfCleanliness(side)<difficulty.threshold&&count<500){let u=random(),v=random();
        if(layout.foldAxis==='u')u=side===0?.5+u*.5:u*.5;else v=(v+side)/2;
        dirt.hit(u,v,.75);count++;}
      hits+=count;halves.push(count);
    }
    if(n===1){expect(hits).toBeGreaterThanOrEqual(22);expect(hits).toBeLessThanOrEqual(30);for(const count of halves){expect(count).toBeGreaterThanOrEqual(11);expect(count).toBeLessThanOrEqual(15);}}
    expect(hits).toBeLessThanOrEqual(difficulty.expectedHits);
    expect(difficulty.seconds).toBeGreaterThanOrEqual(1.6*(hits/1.1+difficulty.flipSeconds));
    counts.push(hits);dirt.texture.dispose();
  }
  console.log('Random hits per carpet 1..8:',counts.join(', '));
  expect(difficultyFor(8)).toEqual(difficultyFor(6));
});

it('averages 22?30 total hits and 11?15 per half across thirty seeded random first carpets',()=>{
 const first=entries[0],type=carpetEntryType(first),layout=carpetGeometry(type,first.aspect);
 let total=0;
 for(let seed=0;seed<30;seed++) {
  const random=seededRandom('random:'+seed),dirt=new DirtMap({foldAxis:layout.foldAxis,dirtAmount:type.dirtAmount*difficultyFor(1).dirtAmount,width:layout.width,height:layout.height});
  for(let side=0;side<2;side++) {
   dirt.visibleSide=side;let count=0;
   while(dirt.halfCleanliness(side)<.9&&count<200){let u=random(),v=random();if(layout.foldAxis==='u')u=side===0?.5+u/2:u/2;else v=(v+side)/2;dirt.hit(u,v,.75);count++;}
   expect(count).toBeLessThan(200);total+=count;
  }
  dirt.texture.dispose();
 }
 console.log("Thirty-seed first-carpet mean:",total/30);
 expect(total/30).toBeGreaterThanOrEqual(22);expect(total/30).toBeLessThanOrEqual(30);
 expect(total/60).toBeGreaterThanOrEqual(11);expect(total/60).toBeLessThanOrEqual(15);
});
