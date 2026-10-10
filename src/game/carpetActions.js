// All session transitions share one lock, including restart through start().
export function createCarpetActions({game, assets, replaceCarpet, hud}) {
  let inFlight=false;
  const run=async action=>{
    if(inFlight) return;
    inFlight=true;
    try {await action();}
    catch {hud.toast('Не удалось загрузить ковёр',()=>run(action));}
    finally {inFlight=false;}
  };
  return {
    start:()=>run(async()=>{
      if(game.state==='playing') return;
      if(game.state!=='menu') {assets.reset();await replaceCarpet(undefined,undefined,1);}
      game.start();
    }),
    nextCarpet:()=>run(async()=>{
      if(game.state!=='carpetDone') return;
      await replaceCarpet(undefined,undefined,game.carpetIndex+2);
      game.nextCarpet();
    })
  };
}
