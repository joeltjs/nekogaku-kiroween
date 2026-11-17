import { createHash } from 'node:crypto';

/** VOICEVOX speaker 2: 四国めたん (ノーマル). Credit: VOICEVOX:四国めたん */
export const SPEAKER = 2;
/** File name of a generated clip. The game computes the same hash in the browser (game/main.ts). */
export const voiceFile = text => `${createHash('sha256').update(`${SPEAKER}|${text}`).digest('hex').slice(0, 16)}.mp3`;
export const voiceUrl = text => `/audio/voice/${voiceFile(text)}`;
