import { strikeQuality, feel } from './feel.js';
import { difficultyFor, CLEAN_THRESHOLD } from './difficulty.js';

export const FLIP_DURATION = 1.65;

export const RHYTHM_MIN_SECONDS = 0.35;
export const RHYTHM_MAX_SECONDS = 1.1;
export const COMBO_RESET_SECONDS = 1.6;

/** Pure arcade rules. All clocks advance only through update(dt), in seconds.
 * score/combo/timer/best events carry numbers; state carries the state string.
 * Structured gameplay events carry objects. on() returns an unsubscribe function.
 */
export class Game {
  constructor({ getCleanliness = () => 0, getHalfCleanliness, rng = Math.random } = {}) {
    this.getCleanliness = getCleanliness;
    this.getHalfCleanliness = getHalfCleanliness;
    this.rng = rng;
    this.listeners = new Map();
    this.events = { on: (name, cb) => this.on(name, cb), emit: (name, data) => this.emit(name, data) };
    this.state = 'menu';
    this.visibleSide = 0;
    this.flipping = false;
    this.timerStarted = false;
    this.score = 0;
    this.best = 0;
    try { this.best = Math.max(0, Number(globalThis.localStorage.getItem('coverhit.best')) || 0); } catch {}
    this.carpets = 0;
    this.carpetIndex = 0;
    this.remainingSeconds = 90;
    this.streak = 0;
    this.comboMultiplier = 1;
    this.time = 0;
    this.mothSequence = 0;
    this.moths = new Map();
  }

  on(name, cb) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(cb);
    return () => this.listeners.get(name)?.delete(cb);
  }

  emit(name, data) { for (const cb of [...(this.listeners.get(name) || [])]) cb(data); }
  setState(state) { if(state !== 'playing') this.finishFlip(); this.state = state; this.emit('state', state); }
  addScore(points) {
    if (!points) return;
    this.score += points;
    this.emit('score', this.score);
    if (this.score > this.best) {
      this.best = this.score;
      try { globalThis.localStorage.setItem('coverhit.best', String(this.best)); } catch {}
      this.emit('best', this.best);
    }
  }

  setStreak(streak) {
    const multiplier = Math.min(8, 1 + Math.floor(streak / 4));
    const changed = streak !== this.streak;
    this.streak = streak;
    this.comboMultiplier = multiplier;
    if (changed) this.emit('combo', multiplier);
  }

  start() {
    this.score = 0;
    this.carpets = 0;
    this.carpetIndex = 0;
    this.time = 0;
    this.sessionStats = { attempts: 0, hits: 0, bestCombo: 1, seconds: 0 };
    this.neighborCount = 0;
    this.lastNoise = -Infinity;
    this.nextDecay = Infinity;
    this.prepareCarpet();
    this.emit('score', 0);
    this.emit('combo', 1);
    this.emit('carpets', 0);
    this.setState('playing');
  }

  prepareCarpet() {
    this.finishFlip();
    this.visibleSide=0; this.flipping=false; this.flipRemaining=0;
    this.autoFlipped=new Set();
    this.emit('side',0);
    this.timerStarted = false;
    this.carpetStats = { attempts: 0, hits: 0, bestCombo: 1, seconds: 0, hitPoints: 0 };
    this.remainingSeconds = difficultyFor(this.carpetIndex + 1).seconds;
    this.setStreak(0);
    this.lastHit = null;
    this.hitTimes = [];
    this.moths.clear();
    this.nextMoth = this.time + 12 + this.rng() * 13;
    this.emit('timer', this.remainingSeconds);
  }

  nextCarpet() {
    if (this.state !== 'carpetDone') return;
    this.carpetIndex += 1;
    this.prepareCarpet();
    this.setState('playing');
  }

  onHit({ strength = 0, dust = 0, uv, miss = false } = {}) {
    if (this.state !== 'playing' || this.flipping) return 0;
    this.timerStarted = true;
    this.carpetStats.attempts++;
    this.sessionStats.attempts++;
    // Input may report a miss explicitly, or as a hit without any strength.
    if (miss || strength <= 0) {
      this.setStreak(0);
      this.lastHit = null;
      return 0;
    }
    if (this.lastHit !== null) {
      const gap = this.time - this.lastHit;
      if (gap > COMBO_RESET_SECONDS + 1e-9) this.setStreak(0);
      else if (gap >= RHYTHM_MIN_SECONDS - 1e-9 && gap <= RHYTHM_MAX_SECONDS + 1e-9) this.setStreak(this.streak + 1);
    }
    this.lastHit = this.time;
    this.carpetStats.hits++;
    this.sessionStats.hits++;
    this.carpetStats.bestCombo = Math.max(this.carpetStats.bestCombo, this.comboMultiplier);
    this.sessionStats.bestCombo = Math.max(this.sessionStats.bestCombo, this.comboMultiplier);
    const quality = strikeQuality(strength);
    const points = Math.round((10 * strength + dust * 50) * this.comboMultiplier * (quality === 'excellent' ? feel.excellentBonus : 1));
    this.carpetStats.hitPoints += points;
    this.addScore(points);
    this.hitTimes = this.hitTimes.filter(t => this.time - t <= 1 + 1e-9);
    this.hitTimes.push(this.time);
    // Sustained noise counts at most once per second, rather than every frame.
    if (this.hitTimes.length > 6 && this.time - this.lastNoise >= 1 - 1e-9) {
      this.lastNoise = this.time;
      this.neighborCount = Math.min(3, this.neighborCount + 1);
      this.nextDecay = this.time + 15;
      if (this.neighborCount < 3) this.emit('neighborWarning', { count: this.neighborCount });
      else {
        this.addScore(-500);
        this.setStreak(0);
        this.emit('neighborPenalty', { points: -500, count: 3 });
      }
    } else if (this.neighborCount) this.nextDecay = this.time + 15;
    this.emit('hit', { strength, dust, uv, quality, points });
    this.checkClean();
    return points;
  }

  catchMoth(id) {
    const moth = this.moths.get(id);
    if (this.state !== 'playing' || this.flipping || !moth || this.time >= moth.expires) return false;
    this.moths.delete(id);
    this.addScore(300);
    this.emit('mothCaught', { id, points: 300 });
    return true;
  }

  flip() {
    if(this.state!=='playing'||this.flipping)return false;
    this.flipping=true;this.flipRemaining=FLIP_DURATION;this.flipTarget=1-this.visibleSide;this.flipSwitched=false;this.throwEmitted=false;
    this.moths.clear();this.lastHit=null;
    this.emit('flipStart',{from:this.visibleSide,to:1-this.visibleSide});
    return true;
  }

  finishFlip() {
    if(!this.flipping) return;
    this.flipping=false; this.flipRemaining=0; this.visibleSide=this.flipTarget;
    this.emit('side',this.visibleSide); this.emit('flipEnd',this.visibleSide);
  }

  checkClean() {
    if (this.state !== 'playing' || this.flipping) return false;
    if(this.getHalfCleanliness) {
      const halves=[this.getHalfCleanliness(0),this.getHalfCleanliness(1)];
      if(!halves.every(v=>v>=CLEAN_THRESHOLD)) {
        if(this.remainingSeconds>=FLIP_DURATION && halves[this.visibleSide]>=CLEAN_THRESHOLD && !this.autoFlipped.has(this.visibleSide)) {this.autoFlipped.add(this.visibleSide);this.flip();}
        return false;
      }
    } else if(!(this.getCleanliness()>=CLEAN_THRESHOLD)) return false;
    const timeBonus = this.remainingSeconds * 20;
    this.addScore(timeBonus);
    this.carpets += 1;
    this.moths.clear();
    this.setState('carpetDone');
    this.emit('carpets', this.carpets);
    this.emit('carpetDone', { timeBonus, carpetIndex: this.carpetIndex });
    return true;
  }

  update(dt) {
    if (this.state !== 'playing' || !Number.isFinite(dt) || dt < 0) return;
    if(this.flipping) {
      this.flipRemaining=Math.max(0,this.flipRemaining-Math.min(dt,this.remainingSeconds));
      const age=FLIP_DURATION-this.flipRemaining;
      if(age>=.95&&!this.throwEmitted){this.throwEmitted=true;this.emit('flipThrow',{from:1-this.flipTarget,to:this.flipTarget});}
      if(!this.flipSwitched && (this.flipCrownPassed?.() ?? age>=.65)){this.flipSwitched=true;this.visibleSide=this.flipTarget;this.emit('side',this.visibleSide);}
      if(this.flipRemaining<=1e-9 || (age>=1.4 && this.flipSettled?.())) this.finishFlip();
      else this.emit('flipProgress',FLIP_DURATION-this.flipRemaining);
    }
    if (!this.timerStarted) {
      this.time += dt;
      this.nextMoth += dt;
      return;
    }
    const elapsed = Math.min(dt, this.remainingSeconds);
    this.carpetStats.seconds += elapsed;
    this.sessionStats.seconds += elapsed;
    const end = this.time + elapsed;
    // Process scheduled moth events chronologically, even with a large dt.
    while (this.state === 'playing') {
      let next = this.nextMoth;
      for (const moth of this.moths.values()) next = Math.min(next, moth.expires);
      if (next > end) break;
      this.time = next;
      for (const [id, moth] of this.moths) {
        if (moth.expires <= next) { this.moths.delete(id); this.emit('mothEscaped', { id }); }
      }
      if (this.nextMoth <= next) {
        const moth = { id: ++this.mothSequence, u: this.rng(), v: this.rng() };
        this.emit('mothUv',moth);
        if(!this.flipping) this.moths.set(moth.id, { ...moth, expires: next + 4 });
        this.nextMoth = next + 12 + this.rng() * 13;
        if(!this.flipping) this.emit('mothSpawn', moth);
      }
    }
    this.remainingSeconds = Math.max(0, this.remainingSeconds - Math.min(dt, this.remainingSeconds));
    this.time = end;
    if (this.lastHit !== null && this.time - this.lastHit > COMBO_RESET_SECONDS + 1e-9) this.setStreak(0);
    while (this.neighborCount > 0 && this.time >= this.nextDecay) {
      this.neighborCount -= 1;
      this.nextDecay += 15;
    }
    this.emit('timer', this.remainingSeconds);
    if (this.checkClean()) return;
    if (this.remainingSeconds === 0) {
      this.moths.clear();
      this.setState('gameOver');
      this.emit('gameOver', { score: this.score, carpets: this.carpets });
    }
  }
}
