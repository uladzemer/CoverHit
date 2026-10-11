export const TOUCH_AIM_OFFSET = 0;
export const RAISED_TOUCH_AIM_OFFSET = -40;
export function readTouchAimOffset(storage) {
  try { return storage?.getItem('coverhit-raised-aim') === '1' ? RAISED_TOUCH_AIM_OFFSET : 0; } catch { return 0; }
}
export function saveTouchAimOffset(storage, raised) {
  try { storage?.setItem('coverhit-raised-aim', raised ? '1' : '0'); } catch {}
  return raised ? RAISED_TOUCH_AIM_OFFSET : 0;
}
export function pointerAim(event, rect, offset = TOUCH_AIM_OFFSET) {
  // client coordinates and getBoundingClientRect share the layout viewport.
  // visualViewport offsets must not be added to just one side: toolbar/pan
  // movement is already represented by rect.top/left. DPR is irrelevant here.
  const x = event.pointerType !== 'touch' ? event.clientX : Math.min(rect.right ?? rect.left + rect.width, Math.max(rect.left, event.clientX));
  const y = event.pointerType !== 'touch' ? event.clientY : Math.min(rect.bottom ?? rect.top + rect.height, Math.max(rect.top, event.clientY + (event.pointerType === 'touch' ? offset : 0)));
  return { x, y, nx: (x - rect.left) / rect.width * 2 - 1, ny: 1 - (y - rect.top) / rect.height * 2 };
}
export function inputModality(pointerType, coarse = false, previous = 'mouse') {
  return pointerType === 'touch' ? 'touch' : pointerType === 'mouse' || pointerType === 'pen' ? pointerType : coarse ? 'touch' : previous;
}
/** Viewport changes update layout only; game state and clocks remain untouched. */
export function installTouchEnvironment(onModality) {
  const coarse = window.matchMedia('(pointer: coarse)');
  let mode = inputModality('', coarse.matches);
  const apply = next => { mode = next; document.documentElement.dataset.input = mode; onModality(mode); };
  const pointer = e => { const next = inputModality(e.pointerType, false, mode); if (next !== mode) apply(next); };
  const change = () => apply(inputModality('', coarse.matches));
  const viewport = () => document.documentElement.style.setProperty('--vh', `${(window.visualViewport?.height || window.innerHeight) / 100}px`);
  const prevent = e => e.preventDefault();
  const touch = e => { if (e.touches.length > 1 && !e.target.closest('button,input,select,a')) e.preventDefault(); };
  apply(mode); viewport();
  window.addEventListener('pointerdown', pointer, true);
  coarse.addEventListener('change', change);
  for (const name of ['resize', 'orientationchange']) window.addEventListener(name, viewport);
  window.visualViewport?.addEventListener('resize', viewport);
  document.addEventListener('contextmenu', prevent);
  document.addEventListener('gesturestart', prevent, { passive: false });
  document.addEventListener('touchmove', touch, { passive: false });
  return () => {
    window.removeEventListener('pointerdown', pointer, true); coarse.removeEventListener('change', change);
    for (const name of ['resize', 'orientationchange']) window.removeEventListener(name, viewport);
    window.visualViewport?.removeEventListener('resize', viewport);
    document.removeEventListener('contextmenu', prevent); document.removeEventListener('gesturestart', prevent); document.removeEventListener('touchmove', touch);
  };
}
