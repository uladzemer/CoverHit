// No renderer, UI, or module dependencies: this also works after GPU loss.
const host = typeof window === 'undefined' ? null : window;
let lastStep = 'modules loading', hudReady = false, watchdog;
export const diagnostics = { assets: { loaded: 0, total: 0 }, reasons: [] };
export function diagnosticsText() {
  return JSON.stringify({ ua: host?.navigator.userAgent, dpr: host?.devicePixelRatio,
    viewport: host ? [host.innerWidth, host.innerHeight] : [], lastStep,
    ...diagnostics, steps: host?.__boot }, null, 2);
}
export function setBootStep(step) {
  lastStep = step;
  if (!host) return;
  (host.__boot ||= []).push({ step, t: Math.round(performance.now()),
    ...(performance.memory ? { mem: performance.memory.usedJSHeapSize } : {}) });
  if (step === 'hud ready') { hudReady = true; clearTimeout(watchdog); }
}
export function setAssetProgress(loaded, total) { diagnostics.assets = { loaded, total }; }
export function showBootError(error) {
  if (!host?.document) return;
  clearTimeout(watchdog);
  const doc = host.document;
  if (!doc.documentElement) return;
  let panel = doc.getElementById('boot-error');
  if (panel) return;
  panel = doc.createElement('section'); panel.id = 'boot-error'; panel.setAttribute('role', 'alert');
  panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#191e24;color:#fff;padding:24px;box-sizing:border-box;overflow:auto;font:16px/1.5 system-ui;display:flex;flex-direction:column;gap:12px;';
  const line = (tag, text) => { const node = doc.createElement(tag); node.textContent = text; panel.append(node); return node; };
  line('h1', 'Не удалось запустить игру');
  line('p', `Этап: ${lastStep}. Ресурсы: ${diagnostics.assets.loaded}/${diagnostics.assets.total}`);
  line('p', String(error?.message || error || 'Неизвестная ошибка').slice(0, 350));
  for (const [label, lite] of [['Перезагрузить', false], ['Облегчённый режим', true]]) {
    const button = line('button', label);
    button.style.cssText = 'font:inherit;min-height:48px;padding:10px;background:#e8e4dc;color:#111;border:0;border-radius:8px;';
    button.onclick = () => {
      if (!lite) { host.location.reload(); return; }
      const url = new URL(host.location.href); url.searchParams.delete('full'); url.searchParams.set('lite', '1');
      if (url.href === host.location.href) host.location.reload(); else host.location.assign(url.href);
    };
  }
  line('label', 'Диагностика (можно скопировать)');
  const report = line('textarea', ''); report.value = diagnosticsText(); report.readOnly = true;
  report.style.cssText = 'width:100%;min-height:180px;box-sizing:border-box;background:#10151b;color:#ddd;font:12px monospace;';
  report.onclick = () => report.select();
  doc.documentElement.append(panel);
}
export function installBootGuard(target = host, timeout = 25000) {
  if (!target || target.__coverhitBootGuard) return;
  target.__coverhitBootGuard = true;
  target.addEventListener('error', event => showBootError(event.error || event.message));
  target.addEventListener('unhandledrejection', event => showBootError(event.reason));
  target.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    try { target.sessionStorage.setItem('coverhit-context-lost', '1'); } catch {}
    diagnostics.reasons.push('WebGL context lost'); setBootStep('WebGL context lost');
    showBootError('Графический контекст потерян. Перезагрузите в облегчённом режиме.');
  }, true);
  watchdog = setTimeout(() => { if (!hudReady) showBootError('Загрузка превысила 25 секунд'); }, timeout);
  target.__bootDiagnostics = diagnostics;
  target.__bootDiagnosticsText = diagnosticsText;
}
installBootGuard();
