import { FLIP_DURATION } from './state.js';

// Game time drives the animation even when physics drops catch-up steps.
export function bindClothFlip(game, getCarpet) {
  game.flipSettled=()=>getCarpet().cloth.flipSettled?.()??false;
  game.flipCrownPassed=()=>{
    const c=getCarpet().cloth,f=c.flip;if(!f?.sides?.length)return FLIP_DURATION-game.flipRemaining>=.65;
    const x=c.foldAxis==='u'?c.cols/2-1:Math.round(c.cols/2);
    const y=c.foldAxis==='u'?Math.round(c.rows/2):c.rows/2-1;
    const i=y*(c.cols+1)+x;
    return Number.isFinite(f.crossed[i]);
  };
  game.on('flipStart', () => getCarpet().cloth.startFlip({externalClock:true}));
  game.on('flipProgress', age => {
    const {cloth}=getCarpet();
    if(cloth.flip) {
      cloth.flip.age=age;
    }
  });
  game.on('flipEnd', side => {
    const {cloth}=getCarpet();
    if(cloth.flip) {cloth.flip.age=FLIP_DURATION;cloth.driveFlip(1);if(cloth.finishFlip)cloth.finishFlip();else cloth.flip=null;}
    cloth.setVisibleSide(side);
    cloth.projectBar();
    cloth.projectLayers();
    cloth.readNodes();
    cloth.refreshGeometry();
  });
  game.on('side', side => {
    const {cloth,dirt}=getCarpet();
    dirt.visibleSide=side;
    cloth.setVisibleSide(side);
  });
}
