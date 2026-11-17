/** Sound preferences shared by the grimoire and the house: music, sound effects and the VOICEVOX voices. */
export const SOUND_KEY = 'nekogaku-prefs';
const DEFAULTS = { music: true, effects: true, voice: true };

export function readSound() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SOUND_KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

/** Saves the preferences and tells the house, which may be running behind the grimoire. */
export function writeSound(prefs) {
  try { localStorage.setItem(SOUND_KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
  window.dispatchEvent(new CustomEvent('nekogaku:sound', { detail: prefs }));
}
