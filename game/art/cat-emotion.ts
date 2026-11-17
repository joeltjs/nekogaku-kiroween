import { clamp, lerp, smooth } from '../core/math';
import type { EyeStyle, MouthStyle, Pose } from './cat-rig';
import type { EmoteKind } from './emote';

/**
 * A cat's emotions, alive. An emotion is a face (eye and mouth shape, lids, brows, pupils, ears, cheeks, tears), a small
 * reaction when the cat changes into it, a mark that may pop up (game/art/emote.ts) and a little motion of its own while it lasts.
 *
 * Changing emotion never snaps (the idea is borrowed from ClaudeAnimationBase's `emotions`): the eyes shut as in a blink, the eye and mouth
 * *shape* changes under the shut lids, then the eyes open into the new face while the numbers (brows, lids, pupils, ears…) flow to their new
 * values with a little overshoot. The numbers are in `Pose`, so they also blend smoothly between clips (`lerpPose`).
 *
 * The cat's clip may already own the face (sleeping, chewing, a yawn, happy eyes while petted). Then only the numbers are added on top and
 * the shapes stay the clip's. The layer only ever touches the head and the face, never the body (the clip and the world own that).
 */
export type EmotionId =
  | 'neutral' | 'content' | 'happy' | 'joy' | 'love' | 'proud' | 'playful' | 'curious' | 'surprised' | 'scared' | 'sad' | 'cry'
  | 'sleepy' | 'bored' | 'annoyed' | 'angry' | 'shy' | 'hungry' | 'determined' | 'relieved' | 'chill';

export const EMOTION_IDS: readonly EmotionId[] = ['neutral', 'content', 'happy', 'joy', 'love', 'proud', 'playful', 'curious', 'surprised', 'scared', 'sad', 'cry',
  'sleepy', 'bored', 'annoyed', 'angry', 'shy', 'hungry', 'determined', 'relieved', 'chill'];

/** The face numbers an emotion moves. */
export type FaceNumbers = Pick<Pose, 'eyes' | 'lid' | 'lidTilt' | 'pupil' | 'brow' | 'browLift' | 'browAsym' | 'mouthCurve' | 'mouthOpen' | 'ears' | 'blush' | 'tear' | 'lookY'>;
export const FACE_KEYS = ['eyes', 'lid', 'lidTilt', 'pupil', 'brow', 'browLift', 'browAsym', 'mouthCurve', 'mouthOpen', 'ears', 'blush', 'tear', 'lookY'] as const;
export const NEUTRAL_FACE: FaceNumbers = { eyes: 1, lid: 0, lidTilt: 0, pupil: 1, brow: 0, browLift: 0, browAsym: 0, mouthCurve: 1, mouthOpen: 0, ears: 0, blush: 0, tear: 0, lookY: 0 };

export interface EmotionDef {
  eyeStyle: EyeStyle; mouth: MouthStyle;
  face: Partial<FaceNumbers>;
  /** The mark that may pop up when the cat changes into it. */
  emote?: EmoteKind;
  /** 0..1: how big the reaction is on changing into it (the head pops, the ears flick). */
  take: number;
  /** A little life on top, added to the pose: from the time in seconds and the cat's own seed. */
  idle?: (t: number, seed: number) => Partial<Pose>;
}

const s = Math.sin;

export const EMOTIONS: Record<EmotionId, EmotionDef> = {
  neutral: { eyeStyle: 'open', mouth: 'w', face: {}, take: 0 },
  // Quietly pleased: open eyes, a small smile, now and then a slow blink.
  content: { eyeStyle: 'open', mouth: 'smile', face: { blush: .15, mouthCurve: 1.1 }, take: .1,
    idle: (t, k) => ({ eyes: -.55 * Math.max(0, s(t * .9 + k * 3) - .86) / .14, headRot: s(t * .8 + k) * .012 }) },
  happy: { eyeStyle: 'happy', mouth: 'smile', face: { mouthCurve: 1.3, ears: .05, blush: .35, browLift: .15 }, take: .35,
    idle: (t, k) => ({ headRot: s(t * 1.7 + k) * .025, headY: s(t * 3.4 + k) * .5 }) },
  joy: { eyeStyle: 'wide', mouth: 'open', face: { pupil: 1.5, browLift: .85, mouthOpen: .6, ears: 0, blush: .5, mouthCurve: 1.2 }, emote: 'spark', take: .85,
    idle: (t, k) => ({ mouthOpen: .12 * s(t * 6 + k), headRot: s(t * 4 + k) * .04, headY: -Math.abs(s(t * 5 + k)) * 1.5 }) },
  love: { eyeStyle: 'happy', mouth: 'smile', face: { blush: .9, mouthCurve: 1.35, ears: .12, browLift: .3 }, emote: 'heart', take: .5,
    idle: (t, k) => ({ headRot: s(t * 1.2 + k) * .05, blush: .06 * s(t * 2.2) }) },
  // Chin up and a lopsided brow: pleased with itself.
  proud: { eyeStyle: 'sleepy', mouth: 'smile', face: { lid: .12, browAsym: .85, browLift: .2, mouthCurve: .75, ears: .1, lookY: -.3 }, take: .35,
    idle: (t, k) => ({ headRot: -.07 + s(t * .7 + k) * .01, headY: -1.5 }) },
  playful: { eyeStyle: 'wide', mouth: 'open', face: { pupil: 1.4, browLift: .5, mouthOpen: .3, ears: 0, blush: .2 }, take: .6,
    idle: (t, k) => ({ headRot: s(t * 5 + k) * .05, earTwitch: Math.max(0, s(t * 3.3 + k) - .8) * 3 }) },
  curious: { eyeStyle: 'wide', mouth: 'w', face: { pupil: 1.2, browLift: .6, browAsym: .5, ears: 0, mouthCurve: .8, lookY: -.2 }, emote: 'question', take: .55,
    idle: (t, k) => ({ headRot: s(t * .9 + k) * .07, lookX: s(t * 1.3 + k * 2) * .5, earTwitch: Math.max(0, s(t * 2.1 + k) - .85) * 4 }) },
  surprised: { eyeStyle: 'wide', mouth: 'open', face: { pupil: .6, browLift: 1, mouthOpen: .7, ears: 0 }, emote: 'exclaim', take: 1 },
  scared: { eyeStyle: 'wide', mouth: 'open', face: { pupil: .55, brow: .9, browLift: .5, mouthOpen: .25, ears: .9, mouthCurve: -.4 }, emote: 'sweat', take: .9,
    idle: (t, k) => ({ headRot: s(t * 37 + k) * .015, headX: s(t * 31 + k) * .7, lookX: s(t * 9 + k) * .45 }) },
  sad: { eyeStyle: 'sleepy', mouth: 'w', face: { lid: .2, lidTilt: -.8, brow: .9, browLift: .1, mouthCurve: -.85, ears: .6, tear: .35, lookY: .4 }, take: .4,
    idle: (t, k) => ({ headY: 2 + s(t * .8 + k) * 1.1, headRot: .07, tear: .12 * (.5 + .5 * s(t * 1.1 + k)) }) },
  cry: { eyeStyle: 'closed', mouth: 'open', face: { tear: 1, mouthOpen: .6, brow: .9, ears: .7 }, take: .8,
    idle: (t, k) => ({ headRot: s(t * 14 + k) * .025, headY: 1.5 + s(t * 7 + k) * 1.2, mouthOpen: .1 * s(t * 7) }) },
  sleepy: { eyeStyle: 'sleepy', mouth: 'w', face: { lid: .35, eyes: .75, mouthCurve: .6, ears: .35, lookY: .3 }, take: .1,
    idle: (t, k) => ({ headY: 1.5 + s(t * .7 + k) * 1.5, eyes: -.25 * Math.max(0, s(t * .5 + k)) }) },
  bored: { eyeStyle: 'sleepy', mouth: 'w', face: { lid: .4, lidTilt: .1, mouthCurve: .1, ears: .3, lookY: -.3, browLift: -.2 }, emote: 'dots', take: .25,
    idle: (t, k) => ({ lookX: s(t * .6 + k) * .7, headRot: s(t * .5 + k) * .03 }) },
  annoyed: { eyeStyle: 'open', mouth: 'flat', face: { lid: .35, lidTilt: .8, brow: -.8, ears: .8, pupil: .85 }, take: .5,
    idle: (t, k) => ({ earTwitch: Math.max(0, s(t * 2.6 + k) - .8) * 4 }) },
  angry: { eyeStyle: 'open', mouth: 'open', face: { lid: .45, lidTilt: 1, brow: -1, pupil: .7, ears: 1, mouthOpen: .35 }, emote: 'anger', take: 1,
    idle: (t, k) => ({ headX: s(t * 22 + k) * .4, headRot: s(t * 27 + k) * .01 }) },
  shy: { eyeStyle: 'open', mouth: 'w', face: { lookY: .5, blush: .9, mouthCurve: .6, ears: .35, browLift: .2, lid: .15 }, take: .35,
    idle: (t, k) => ({ lookX: s(t * .7 + k) * .8, headRot: .05 + s(t * .6 + k) * .02 }) },
  hungry: { eyeStyle: 'wide', mouth: 'w', face: { pupil: 1.45, brow: .7, browLift: .5, mouthCurve: .35, ears: .3 }, take: .4,
    idle: (t, k) => ({ headRot: s(t * 1.4 + k) * .03, mouthOpen: Math.max(0, s(t * .8 + k) - .9) * 2 }) },
  determined: { eyeStyle: 'open', mouth: 'flat', face: { lid: .28, lidTilt: .6, brow: -.5, mouthCurve: .35, ears: .15, pupil: .9 }, take: .5 },
  relieved: { eyeStyle: 'happy', mouth: 'smile', face: { ears: .3, browLift: .4, blush: .2, mouthCurve: 1.1 }, emote: 'sweat', take: .5,
    idle: (t, k) => ({ headY: 1 + s(t * 1.1 + k) * .8 }) },
  // Cool and relaxed (a parachute ride taken easy).
  chill: { eyeStyle: 'sleepy', mouth: 'smile', face: { lid: .2, browAsym: .5, mouthCurve: .9, ears: .2 }, take: .2,
    idle: (t, k) => ({ headRot: s(t * .8 + k) * .03 }) },
};

/** What the layer needs to remember between frames. */
export interface EmotionState {
  id: EmotionId; from: EmotionId;
  /** Time (the world's clock, seconds) it changed into `id`. */
  since: number;
  /** The face numbers at the moment of the change, and the ones shown now, so a change in the middle of another one does not jump. */
  fromFace: FaceNumbers; now: FaceNumbers;
}
export const newEmotion = (id: EmotionId = 'neutral'): EmotionState => ({ id, from: id, since: -999, fromFace: faceOf(id), now: faceOf(id) });
export const faceOf = (id: EmotionId): FaceNumbers => ({ ...NEUTRAL_FACE, ...EMOTIONS[id].face });

/** Changes into another emotion; false when it already is that one. */
export function changeEmotion(st: EmotionState, id: EmotionId, time: number): boolean {
  if (st.id === id) return false;
  st.from = st.id; st.fromFace = { ...st.now }; st.id = id; st.since = time;
  return true;
}

/** When the eyes are fully shut and the eye and mouth shapes change, and how long the blink back open takes. */
export const SWAP = .09, REOPEN = .13;
/** A damped spring from 0 to 1 over about half a second, overshooting by ~9%. */
export const settle = (x: number) => x <= 0 ? 0 : 1 - Math.exp(-6 * x) * Math.cos(8 * x);

/**
 * The face for this moment: `base` (the clip's pose) with the emotion on top.
 * `ownsFace`: the clip decides the eye and mouth shapes (sleeping, chewing, a yawn…); only the numbers are added then.
 */
export function emotionFace(base: Pose, st: EmotionState, time: number, seed: number, ownsFace: boolean): Pose {
  const age = time - st.since, cur = EMOTIONS[st.id], prev = EMOTIONS[st.from], target = faceOf(st.id);
  const changing = st.from !== st.id && age < 1;
  // The numbers flow from where they were to the new values, starting a moment before the lids are shut.
  const k = changing ? settle((age - SWAP * .4) / .5) : 1;
  const face = {} as FaceNumbers;
  for (const key of FACE_KEYS) face[key] = lerp(st.fromFace[key], target[key], k);
  st.now = face;
  // The eyes shut as in a blink while the shapes change.
  const dip = !changing ? 0 : age < SWAP ? smooth(age / SWAP) : 1 - smooth((age - SWAP) / REOPEN);
  const shapes = age >= SWAP || !changing ? cur : prev;
  // The reaction: the head pops and the ear flicks, biggest just as the eyes open.
  const bump = changing ? Math.sin(clamp((age - SWAP) / .32, 0, 1) * Math.PI) * cur.take : 0;
  const idleK = smooth((age - .35) / .5), extra = cur.idle && idleK > 0 ? cur.idle(time, seed) : undefined;
  const out: Pose = { ...base };
  if (!ownsFace) { out.eyeStyle = shapes.eyeStyle; out.mouth = shapes.mouth; }
  out.eyes = base.eyes * face.eyes * (1 - .9 * dip);
  out.lid = Math.max(base.lid, face.lid); out.lidTilt = base.lidTilt || face.lidTilt; out.pupil = base.pupil * face.pupil;
  out.browLift = base.browLift + face.browLift; out.browAsym = base.browAsym + face.browAsym; out.tear = Math.max(base.tear, face.tear);
  out.brow = Math.abs(base.brow) > .05 ? base.brow : face.brow;
  out.mouthCurve = base.mouthCurve * (face.mouthCurve);
  out.mouthOpen = Math.max(base.mouthOpen, ownsFace ? 0 : face.mouthOpen);
  out.ears = Math.max(base.ears, face.ears); out.blush = Math.max(base.blush, face.blush);
  out.lookY = Math.abs(base.lookY) > .05 ? base.lookY : face.lookY;
  if (bump > 0) { out.headScale = base.headScale * (1 + .07 * bump); out.headY = base.headY - 3 * bump; out.earTwitch = Math.max(base.earTwitch, bump * .9); }
  if (extra) for (const key of Object.keys(extra) as (keyof Pose)[]) {
    const v = extra[key];
    if (typeof v === 'number') (out as unknown as Record<string, number>)[key] = (out[key] as number) + v * idleK;
  }
  return out;
}

// ———————————————————————————————————————— the mini-games

const playStates = new Map<string, EmotionState>();
/**
 * For the mini-games (the beach games, the café, the kitchen), which draw their cat straight from a clip and have no `World.animate`
 *: the face for `emotion`, changed through the same blink, with the state kept per `key` (the game and the cat).
 * `time` is the game's own clock; when it starts over (a new round) the cat simply starts on its emotion, without a blink.
 */
export function playFace(key: string, emotion: EmotionId, pose: Pose, time: number, seed: number): Pose {
  let st = playStates.get(key);
  if (!st || time < st.since) { st = newEmotion(emotion); playStates.set(key, st); }
  else if (st.id !== emotion && time - st.since >= .6) changeEmotion(st, emotion, time);
  return emotionFace(pose, st, time, seed, pose.eyeStyle !== 'open' || pose.mouth !== 'w');
}
