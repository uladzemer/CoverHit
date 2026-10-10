import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/game/state.js';

afterEach(() => vi.unstubAllGlobals());
const makeGame = options => new Game({ rng: () => 0, ...options });
const hit = game => game.onHit({ strength: 1, dust: 0.2, uv: { x: 0.5, y: 0.5 } });
const burst = game => { for (let i = 0; i < 7; i++) hit(game); };

describe('Game', () => {
  it('ignores input and time outside playing and exposes an unsubscribable emitter', () => {
    const game = makeGame();
    const callback = vi.fn();
    const off = game.events.on('score', callback);
    hit(game); game.update(10);
    expect(game.score).toBe(0);
    expect(game.remainingSeconds).toBe(90);
    game.start();
    off(); hit(game);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('increases combo on rhythmic intervals, caps at eight, and resets after a pause', () => {
    const game = makeGame(); game.start(); hit(game);
    for (let i = 0; i < 4; i++) { game.update(0.5); hit(game); }
    expect(game.streak).toBe(4);
    expect(game.comboMultiplier).toBe(2);
    expect(game.score).toBe(120);
    game.update(0.1); hit(game);
    expect(game.streak).toBe(4);
    game.update(1.11); hit(game);
    expect(game.streak).toBe(4);
    for (let i = 0; i < 40; i++) { game.update(0.5); hit(game); }
    expect(game.comboMultiplier).toBe(8);
    game.update(1.61);
    expect(game.comboMultiplier).toBe(1);
    expect(game.streak).toBe(0);
  });

  it('includes both rhythm boundaries and preserves combo at exactly 1.6 seconds', () => {
    const game = makeGame(); game.start(); hit(game);
    game.update(0.35); hit(game); game.update(1.1); hit(game);
    expect(game.streak).toBe(2);
    game.update(1.6); expect(game.streak).toBe(2);
    game.update(0.001); expect(game.streak).toBe(0);
  });

  it('resets on a miss without scoring and does not consider invalid cleanliness clean', () => {
    const game = makeGame({ getCleanliness: () => NaN }); game.start(); hit(game);
    for (let i = 0; i < 4; i++) { game.update(0.5); hit(game); }
    const score = game.score;
    game.onHit({ miss: true, strength: 1 });
    expect(game.comboMultiplier).toBe(1); expect(game.score).toBe(score);
    expect(game.state).toBe('playing');
  });

  it('warns twice then penalizes sustained noise and resets combo', () => {
    const game = makeGame(); const warnings = vi.fn(); const penalty = vi.fn();
    game.on('neighborWarning', warnings); game.on('neighborPenalty', penalty);
    game.start(); burst(game);
    expect(warnings).toHaveBeenLastCalledWith({ count: 1 });
    game.update(1.01); burst(game);
    expect(warnings).toHaveBeenLastCalledWith({ count: 2 });
    game.update(1.01); const before = game.score; burst(game);
    expect(penalty).toHaveBeenCalledWith({ points: -500, count: 3 });
    expect(game.score).toBe(before + 140 - 500);
    expect(game.comboMultiplier).toBe(1);
    expect(warnings).toHaveBeenCalledTimes(2);
  });

  it('counts rolling windows and decays a warning per 15 seconds of calm', () => {
    const game = makeGame(); game.start();
    for (let i = 0; i < 7; i++) { hit(game); if (i < 6) game.update(0.15); }
    expect(game.neighborCount).toBe(1);
    game.update(14.99); expect(game.neighborCount).toBe(1);
    game.update(0.01); expect(game.neighborCount).toBe(0);
    burst(game); expect(game.neighborCount).toBe(1);
  });

  it('spawns reproducible moths, catches only once, and escapes at four seconds', () => {
    const game = makeGame(); const spawn = vi.fn(); const caught = vi.fn(); const escaped = vi.fn();
    game.on('mothSpawn', spawn); game.on('mothCaught', caught); game.on('mothEscaped', escaped);
    game.start(); game.onHit({miss:true}); game.update(12);
    const first = spawn.mock.calls[0][0];
    expect(first).toEqual({ id: 1, u: 0, v: 0 });
    game.update(3.99); expect(game.catchMoth(first.id)).toBe(true);
    expect(game.score).toBe(300); expect(game.catchMoth(first.id)).toBe(false);
    expect(caught).toHaveBeenCalledWith({ id: 1, points: 300 });
    game.update(8.01); game.update(4);
    expect(escaped).toHaveBeenCalledWith({ id: 2 });
    expect(game.catchMoth(2)).toBe(false);
  });

  it('processes spawn and expiry correctly across a large update', () => {
    const game = makeGame(); const escaped = vi.fn();
    game.on('mothEscaped', escaped); game.start(); game.onHit({miss:true}); game.update(28);
    expect(escaped.mock.calls.map(([evt]) => evt.id)).toEqual([1, 2]);
    expect(game.moths.size).toBe(0);
    expect(game.remainingSeconds).toBe(62);
  });

  it('awards the exact remaining-time bonus once and resumes a fresh carpet', () => {
    let cleanliness = 0;
    const game = makeGame({ getCleanliness: () => cleanliness }); const done = vi.fn();
    game.on('carpetDone', done); game.start(); game.onHit({miss:true}); game.update(10.25);
    cleanliness = 0.899; expect(game.checkClean()).toBe(false);
    cleanliness = 0.9; hit(game);
    expect(game.state).toBe('carpetDone');
    expect(done).toHaveBeenCalledWith({ timeBonus: 1595, carpetIndex: 0 });
    expect(game.score).toBe(1615); expect(game.carpets).toBe(1);
    game.update(100); hit(game); expect(done).toHaveBeenCalledTimes(1);
    cleanliness = 0; game.nextCarpet();
    expect(game.state).toBe('playing'); expect(game.carpetIndex).toBe(1);
    expect(game.remainingSeconds).toBe(95); expect(game.score).toBe(1615);
  });

  it('ends at the timer boundary, ignores invalid dt, and restarts cleanly', () => {
    const game = makeGame(); const over = vi.fn(); game.on('gameOver', over);
    game.start(); hit(game); game.update(-1); game.update(NaN);
    expect(game.remainingSeconds).toBe(90);
    game.update(100);
    expect(game.state).toBe('gameOver');
    expect(over).toHaveBeenCalledWith({ score: 20, carpets: 0 });
    game.update(1); expect(over).toHaveBeenCalledTimes(1);
    game.start(); expect(game.score).toBe(0); expect(game.remainingSeconds).toBe(90);
  });

  it('keeps a best score without localStorage or with throwing storage', () => {
    vi.stubGlobal('localStorage', undefined);
    const game = makeGame(); game.start(); hit(game); expect(game.best).toBe(20);
    game.start(); expect(game.best).toBe(20);
    vi.stubGlobal('localStorage', { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
    const blocked = makeGame(); blocked.start(); expect(() => hit(blocked)).not.toThrow();
    expect(blocked.best).toBe(20);
  });

  it('loads and persists the record under coverhit.best', () => {
    const setItem = vi.fn(); vi.stubGlobal('localStorage', { getItem: () => '100', setItem });
    const game = makeGame(); game.start(); game.onHit({ strength: 11, dust: 0 });
    expect(game.best).toBe(110); expect(setItem).toHaveBeenCalledWith('coverhit.best', '110');
  });
});
