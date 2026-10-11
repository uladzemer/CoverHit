import { Modal, paginate } from './modal.js';
import { readTouchAimOffset, saveTouchAimOffset } from '../input/touch.js';
const element = (className, html = '') => { const n = document.createElement('div'); n.className = className; n.innerHTML = html; return n; };
export function installModal(hud, options) {
  // Page nodes live off-DOM until selected; never inert a future page.
  hud.nodes.selector?.remove();
  hud.nodes.results.remove();
  hud.modal = new Modal(hud.nodes.screen, { onChange: open => {
    hud.blocking = open; hud.root.dataset.modal = String(open);
    if (window.__coverhit?.beater) { window.__coverhit.beater.enabled = !open && hud.game?.state === 'playing'; window.__coverhit.beater.cancel(); }
  }});
  hud.nodes.title = hud.modal.title; hud.nodes.description = hud.modal.description; hud.nodes.action = hud.modal.primary;
  hud.menuReopen = document.createElement('button'); hud.menuReopen.className = 'ch-secondary ch-menu-reopen'; hud.menuReopen.textContent = 'Меню · Esc'; hud.menuReopen.hidden = true;
  hud.menuReopen.onclick = () => hud.openMenu(hud.game?.state === 'playing'); hud.root.append(hud.menuReopen);
  hud.creditsEntries = [...(options.credits || []), ...(options.yardCredits || []), ...(options.stockCredits || []).map(e => ({...e, credit: 'Envato Elements', license: 'Личная лицензия'}))];
  hud.instructions = element('ch-instructions', `<ol class="ch-step-cards"><li><span>↓</span><b>Зажми — замах</b></li><li><span>✦</span><b>Отпусти — удар</b></li><li><kbd>F</kbd><b>Перекинь ковёр</b></li></ol><div class="ch-guide-columns"><table class="ch-controls"><caption>Управление</caption><tbody><tr><th>Мышь</th><td>Зажать / отпустить</td></tr><tr><th>F</th><td>Сменить сторону</td></tr><tr><th>R</th><td>Размер прицела</td></tr><tr><th>M</th><td>Звук</td></tr><tr><th>Esc</th><td>Меню / назад</td></tr></tbody></table><div class="ch-rule-rows"><p>♫ <b>Ритм:</b> ровные удары растят комбо.</p><p>★ <b>Чистота:</b> доведи обе стороны до 90%.</p><p>⌂ <b>Соседи:</b> после двух предупреждений — штраф.</p><p>✦ <b>Моль:</b> попади в полёте, получи +300.</p></div></div>`);
  const desktopInstructions = hud.instructions.innerHTML;
  hud.rulesHTML = hud.instructions.querySelector('.ch-rule-rows').outerHTML;
  hud.updateTouchHints = () => {
    hud.menuReopen.textContent = hud.touchMode ? 'Меню' : 'Меню · Esc';
    hud.instructions.innerHTML = desktopInstructions;
    if (hud.touchMode) {
      hud.instructions.querySelector('.ch-step-cards').innerHTML = '<li><span>↓</span><b>Зажми палец — замах</b></li><li><span>✦</span><b>Отпусти — удар</b></li><li><span>↻</span><b>Кнопка «Перекинуть»</b></li>';
      const labels = ['Палец', '↻', '◎', '♪', '☰'];
      const words = ['Веди по ковру — прицел под пальцем', 'Кнопка «Перекинуть»', 'Размер прицела', 'Звук', 'Меню / пауза'];
      hud.instructions.querySelectorAll('tr').forEach((row, i) => { row.querySelector('th').textContent = labels[i]; row.querySelector('td').textContent = words[i]; });
    }
    if (hud.blocking && hud.modalFlow === 'menu' && hud.phoneLayout.matches) {
      const guide = hud.modal.pages[0].content;
      guide.innerHTML = hud.instructions.innerHTML;
      guide.querySelector('.ch-rule-rows')?.remove();
    }
  };
  hud.phoneLayout = window.matchMedia('(max-width: 600px), (max-height: 500px)');
  hud.layoutChanged = () => { if (hud.blocking && hud.modalFlow === 'menu') { const i = hud.modal.index; hud.openMenu(hud.pausedMenu); hud.modal.go(i, false); } };
  hud.phoneLayout.addEventListener('change', hud.layoutChanged);
  hud.settings = element('ch-settings', `<label>Графика<select data-setting-quality><option value="high">Высокая</option><option value="medium">Средняя</option><option value="low">Низкая</option></select></label><label>Прицел<select data-setting-reticle><option value="normal">Обычный</option><option value="large">Крупный</option></select></label><label>Громкость<input data-setting-volume type="range" min="0" max="1" step="0.05" value="0.8"></label><label class="ch-motion-label"><input data-setting-motion type="checkbox"> Меньше движения</label><p>Ковры сменяются по очереди. Качество графики не меняет правила игры.</p>`);
  hud.setting = selector => hud.settings.querySelector(selector) || hud.settingPages?.map(p => p.querySelector(selector)).find(Boolean);
  hud.qualityChanged = event => {
    if (['high','medium','low'].includes(event.detail?.level)) hud.setting('[data-setting-quality]').value = event.detail.level;
  };
  window.addEventListener('coverhit-quality', hud.qualityChanged);
  hud.setting('[data-setting-quality]').onchange = e => window.__coverhit?.setQuality?.(e.target.value);
  const facadeLabel=document.createElement('label');facadeLabel.innerHTML='Фасады: <select data-setting-facades><option value="photo">фото</option><option value="procedural">рисованные</option></select>';
  hud.setting('[data-setting-quality]').closest('label').after(facadeLabel);
  hud.setting('[data-setting-facades]').onchange=e=>window.__coverhit?.setFacades?.(e.target.value);
  hud.facadesChanged=event=>{hud.setting('[data-setting-facades]').value=event.detail.mode;};
  window.addEventListener('coverhit-facades',hud.facadesChanged);
  hud.setting('[data-setting-reticle]').onchange = e => { if (e.target.value !== hud.reticleSize) hud.cycleReticle(); };
  const aimLabel=document.createElement('label');aimLabel.className='ch-motion-label ch-touch-aim-setting';
  aimLabel.innerHTML='<input data-setting-touch-aim type="checkbox"> Прицел над пальцем';
  hud.setting('[data-setting-reticle]').closest('label').after(aimLabel);
  let aimStorage;try{aimStorage=localStorage;}catch{}
  aimLabel.querySelector('input').checked=readTouchAimOffset(aimStorage)!==0;
  aimLabel.querySelector('input').onchange=e=>{
    const offset=saveTouchAimOffset(aimStorage,e.target.checked);
    if(window.__coverhit?.beater)window.__coverhit.beater.touchAimOffset=offset;
  };
  hud.volume = 0.8;
  hud.setting('[data-setting-volume]').oninput = e => { hud.volume = Number(e.target.value); options.onVolume?.(hud.volume); };
  hud.setting('[data-setting-motion]').onchange = e => { hud.reduceMotion = e.target.checked; hud.root.dataset.reducedMotion = String(hud.reduceMotion); if(hud.reduceMotion) hud.motionChanged(); };
  hud.openMenu = (paused = false) => {
    for (const page of hud.settingPages || []) hud.settings.append(...page.querySelectorAll('label'));
    hud.settingPages = null;
    hud.modalFlow = 'menu';
    hud.pausedMenu = paused; hud.menuReopen.hidden = true;
    hud.setting('[data-setting-quality]').value = window.__coverhit?.quality || 'high';
    hud.setting('[data-setting-facades]').value = window.__coverhit?.facades || 'photo';
    hud.setting('[data-setting-reticle]').value = hud.reticleSize;
    hud.setting('[data-setting-volume]').value = hud.muted ? 0 : hud.volume;
    const pages = [{title:'Как играть',content:hud.instructions}, {title:'Выбивалка',description:'Выбери инструмент. Новые откроются за чистые ковры.',content:hud.nodes.selector || element('', 'Выбивалка готова к работе.')}, {title:'Ковёр и графика',content:hud.settings}];
    if (hud.phoneLayout.matches) {
      const guide = hud.instructions.cloneNode(true); guide.querySelector('.ch-rule-rows')?.remove();
      pages[0].content = guide;
      pages.splice(1, 0, {title:'Правила двора',content:element('', hud.rulesHTML)});
      const labels = [...hud.settings.querySelectorAll('label')];
      const settingPages = [element('ch-settings'), element('ch-settings')];
      labels.forEach((label, i) => settingPages[i < 3 ? 0 : 1].append(label));
      pages[3].content = settingPages[0];
      pages.splice(4, 0, {title:'Звук и движение',content:settingPages[1]});
      hud.settingPages = settingPages;
    }
    for (const [index, entries] of paginate(hud.creditsEntries, hud.phoneLayout.matches ? 2 : 4).entries()) {
      const grid = element('ch-credit-grid');
      for (const entry of entries) {
        const card = element('ch-credit-card'); const link = document.createElement('a'); link.href = entry.sourceUrl || '#'; link.target='_blank'; link.rel='noopener noreferrer'; link.textContent=entry.title || entry.name || 'Источник';
        const credit=document.createElement('p');credit.textContent=[entry.credit || entry.author,entry.license].filter(Boolean).join(' · ');card.append(link,credit);grid.append(card);
      }
      if (!entries.length) grid.textContent = 'CoverHit · Дворовая аркада. Процедурные модели и звук.';
      pages.push({title:index ? `Об игре · источники ${index+1}` : 'Об игре',description:'Фотографии ковров, модели и звук. Источники и лицензии:',content:grid});
    }
    hud.modal.open({pages,primary:paused?'Продолжить':'Начать',onPrimary:paused?()=>hud.modal.close():()=>hud.handleAction(),onClose:()=>{if(hud.game?.state==='menu')hud.menuReopen.hidden=false;}});
  };
  hud.showState = state => {
    hud.clearScorePops(); hud.root.dataset.state = state; hud.menuReopen.hidden=true;
    hud.modal.close(false); hud.setSide(hud.game?.visibleSide,hud.game?.flipping);
    if(state === 'playing') { hud.menuReopen.hidden=false; return; }
    if(state === 'menu') { hud.openMenu(); return; }
    hud.modalFlow = 'result';
    const done = state === 'carpetDone';
    hud.nodes.results.hidden = false;
    hud.showResults(done ? hud.game?.carpetStats : hud.game?.sessionStats, done ? (hud.game?.remainingSeconds || 0)*20 : undefined);
    hud.modal.open({pages:[{title:done?'Ковёр чист!':'Смена окончена',description:done?'Обе стороны выполнили норму.':`Очки: ${hud.number(hud.game?.score || 0)} · Рекорд: ${hud.number(hud.game?.best || 0)}`,content:hud.nodes.results}],primary:done?'Следующий ковёр':'Ещё раз',onPrimary:()=>hud.handleAction(),onClose:()=>hud.showState(state)});
  };
  hud.advanceReward = () => {
    const entry=hud.pendingRewards?.shift(); if(!entry)return;
    hud.modalFlow = 'reward';
    const content=element('ch-unlock'); const name=document.createElement('strong');name.textContent=entry.nameRu;
    const index=hud.beaterIndex;hud.beaterIndex=hud.beaters.findIndex(b=>b.id===entry.id);hud.refreshBeater();
    if(hud.previewRenderer) {
      const thumbnail=document.createElement('canvas');thumbnail.width=hud.previewRenderer.domElement.width;thumbnail.height=hud.previewRenderer.domElement.height;thumbnail.getContext('2d').drawImage(hud.previewRenderer.domElement,0,0);thumbnail.setAttribute('aria-label',entry.nameRu);thumbnail.setAttribute('role','img');content.append(thumbnail);
    } else content.append(element('ch-beater-fallback','♧'));
    content.append(name);hud.beaterIndex=index;hud.refreshBeater();
    const finish=()=>{hud.modal.close(false);if(hud.pendingRewards.length)hud.advanceReward();else hud.showState(hud.game?.state || 'menu');};
    hud.handleRewardClose=finish;
    hud.modal.open({pages:[{title:'Новая выбивалка!',description:'За ударный труд во дворе.',content}],primary:'Отлично!',onPrimary:finish,onClose:finish});
  };
  hud.showRetry = (message,retry) => {
    hud.modalFlow = 'retry';
    const state=hud.game?.state; const content=element('ch-retry');content.textContent=message;
    hud.modal.open({pages:[{title:'Не удалось загрузить',content}],primary:'Повторить',onPrimary:async()=>{
      hud.modal.close(false);
      try { await retry(); } catch { hud.showRetry(message,retry); return; }
      if (!hud.blocking && hud.game && hud.game.state !== 'playing') hud.showState(hud.game.state || state);
      else if (!hud.game && !hud.blocking) hud.showRetry(message,retry);
    },onClose:()=>hud.game ? hud.showState(hud.game.state) : hud.showRetry(message,retry)});
  };
  // Stream manifests may arrive independently; absent/invalid JSON is optional.
  hud.addCredits = entries => {
    if (!Array.isArray(entries) || !entries.length) return;
    const current = new Set(hud.creditsEntries.map(e => e.sourceUrl || e.url));
    for (const entry of entries) if (entry && typeof entry === 'object' && !current.has(entry.sourceUrl || entry.url)) {
      hud.creditsEntries.push({...entry, title:entry.title || entry.name, sourceUrl:entry.sourceUrl || entry.url, credit:entry.credit || entry.author});
      current.add(entry.sourceUrl || entry.url);
    }
    // Refresh a setup dialog while retaining its selected page and pause mode.
    if (hud.blocking && hud.modalFlow === 'menu') {
      const index = hud.modal.index; hud.openMenu(hud.pausedMenu); hud.modal.go(index, false);
    }
  };
  const controller = new AbortController(); hud.creditsAbort = controller;
  // Ambience recordings ship their own credits file; yard/credits.json no longer exists (it was a 404 source).
  fetch(`${import.meta.env.BASE_URL}audio/credits.json`, {signal:controller.signal})
    .then(response => response.ok ? response.json() : null).then(data => { if (!controller.signal.aborted) hud.addCredits(data); })
    .catch(() => {});
  fetch(`${import.meta.env.BASE_URL}yard/photos/credits.json`, {signal:controller.signal})
    .then(response => response.ok ? response.json() : null)
    .then(data => { if (!controller.signal.aborted) hud.addCredits(data); })
    .catch(() => {});
  hud.menuKey = e => { if(e.key==='Escape' && !hud.blocking){e.preventDefault();hud.openMenu(hud.game?.state==='playing');} };
  window.addEventListener('keydown',hud.menuKey);
}
