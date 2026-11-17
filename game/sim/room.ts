/**
 * The one room (R1): a Halloween living room, 2000 × 1150 world units. The back wall ends at
 * FLOOR_TOP; the floor is the walkable band below it. No doors.
 */
export const ROOM_W = 2000;
export const ROOM_H = 1150;
export const FLOOR_TOP = 540;
/** Where cats may stand (a little margin from the wall and the edges). */
export const WALK = { x0: 90, x1: ROOM_W - 90, y0: FLOOR_TOP + 50, y1: ROOM_H - 50 } as const;

export interface Pt { x: number; y: number }

export function clampToFloor(p: Pt): Pt {
  const x = Number.isFinite(p.x) ? p.x : ROOM_W / 2, y = Number.isFinite(p.y) ? p.y : (WALK.y0 + WALK.y1) / 2;
  return { x: Math.max(WALK.x0, Math.min(WALK.x1, x)), y: Math.max(WALK.y0, Math.min(WALK.y1, y)) };
}
export const onFloor = (p: Pt) => p.x >= WALK.x0 && p.x <= WALK.x1 && p.y >= WALK.y0 && p.y <= WALK.y1;

/** A random floor point from a 0..1 random source. */
export const randomFloorPoint = (rand: () => number): Pt => ({ x: WALK.x0 + rand() * (WALK.x1 - WALK.x0), y: WALK.y0 + rand() * (WALK.y1 - WALK.y0) });

/** The sofa seat, a place to sit up off the floor. */
export const SOFA = { x0: 190, x1: 520, y: FLOOR_TOP + 46, z: 62 } as const;
/** Where the barbell set happens (in front of the fireplace). */
export const GYM_SPOT: Pt = { x: 1030, y: FLOOR_TOP + 300 };
