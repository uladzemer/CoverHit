import {it,expect,vi} from 'vitest';
import {Hud} from '../src/ui/hud.js';

it('shows a persistent Russian error toast with a working retry button',async()=>{
  const button={},node={append:vi.fn()};
  vi.stubGlobal('document',{createElement:()=>button});
  const hud={nodes:{toast:node},timeouts:new Set(),flash:vi.fn()};
  const retry=vi.fn(async()=>{});
  try {
    Hud.prototype.toast.call(hud,'Не удалось загрузить ковёр',retry);
    expect(node.textContent).toBe('Не удалось загрузить ковёр');
    expect(button.textContent).toBe('Повторить');
    expect(node.append).toHaveBeenCalledWith(button);
    await button.onclick();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
  } finally {vi.unstubAllGlobals();}
});
