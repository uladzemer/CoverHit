import { installModal } from './modalFlow.js';
import './tokens.css';
import './hud.css';
import { gsap } from 'gsap';
import { COMBO_RESET_SECONDS } from '../game/state.js';
import { readReticleSize, saveReticleSize } from '../input/reticleHelpers.js';
import * as THREE from 'three';
import { createBeaterModel } from '../input/beaters/index.js';

/** Mount in the canvas container: new Hud({ container, onStart, onNextCarpet }).
 * Callbacks can also be assigned as hud.onStart / hud.onNextCarpet.
 * Without callbacks the buttons call the bound game's start()/nextCarpet().
 */
export class Hud {
  constructor(options = {}) {
    if (options?.appendChild) options = { container: options };
    this.onStart = options.onStart;
    this.onNextCarpet = options.onNextCarpet;
    this.onMute = options.onMute;
    this.beaters = options.beaters || [];
    this.progression = options.progression;
    this.onSelectBeater = options.onSelectBeater;
    this.beaterIndex = Math.max(0, this.beaters.findIndex(b => b.id === this.progression?.selected));
    this.unsubscribers = [];
    this.timeouts = new Set();
    if (!document.querySelector('link[data-coverhit-font]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&family=PT+Sans+Narrow:wght@400;700&family=Russo+One&display=swap';
      for (const href of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
        const preconnect = document.createElement('link'); preconnect.rel = 'preconnect'; preconnect.href = href;
        if (href.includes('gstatic')) preconnect.crossOrigin = 'anonymous';
        document.head.append(preconnect);
      }
      link.dataset.coverhitFont = '';
      document.head.append(link);
    }
    this.root = document.createElement('div');
    this.root.className = 'coverhit-hud';
    this.root.innerHTML = `
      <div class="ch-zone ch-top-left ch-panel"><div class="ch-score"><span>Очки</span><strong data-score>0</strong></div><div class="ch-combo-block"><span>Ритм двора</span><strong class="ch-combo" data-combo>×1</strong><div class="ch-combo-track"><div data-combo-window></div></div></div></div>
      <div class="ch-zone ch-top-right ch-panel"><div class="ch-clock"><span>Время смены</span><strong data-timer>01:30</strong><small data-clock-hint>С первого удара</small></div><div class="ch-toggles"><button type="button" class="ch-chip" data-mute aria-pressed="false">Звук: вкл · M</button><button type="button" class="ch-chip" data-reticle></button></div></div>
      <div class="ch-zone ch-bottom-left ch-panel"><div class="ch-carpet-info"><strong data-type></strong><small data-carpet-title></small></div><div class="ch-clean"><label><span data-side>Сторона 1/2 · Чистота</span><strong data-percent>0%</strong></label><div class="ch-track" role="progressbar" aria-label="Чистота" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div data-fill></div><i class="ch-threshold" aria-hidden="true"></i></div><div class="ch-clean-footer"><small>Норма: 90%</small><button type="button" class="ch-secondary ch-flip" data-flip>Перекинуть · F</button></div></div></div>
      <div class="ch-zone ch-bottom-right ch-panel"><details class="ch-stats"><summary>Статистика</summary><div class="ch-records"><span>Ковров выбито <b data-carpets>0</b></span><span>Рекорд смены <b data-best>0</b></span><small>Две стороны — один чистый ковёр</small></div></details></div>
      <div class="ch-screen" data-screen hidden></div><div class="ch-results" data-results hidden></div>
      <div class="ch-toast" data-toast role="status" aria-live="polite" hidden></div>
      <div class="ch-moth-popup" data-popup role="status" hidden>+300 · Моль!</div>
      <div data-reward hidden></div>`;
    (options.container || document.body).append(this.root);
    this.nodes = {};
    for (const name of ['score', 'combo', 'timer', 'percent', 'fill', 'carpets', 'best', 'screen', 'title', 'description', 'action', 'toast', 'popup', 'mute', 'side', 'flip', 'reticle', 'type', 'carpet-title', 'results', 'clock-hint', 'combo-window', 'reward']) this.nodes[name] = this.root.querySelector(`[data-${name}]`);
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.motionChanged = () => {
      if (this.motion.matches || this.reduceMotion) {
        gsap.killTweensOf(this.root.querySelectorAll('*'));
        this.timerPulse = null;
        gsap.set([this.nodes.timer, this.nodes.combo, this.nodes.flip], { scale: 1 });
        this.root.querySelectorAll('.ch-score-pop').forEach(n => n.remove());
      }
    };
    this.motion.addEventListener('change', this.motionChanged);
    this.handleFlip = () => options.onFlip?.(); this.nodes.flip.addEventListener('click', this.handleFlip);
    let storage;
    try { storage = window.localStorage; } catch {}
    this.reticleSize = readReticleSize(storage);
    this.updateReticleLabel = () => {
      this.nodes.reticle.textContent = `\u041f\u0440\u0438\u0446\u0435\u043b: ${this.reticleSize === 'large' ? '\u043a\u0440\u0443\u043f\u043d\u044b\u0439' : '\u043e\u0431\u044b\u0447\u043d\u044b\u0439'} \u00b7 R`;
      this.nodes.reticle.setAttribute('aria-label', '\u041a\u0440\u0443\u043f\u043d\u044b\u0439 \u043f\u0440\u0438\u0446\u0435\u043b (R)');
      this.nodes.reticle.setAttribute('aria-pressed', String(this.reticleSize === 'large'));
      this.nodes.reticle.dataset.icon = '◎';
      this.nodes.reticle.title = this.nodes.reticle.textContent;
    };
    this.cycleReticle = () => {
      this.reticleSize = this.reticleSize === 'normal' ? 'large' : 'normal';
      saveReticleSize(storage, this.reticleSize); this.updateReticleLabel();
    };
    this.reticleKey = event => {
      if (event.code === 'KeyR' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey &&
          !event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) this.cycleReticle();
    };
    this.nodes.reticle.addEventListener('click', this.cycleReticle);
    window.addEventListener('keydown', this.reticleKey); this.updateReticleLabel();
    this.handleMute = () => this.onMute?.();
    this.nodes.mute.addEventListener('click', this.handleMute);
    this.setMuted(false);
    this.handleAction = async () => {
      if (this.nodes.action.disabled) return;
      this.nodes.action.disabled = true;
      try {
        if (this.game?.state === 'carpetDone') {
          if (this.onNextCarpet) await this.onNextCarpet(); else this.game.nextCarpet();
        } else if (this.onStart) await this.onStart(); else this.game?.start();
      } finally { this.nodes.action.disabled = false; }
    };
    this.nodes.carpetTitle = this.nodes['carpet-title'];
    if (this.beaters.length) {
      const selector = document.createElement('div'); selector.className = 'ch-selector';
      selector.innerHTML = '<div class="ch-carousel"><button type="button" data-prev aria-label="Предыдущая выбивалка">‹</button><div data-preview></div><button type="button" data-next aria-label="Следующая выбивалка">›</button></div><strong data-beater-name></strong><small data-era></small><small data-lock></small><div class="ch-beater-stats" data-stats></div>';
      this.root.append(selector); this.nodes.selector = selector;
      for (const name of ['preview','beater-name','era','lock','stats']) this.nodes[name] = selector.querySelector(`[data-${name}]`);
      try { this.previewRenderer = new THREE.WebGLRenderer({ alpha:true, antialias:true });
      this.previewRenderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
      this.previewRenderer.setSize(160, 120); this.nodes.preview.append(this.previewRenderer.domElement);
      this.previewScene = new THREE.Scene();
      this.previewScene.add(new THREE.HemisphereLight(0xfff1d5, 0x614333, 3));
      this.previewCamera = new THREE.PerspectiveCamera(40, 4/3, .1, 10);
      } catch { this.previewRenderer = null; this.nodes.preview.textContent = 'COVERHIT'; }
      this.handlePrev = () => this.cycleBeater(-1); this.handleNext = () => this.cycleBeater(1);
      selector.querySelector('[data-prev]').addEventListener('click', this.handlePrev);
      selector.querySelector('[data-next]').addEventListener('click', this.handleNext);
      this.refreshBeater();
    }
    installModal(this, options);
  }

  bind(game) {
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    this.game = game;
    const listen = (event, callback) => this.unsubscribers.push(game.on(event, callback));
    listen('score', value => { this.nodes.score.textContent = this.number(value); });
    listen('best', value => { this.nodes.best.textContent = this.number(value); });
    listen('combo', value => {
      this.nodes.combo.textContent = `×${value}`;
      this.bump(this.nodes.combo);
    });
    listen('timer', value => this.setTimer(value));
    listen('carpets', value => { this.nodes.carpets.textContent = value; });
    listen('state', state => this.showState(state));
    listen('carpetDone', ({ timeBonus }) => this.showResults(game.carpetStats, timeBonus));
    listen('side', side => { this.setSide(side); this.setCleanliness(0); });
    listen('flipStart', () => { this.bump(this.nodes.flip); this.setComboWindow(0); });
    listen('gameOver', ({ score }) => {
      this.nodes.description.textContent = `Очки: ${this.number(score)} · Рекорд: ${this.number(game.best)}`;
    });
    listen('neighborWarning', ({ count }) => this.toast(count === 1 ? 'Соседка: «Да сколько можно!»' : 'Соседка: «Последний раз предупреждаю!»'));
    listen('neighborPenalty', () => this.toast('Соседка: «Всё, вызываю участкового!» −500'));
    listen('mothCaught', () => this.flash(this.nodes.popup, 1600));
    this.nodes.score.textContent = this.number(game.score);
    this.nodes.best.textContent = this.number(game.best);
    this.nodes.carpets.textContent = game.carpets;
    this.nodes.combo.textContent = `×${game.comboMultiplier}`;
    this.setTimer(game.remainingSeconds);
    this.showState(game.state);
    return this;
  }

  number(value) { return Math.round(value).toLocaleString('ru-RU'); }
  setCarpetType(name, title = '') { this.nodes.type.textContent = name; this.nodes.carpetTitle.textContent = title; }
  cycleBeater(direction) {
    this.beaterIndex = (this.beaterIndex + direction + this.beaters.length) % this.beaters.length;
    const entry = this.beaters[this.beaterIndex];
    if (entry.unlockCarpets <= (this.progression?.total || 0)) this.onSelectBeater?.(entry.id);
    this.refreshBeater();
  }
  refreshBeater() {
    if (!this.beaters.length) return;
    const entry = this.beaters[this.beaterIndex], locked = entry.unlockCarpets > (this.progression?.total || 0);
    this.nodes['beater-name'].textContent = entry.nameRu;
    this.nodes.era.textContent = entry.era;
    const ranges = [['Вес', 'swingMass', false], ['Радиус', 'headRadius', false], ['Скорость', 'swingMass', true]];
    this.nodes.stats.replaceChildren(...ranges.map(([label, key, inverse]) => {
      const values = this.beaters.map(b => inverse ? 1 / b.feel[key] : b.feel[key]);
      const value = inverse ? 1 / entry.feel[key] : entry.feel[key];
      const percent = 20 + 80 * (value - Math.min(...values)) / (Math.max(...values) - Math.min(...values) || 1);
      const row = document.createElement('div'); row.innerHTML = `<span>${label}</span><meter min="0" max="100" value="${percent}" aria-label="${label}"></meter><b>${value.toFixed(2)}</b>`; return row;
    }));
    this.nodes.lock.textContent = locked ? `Выбей ещё ${entry.unlockCarpets - (this.progression?.total || 0)} ковров` : 'Выбрана';
    if (!this.previewRenderer) return;
    // Browsing a lock leaves the last unlocked selection active.
    this.previewModel?.group.removeFromParent(); this.previewModel?.dispose();
    this.previewModel = createBeaterModel(entry.id); this.previewScene.add(this.previewModel.group);
    const bounds = new THREE.Box3().setFromObject(this.previewModel.group);
    const center = bounds.getCenter(new THREE.Vector3());
    this.previewCamera.position.copy(center).add(new THREE.Vector3(.22, .12, bounds.getSize(new THREE.Vector3()).length() * 1.6));
    this.previewCamera.lookAt(center);
    this.previewScene.overrideMaterial = locked ? (this.silhouetteMaterial ??= new THREE.MeshBasicMaterial({ color:0x29232a })) : null;
    this.previewRenderer.render(this.previewScene, this.previewCamera);
  }
  update() {
    const game = this.game;
    this.setComboWindow(game?.state === 'playing' && game.lastHit != null ? 1 - (game.time - game.lastHit) / COMBO_RESET_SECONDS : 0);
    this.nodes['clock-hint'].textContent = game?.timerStarted ? 'Держи ритм!' : 'С первого удара';
  }
  bump(node) {
    if (this.motion.matches || this.reduceMotion) return;
    gsap.fromTo(node, { scale: 1.12 }, { scale: 1, duration: .3, ease: 'back.out(2)', overwrite: true });
  }
  setComboWindow(value) { this.nodes['combo-window'].style.width = `${Math.max(0, Math.min(1, value || 0)) * 100}%`; }
  popScore(screenX, screenY, points, quality = 'good') {
    if (!points) return;
    const node = document.createElement('div'); node.className = `ch-score-pop ch-quality-${quality}`;
    const labels = { excellent: 'Отлично', good: 'Хорошо', weak: 'Слабо' };
    node.innerHTML = `<strong>+${this.number(points)}</strong><small>${labels[quality] || labels.good}</small>`;
    node.style.left = `${Math.max(80, Math.min(this.root.clientWidth - 80, screenX))}px`;
    node.style.top = `${Math.max(80, Math.min(this.root.clientHeight - 100, screenY))}px`;
    this.root.append(node);
    if (this.motion.matches || this.reduceMotion) { const timeout = setTimeout(() => { node.remove(); this.timeouts.delete(timeout); }, 900); this.timeouts.add(timeout); }
    else gsap.fromTo(node, { y: 8, opacity: 1 }, { y: -48, opacity: 0, delay: .2, duration: .9, ease: 'power2.out', onComplete: () => node.remove() });
  }
  showResults(stats = {}, bonus) {
    const accuracy = stats.attempts ? Math.round(100 * stats.hits / stats.attempts) : 0;
    const items = [['Удары', stats.hits || 0], ['Точность', `${accuracy}%`], ['Время', `${(stats.seconds || 0).toFixed(1)} с`], ['Лучшее комбо', `×${stats.bestCombo || 1}`]];
    if (bonus != null) items.push(['За удары', this.number(stats.hitPoints || 0)], ['Бонус времени', `+${this.number(bonus)}`], ['Расчёт бонуса', `${this.game.remainingSeconds.toFixed(1)} с × 20`]);
    else items.push(['Очки', this.number(this.game.score)], ['Рекорд', this.number(this.game.best)]);
    this.nodes.results.replaceChildren(...items.map(([label, value]) => { const row = document.createElement('div'); const span = document.createElement('span'), strong = document.createElement('strong'); span.textContent = label; strong.textContent = value; row.append(span,strong); return row; }));
  }
  showUnlock(entries) {
    this.clearScorePops();
    this.pendingRewards = [...entries]; this.advanceReward();
  }
  clearScorePops() {
    for (const node of this.root.querySelectorAll('.ch-score-pop')) { gsap.killTweensOf(node); node.remove(); }
  }
  setMuted(muted) {
    this.muted = muted;
    if (!muted && this.volume === 0) this.volume = 0.8;
    this.nodes.mute.textContent = `Звук: ${muted ? 'выкл' : 'вкл'} · M`;
    this.nodes.mute.setAttribute('aria-pressed', String(muted));
    this.nodes.mute.setAttribute('aria-label', `${muted ? 'Включить' : 'Выключить'} звук (M)`);
    this.nodes.mute.dataset.icon = muted ? '♪×' : '♪';
    this.nodes.mute.title = this.nodes.mute.textContent;
  }
  setTimer(value) {
    const seconds = Math.max(0, Math.ceil(value));
    this.nodes.timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    this.nodes.timer.classList.toggle('ch-urgent', value < 10);
    if (value < 10 && !this.motion.matches && !this.reduceMotion && !this.timerPulse) {
      this.timerPulse = gsap.to(this.nodes.timer, { scale: 1.06, duration: .5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    } else if ((value >= 10 || this.motion.matches || this.reduceMotion) && this.timerPulse) {
      this.timerPulse.kill(); this.timerPulse = null; gsap.set(this.nodes.timer, { scale: 1 });
    }
  }
  setSide(side,flipping=false) {
    this.nodes.side.textContent=`Сторона ${side === 1 ? 2 : 1}/2 · Чистота`;
    this.nodes.flip.disabled=flipping||this.game?.state!=='playing';
    this.nodes.flip.textContent=flipping ? 'Перекидываем…' : 'Перекинуть · F';
  }
  setCleanliness(value) {
    const raw = Math.min(1, Math.max(0, Number(value) || 0)) * 100;
    const percent = raw >= 85 ? (Math.floor(raw * 10) / 10).toFixed(1) : Math.floor(raw);
    const done = raw >= 90;
    if (done && !this.sideReady) this.bump(this.nodes.flip);
    this.sideReady = done;
    this.nodes.flip.classList.toggle('ch-side-ready', done);
    this.nodes.fill.classList.toggle('ch-clean-ready', done);
    this.nodes.percent.textContent = `${percent}%`;
    this.nodes.fill.style.width = `${raw}%`;
    this.nodes.fill.parentElement.setAttribute('aria-valuenow', percent);
  }
  toast(message, retry) {
    if (retry && this.showRetry) { this.showRetry(message, retry); return; }
    const node=this.nodes.toast;
    node.textContent=message;
    this.flash(node,3500);
    if(retry) {
      clearTimeout(node.hideTimeout); this.timeouts.delete(node.hideTimeout);
      const button=document.createElement('button');
      button.type='button'; button.textContent='Повторить';
      button.onclick=async()=>{if(button.disabled)return;button.disabled=true;try{node.hidden=true;await retry();}finally{button.disabled=false;}};
      node.append(button);
    }
  }
  flash(node, duration) {
    if (node.hideTimeout) { clearTimeout(node.hideTimeout); this.timeouts.delete(node.hideTimeout); }
    node.hidden = false;
    node.hideTimeout = setTimeout(() => { node.hidden = true; this.timeouts.delete(node.hideTimeout); }, duration);
    this.timeouts.add(node.hideTimeout);
  }
  dispose() {
    this.creditsAbort?.abort();
    this.modal?.dispose();
    window.removeEventListener('keydown', this.menuKey);
    window.removeEventListener('coverhit-quality', this.qualityChanged);
    window.removeEventListener('coverhit-facades', this.facadesChanged);
    gsap.killTweensOf(this.root.querySelectorAll('*'));
    this.motion.removeEventListener('change', this.motionChanged);
    this.previewModel?.dispose(); this.previewRenderer?.dispose(); this.silhouetteMaterial?.dispose();
    for (const off of this.unsubscribers) off();
    for (const timeout of this.timeouts) clearTimeout(timeout);
    this.unsubscribers = [];
    this.timeouts.clear();
    this.nodes.action.removeEventListener('click', this.handleAction);
    this.nodes.mute.removeEventListener('click', this.handleMute);
    this.nodes.flip.removeEventListener('click',this.handleFlip);
    window.removeEventListener('keydown', this.reticleKey);
    this.nodes.reticle.removeEventListener('click', this.cycleReticle);
    this.root.remove();
    this.game = null;
  }
}
