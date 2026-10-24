/** Shared, mutable scroll/pointer state read by the 3D rig every frame (kept outside React so scrolling never re-renders). */
export const cosmos = { zf: 0, sz: 0, mx: 0, my: 0 };
export const ZONES = 6;
export const GAP = 46;
export const zoneZ = (i: number) => -i * GAP;
