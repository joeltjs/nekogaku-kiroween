/**
 * What a cat looks like: coat colours and the shape "genes" that make each face and body
 * different, plus how age (from level) and weight change them.
 */
export const INK = '#211c1c';

/** NekoGaku Kiroween edition: only the three house cats. */
export type CatId = 'cecil' | 'kuku' | 'bolu';
export const CAT_IDS: readonly CatId[] = ['cecil', 'kuku', 'bolu'];
export const isCatId = (v: unknown): v is CatId => CAT_IDS.includes(v as CatId);

/** Body patch: u runs hip(0) → shoulder(1); v runs back(-1) → belly(1). Sizes are fractions of the body. */
export interface BodyPatch { u: number; v: number; ru: number; rv: number; color: string }
/** Head patch in head units: x, y in −1..1 of the half width/height. */
export interface HeadPatch { x: number; y: number; rx: number; ry: number; color: string; rot?: number }

export type EyeShape = 'dot' | 'round' | 'almond' | 'sleepy';
export type Pattern = 'solid' | 'tabby' | 'bicolor' | 'tuxedo' | 'calico' | 'patched' | 'pointed';

export interface CatLook {
  pattern: Pattern;
  base: string; belly?: string; muzzle?: string; socks?: string; chest?: string;
  /** The front legs' colour when they differ from the chest (Mochi: black legs under a white bib). */
  legs?: string;
  bodyPatches: BodyPatch[]; headPatches: HeadPatch[];
  stripes?: string; earLeft?: string; earRight?: string;
  tail: string; tailTip?: string; tailRings?: string;
  nose: string; eyeColor?: string; eyeShape: EyeShape; blush?: string;
  /** Lashes at the outer corners: the queens' prettier face. */
  lashes?: boolean;
  /** How big and round the pupil of a coloured eye is. */
  pupil?: number;
  /** Shape genes; 1 is the the reference style average. */
  headW: number; headH: number; earSize: number; earRound: number; earFold: boolean; earSpread: number;
  eyeSize: number; eyeGap: number; eyeY: number; muzzleSize: number; cheek: number;
  longHair: boolean; bodyLen: number; legLen: number; tailLen: number; tailFluff: number;
  /** Collar colour (and dots on it); a gold name tag hangs from it. No cat wears one at the moment. */
  collar?: string; collarDots?: string;
  /** Marks drawn over the muzzle (a "moustache" spot, a cheek spot). */
  faceMarks?: HeadPatch[];
  /** From teen age on: heavy-lidded eyes and a downturned mouth, whatever the mood. */
  grumpy?: boolean;
  /** Tabby lines only on the head (the body is another colour). */
  stripesHeadOnly?: boolean;
  /** A soft fur pattern on the back that looks like a smiling face (two spots and a smile). */
  backSmile?: string;
  /** The customiser choices that made this look (the box cat only). */
  custom?: Record<string, string>;
}

const base = (look: Partial<CatLook> & Pick<CatLook, 'base' | 'tail'>): CatLook => ({
  pattern: 'solid', bodyPatches: [], headPatches: [], nose: '#3a2a28', eyeShape: 'dot',
  headW: 1, headH: 1, earSize: 1, earRound: .2, earFold: false, earSpread: 1, eyeSize: 1, eyeGap: 1, eyeY: 0, muzzleSize: 1, cheek: 0,
  longHair: false, bodyLen: 1, legLen: 1, tailLen: 1, tailFluff: 0, ...look,
});

const WHITE = '#f7f0e3';
export const LOOKS: Record<CatId, CatLook> = {
  // Mostly white: a grey-brown tabby cap over the head down to the eyes (white muzzle and blaze),
  // one small round grey patch on the back, a dark-grey-and-white ringed tail. From teen age on
  // the face is "jutek": heavy-lidded eyes and a downturned mouth, whatever the mood.
  cecil: base({ pattern: 'patched', base: WHITE, tail: WHITE, tailRings: '#5d5852', tailTip: '#5d5852', stripes: '#6e6152', stripesHeadOnly: true,
    headPatches: [{ x: 0, y: -.42, rx: 1.02, ry: .66, color: '#a39380' }, { x: 0, y: .12, rx: .16, ry: .3, color: WHITE }], earLeft: '#a39380', earRight: '#a39380',
    bodyPatches: [{ u: .5, v: -.86, ru: .15, rv: .36, color: '#a39380' }], muzzle: WHITE,
    eyeColor: '#b5b24e', eyeShape: 'round', grumpy: true, earRound: .2 }),

  // Calico: white with orange and black; the biggest eyes of all, at every age.
  kuku: base({ pattern: 'calico', base: '#fbf6ec', tail: '#e8973e', tailRings: '#3c3436',
    bodyPatches: [{ u: .3, v: -.75, ru: .36, rv: .6, color: '#e8973e' }, { u: .74, v: -.7, ru: .22, rv: .5, color: '#3c3436' }, { u: .04, v: -.3, ru: .18, rv: .5, color: '#3c3436' }],
    headPatches: [{ x: -.64, y: -.42, rx: .5, ry: .58, color: '#e8973e' }, { x: .64, y: -.42, rx: .48, ry: .58, color: '#e8973e' }, { x: -.8, y: -.5, rx: .14, ry: .07, color: '#3c3436', rot: .7 }],
    earLeft: '#e8973e', earRight: '#e8973e', eyeColor: '#e9a83a', eyeShape: 'round', eyeSize: 1.42, headW: .96, earSize: 1.08, earRound: 0, lashes: true, blush: '#f6a8b4', muzzleSize: .9 }),

  // Golden-brown tabby, bold stripes.
  bolu: base({ pattern: 'tabby', base: '#c98a4c', belly: '#e6c08c', muzzle: '#ecd0a2', stripes: '#8a5a2f', tail: '#c98a4c', tailRings: '#8a5a2f', eyeColor: '#a9b49a', eyeShape: 'round', eyeSize: 1.15,
    blush: '#f2ab8f', headW: 1.1, headH: 1.05, earSize: .9, earRound: .5, legLen: .9 }),
};
// The queens' lashes.
for (const id of CAT_IDS) LOOKS[id] = { ...LOOKS[id], lashes: true };

export type CatAge = 'kitten' | 'teen' | 'adult' | 'senior';
export type CatBuild = 'skinny' | 'thin' | 'medium' | 'chubby' | 'obese';
export const AGE_LABELS: Record<CatAge, string> = { kitten: 'Kitten', teen: 'Teen', adult: 'Adult', senior: 'Senior' };
export const BUILD_LABELS: Record<CatBuild, string> = { skinny: 'Very thin', thin: 'Thin', medium: 'Ideal', chubby: 'Chubby', obese: 'Very chubby' };

/** Levels 1–15 double as age. */
export function ageOf(level: number): CatAge { return level <= 3 ? 'kitten' : level <= 6 ? 'teen' : level <= 11 ? 'adult' : 'senior'; }
/** Healthy weight for the age, in kilograms. */
export function idealWeight(level: number) { return level <= 3 ? 1.4 + level * .7 : level <= 6 ? 3.2 + (level - 3) * .35 : 4.4; }
export function buildOf(weight: number, level: number): CatBuild {
  const r = weight / idealWeight(level);
  return r < .72 ? 'skinny' : r < .88 ? 'thin' : r < 1.16 ? 'medium' : r < 1.38 ? 'chubby' : 'obese';
}

/** Everything the rig needs about body proportions, already blended from look, age and weight. */
export interface Physique {
  scale: number; head: number; headRound: number; eye: number; eyeY: number; eyeShine: number;
  leg: number; bodyLen: number; body: number; belly: number; fluff: number; senior: number; kitten: number; ear: number; muzzle: number;
  /** 0..1, peaks at level 5: the lanky young cat (long legs, slim body, big ears). */
  teen: number;
  /** 0..1: how underweight the cat is (hunched back, tucked belly, ribs, thin legs, sad face). */
  thin: number;
  /**
   * How much leg shows under a cat on all fours (the side rig), 0..1 of the pose's gap. the reference style stand on short stubs, about
   * 0.14 of their height: 0.3 of the gap for a grown cat. `leg` keeps the old meaning
   * (reach of a raised paw, the sitting body's height).
   */
  stance: number;
}

export function physique(look: CatLook, level: number, weight: number): Physique {
  // Smooth growth across levels instead of four hard steps.
  const grow = Math.min(1, Math.max(0, (level - 1) / 6));
  // Life stages blend into each other: kitten (1–3), lanky teen (4–6), adult, senior (12–15).
  const kitten = 1 - Math.min(1, Math.max(0, (level - 1) / 4));
  const teen = Math.max(0, 1 - Math.abs(level - 5) / 2.5);
  const senior = Math.min(1, Math.max(0, (level - 11) / 4));
  const ratio = weight / idealWeight(level);
  // A kitten's build shows softly: a chubby kitten is a little rounder, not a hanging belly; a thin
  // one a little slimmer, not lanky like a teen.
  const soft = 1 - kitten * .6;
  const fat = Math.max(-.45, Math.min(1.25, ratio - 1)) * 1.6 * soft;
  const thin = Math.max(0, Math.min(1, (.95 - ratio) / .35)) * soft;
  return {
    scale: (.52 + .48 * grow) * (1 - senior * .02),
    // Head about 1.15× the torso's width, like the reference style. Kittens: a little rounder, not bigger.
    // Short-haired kittens have a narrower face (fluffy Angora kittens stay round).
    // Heads a little smaller than before, a kitten's smallest in proportion too.
    head: .82 * (1 - teen * .03) * (1 - (look.longHair ? 0 : kitten * .08)) * look.headW * (1 + Math.max(0, fat) * .05) * (1 - thin * .06) * (1 - senior * .02),
    headRound: (look.headH / look.headW) * (1 + kitten * .08 - teen * .03) * (1 + (look.longHair ? 0 : kitten * .06)) + Math.max(0, fat) * .04 + thin * .06,
    // A kitten's eyes are bigger; growing up does not dull them, only old age a little.
    eye: look.eyeSize * (1 + kitten * .34 + teen * .05) * (1 - senior * .08),
    eyeY: look.eyeY + kitten * .1,
    eyeShine: kitten,
    leg: .8 * look.legLen * (1 - kitten * .38 + teen * .14) * (1 - Math.max(0, fat) * .12) * (1 - senior * .06),
    // Torso: a round little bean for kittens, long and slim for teens, solid for adults.
    bodyLen: 1.0 * look.bodyLen * (1 - kitten * .12 + teen * .06) * (1 + senior * .03),
    // A kitten is small, not round.
    body: Math.max(.62, 1 + fat * .42 - kitten * .14 - teen * .09 + senior * .05 - thin * .12),
    belly: Math.max(0, fat) * 10 * (1 - kitten * .7) + senior * 5,
    fluff: Math.max(0, (look.longHair ? .75 : 0) + Math.max(0, fat - .2) * .7 + kitten * (look.longHair ? .3 : .06) - thin * .4),
    senior, kitten, teen,
    // Teens grow into their big ears; seniors' ears soften.
    ear: look.earSize * (1 + kitten * .12 + teen * .14) * (1 - senior * .05),
    muzzle: look.muzzleSize * (1 - kitten * .24 + (1 - kitten) * (1 - teen) * .05),
    thin,
    // the reference style stubs at every age: a kitten's a little shorter still, the lanky teen's a little longer, a fat cat's sink into the body.
    //.3 left the legs at.151 of the height; the reference style's are.14.
    stance: .18 * look.legLen * (1 - kitten * .2 + teen * .16) * (1 - Math.max(0, fat) * .14) * (1 - senior * .06),
  };
}

export function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
}
export function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k)), g = Math.min(255, Math.round(((n >> 8) & 255) * k)), b = Math.min(255, Math.round((n & 255) * k));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
