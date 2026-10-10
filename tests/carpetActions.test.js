import {it,expect,vi} from 'vitest';
import {createCarpetActions} from '../src/game/carpetActions.js';
import {createCarpetAssets} from '../src/carpet/assets.js';
it.each(['carpetDone','gameOver'])('guards simultaneous start/next/restart in %s',async state=>{
 let release;const replaceCarpet=vi.fn(()=>new Promise(resolve=>{release=resolve;}));
 const game={state,carpetIndex:2,start:vi.fn(),nextCarpet:vi.fn()},assets={reset:vi.fn()};
 const actions=createCarpetActions({game,assets,replaceCarpet,hud:{toast:vi.fn()}});
 const first=state==='carpetDone'?actions.nextCarpet():actions.start();
 await actions.start();await actions.nextCarpet();await actions.start();
 expect(replaceCarpet).toHaveBeenCalledTimes(1);release();await first;
 expect(state==='carpetDone'?game.nextCarpet:game.start).toHaveBeenCalledTimes(1);
});
it('catches all-scan failure, offers a retry and releases the guard',async()=>{
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});let available=false;
 const assets=createCarpetAssets([{id:'09',type:'palas',aspect:1}],async()=>{if(!available)throw Error('404');return {};});
 const game={state:'carpetDone',carpetIndex:0,nextCarpet:vi.fn()},hud={toast:vi.fn()};
 const actions=createCarpetActions({game,assets,replaceCarpet:()=>assets.next(),hud});
 await expect(actions.nextCarpet()).resolves.toBeUndefined();
 expect(hud.toast).toHaveBeenCalledWith('Не удалось загрузить ковёр',expect.any(Function));
 expect(game.nextCarpet).not.toHaveBeenCalled();available=true;
 await hud.toast.mock.calls[0][1]();expect(game.nextCarpet).toHaveBeenCalledTimes(1);warn.mockRestore();
});
