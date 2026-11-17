/**
 * The arcade clock (R9). It does not follow the real clock: one in-game day lasts 10 real minutes,
 * and a new house starts at 18:00, just as the jack-o'-lanterns are lit.
 */
export const MS_PER_HOUR = 25_000;
export const MS_PER_DAY = MS_PER_HOUR * 24;
export const START_HOUR = 18;

export type Phase = 'day' | 'dusk' | 'night' | 'witching' | 'dawn';
export interface GameTime { day: number; hour: number; minute: number; phase: Phase; /** 0..24, fractional */ hours: number }

export const PHASE_LABELS: Record<Phase, string> = {
  day: 'Gloomy day', dusk: 'Dusk', night: 'Night', witching: 'Witching hour', dawn: 'Before dawn',
};

export function phaseOf(hour: number): Phase {
  const h = ((hour % 24) + 24) % 24;
  if (h < 3) return 'witching';
  if (h < 6) return 'dawn';
  if (h < 17) return 'day';
  if (h < 19) return 'dusk';
  return 'night';
}

/** `playMs`: milliseconds the house has been open (only counts while it runs). */
export function arcadeClock(playMs: number): GameTime {
  const ms = Number.isFinite(playMs) && playMs > 0 ? playMs : 0;
  const total = START_HOUR + ms / MS_PER_HOUR;
  const day = Math.floor(total / 24) + 1;
  const hours = total - (day - 1) * 24;
  const hour = Math.min(23, Math.floor(hours));
  const minute = Math.min(59, Math.floor((hours - hour) * 60));
  return { day, hour, minute, hours, phase: phaseOf(hours) };
}

export const clockText = (t: GameTime) => `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

/**
 * How dark the room is, 0 (bright) .. 1 (deepest night), smooth across the hours.
 * Halloween is a dim holiday: even the day stays a little gloomy.
 */
export function darkness(hours: number): number {
  const h = ((hours % 24) + 24) % 24;
  const keys: [number, number][] = [[0, .95], [3, .9], [5.5, .55], [7, .25], [12, .18], [16, .3], [18, .6], [20, .85], [24, .95]];
  for (let i = 1; i < keys.length; i++) {
    const [h1, v1] = keys[i];
    if (h <= h1) { const [h0, v0] = keys[i - 1], u = (h - h0) / (h1 - h0), s = u * u * (3 - 2 * u); return v0 + (v1 - v0) * s; }
  }
  return keys[keys.length - 1][1];
}
