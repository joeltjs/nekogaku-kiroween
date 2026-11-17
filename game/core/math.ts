export type Vec = { x: number; y: number };

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
export const easeOut = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 3;
export const easeIn = (t: number) => clamp(t, 0, 1) ** 3;
export const easeInOut = (t: number) => { const u = clamp(t, 0, 1); return u < .5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; };
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
/** Damped approach that is frame-rate independent. */
export const approach = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));
export const wave = (t: number, period: number, phase = 0) => Math.sin((t / period + phase) * Math.PI * 2);

/** Small deterministic generator so tests can replay behavior. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

export function weightedPick<T>(entries: readonly (readonly [T, number])[], random: () => number): T | undefined {
  const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  if (total <= 0) return undefined;
  let roll = random() * total;
  for (const [value, weight] of entries) { roll -= Math.max(0, weight); if (roll <= 0) return value; }
  return entries[entries.length - 1][0];
}
