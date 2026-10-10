export const CLEAN_THRESHOLD = 0.9;

// Session progression, independent of lifetime unlocks. Six carpets reach the cap.
export function difficultyFor(carpetNumber = 1) {
  const progress = Math.min(5, Math.max(0, Math.floor(carpetNumber) - 1)) / 5;
  return {
    dirtAmount: 0.20 + 0.60 * progress,
    expectedHits: Math.ceil(30 + 50 * progress),
    flipSeconds: 1.65,
    seconds: Math.max(90 + 25 * progress, Math.ceil(1.6 * ((30 + 50 * progress) / 1.1 + 1.65))),
    threshold: CLEAN_THRESHOLD,
  };
}
