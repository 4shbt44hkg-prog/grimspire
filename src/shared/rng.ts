// Seeded RNG (mulberry32) — identical results on client and server for map gen.
export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const ri = (r: RNG, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
export const rf = (r: RNG, min: number, max: number) => min + r() * (max - min);
export const pick = <T>(r: RNG, arr: T[]): T => arr[Math.floor(r() * arr.length)];
export const chance = (r: RNG, p: number) => r() < p;

let idCounter = 0;
export function uid(prefix = "i"): string {
  return `${prefix}${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
