// Seeded dungeon generation — the same seed yields the same map on the
// server and every client, so only the seed travels over the network.

import { mulberry32, ri, chance, type RNG } from "./rng";
import { T_FLOOR, T_VOID, T_WALL, type GameMap, type MapObject } from "./types";

// Outdoor zones: open terrain through rotating biomes. A winding protected
// trail runs from the entry portal to the rift portal at the far end, with
// obstacle thickets (trees/rocks) scattered everywhere else and a waypoint
// mid-zone. Same seed → same zone on server and every client.
export function generateMap(seed: number, depth: number): GameMap {
  if (depth === 0) return generateTown();
  const r = mulberry32((seed ^ (depth * 0x9e3779b9)) >>> 0);
  const w = 72, h = 72;
  const tiles = new Uint8Array(w * h);
  const variant = new Uint8Array(w * h);
  const idx = (x: number, y: number) => y * w + x;

  // open field inside a noisy dense-forest border
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const band = 2 + ((x * 7 + y * 13 + depth * 5) % 3);
      tiles[idx(x, y)] = edge < band ? T_WALL : T_FLOOR;
      variant[idx(x, y)] = ri(r, 0, 255);
    }

  // winding trail from SW to NE, protected from obstacles
  const protectedT = new Uint8Array(w * h);
  const entry = { x: ri(r, 7, 12), y: ri(r, h - 13, h - 8) };
  const exit = { x: ri(r, w - 13, w - 8), y: ri(r, 7, 12) };
  const trail: { x: number; y: number }[] = [];
  let tx = entry.x, ty = entry.y;
  let guard = 0;
  while ((tx !== exit.x || ty !== exit.y) && guard++ < 4000) {
    trail.push({ x: tx, y: ty });
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = tx + dx, ny = ty + dy;
        if (nx > 1 && ny > 1 && nx < w - 2 && ny < h - 2) {
          protectedT[idx(nx, ny)] = 1;
          if (tiles[idx(nx, ny)] === T_WALL && Math.abs(dx) < 2 && Math.abs(dy) < 2) tiles[idx(nx, ny)] = T_FLOOR;
        }
      }
    // drunkard's walk biased toward the exit
    if (chance(r, 0.62)) {
      if (chance(r, Math.abs(exit.x - tx) / (Math.abs(exit.x - tx) + Math.abs(exit.y - ty) + 0.01))) tx += Math.sign(exit.x - tx);
      else ty += Math.sign(exit.y - ty);
    } else {
      if (chance(r, 0.5)) tx += ri(r, -1, 1);
      else ty += ri(r, -1, 1);
      tx = Math.max(4, Math.min(w - 5, tx));
      ty = Math.max(4, Math.min(h - 5, ty));
    }
  }
  trail.push(exit);

  // obstacle thickets
  const nPatches = ri(r, 30, 42);
  for (let p = 0; p < nPatches; p++) {
    let px = ri(r, 4, w - 5), py = ri(r, 4, h - 5);
    const size = ri(r, 2, 8);
    for (let s = 0; s < size; s++) {
      if (!protectedT[idx(px, py)] && Math.hypot(px - entry.x, py - entry.y) > 6) tiles[idx(px, py)] = T_WALL;
      px = Math.max(3, Math.min(w - 4, px + ri(r, -1, 1)));
      py = Math.max(3, Math.min(h - 4, py + ri(r, -1, 1)));
    }
  }

  // objects along the trail
  const objects: MapObject[] = [];
  objects.push({ id: "up", type: "stairs_up", x: entry.x + 0.5, y: entry.y + 0.5 });
  objects.push({ id: "down", type: "stairs_down", x: exit.x + 0.5, y: exit.y + 0.5 });
  const mid = trail[Math.floor(trail.length / 2)] ?? entry;
  objects.push({ id: "wp", type: "waypoint", x: mid.x + 0.5, y: mid.y + 0.5 });

  let oid = 0;
  const freeSpot = (minDistFromEntry: number): { x: number; y: number } | null => {
    for (let a = 0; a < 60; a++) {
      const x = ri(r, 5, w - 6), y = ri(r, 5, h - 6);
      if (tiles[idx(x, y)] === T_FLOOR && Math.hypot(x - entry.x, y - entry.y) >= minDistFromEntry) return { x, y };
    }
    return null;
  };
  const nChests = ri(r, 2, 4);
  for (let i = 0; i < nChests; i++) {
    const s = freeSpot(12);
    if (s) objects.push({ id: `c${oid++}`, type: "chest", x: s.x + 0.5, y: s.y + 0.5 });
  }
  const nShrines = ri(r, 1, 2);
  for (let i = 0; i < nShrines; i++) {
    const s = freeSpot(10);
    if (s) objects.push({ id: `s${oid++}`, type: "shrine", x: s.x + 0.5, y: s.y + 0.5, shrineKind: ["battle", "arcane", "swift", "gilded"][ri(r, 0, 3)] });
  }
  // braziers along the trail light the way
  const nBraziers = ri(r, 5, 8);
  for (let i = 0; i < nBraziers; i++) {
    const t = trail[ri(r, 0, trail.length - 1)];
    objects.push({ id: `t${oid++}`, type: "torch", x: t.x + 1.5, y: t.y + 0.5 });
  }

  // monster packs
  const packs: { x: number; y: number; count: number }[] = [];
  const nPacks = ri(r, 10, 14);
  for (let i = 0; i < nPacks; i++) {
    const s = freeSpot(14);
    if (s) packs.push({ x: s.x + 0.5, y: s.y + 0.5, count: ri(r, 2, 4) + Math.min(8, Math.floor(depth * 0.8)) });
  }

  return {
    w, h, tiles, variant, objects,
    spawnX: entry.x + 0.5, spawnY: entry.y + 0.5,
    packs, theme: (depth - 1) % 4,
  };
}

function generateTown(): GameMap {
  const w = 26, h = 26;
  const tiles = new Uint8Array(w * h);
  const variant = new Uint8Array(w * h);
  const r = mulberry32(1337);
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) tiles[y * w + x] = T_FLOOR;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (tiles[y * w + x] === T_VOID) {
        let adj = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && tiles[ny * w + nx] === T_FLOOR) adj = true;
        }
        if (adj) tiles[y * w + x] = T_WALL;
      }
      variant[y * w + x] = ri(r, 0, 255);
    }

  const objects: MapObject[] = [
    { id: "stash", type: "stash", x: 8.5, y: 7.5 },
    { id: "well", type: "well", x: 13.5, y: 7.5 },
    { id: "wp", type: "waypoint", x: 18.5, y: 7.5 },
    { id: "vendor", type: "vendor", x: 7.5, y: 13.5 },
    { id: "gambler", type: "gambler", x: 19.5, y: 13.5 },
    { id: "down", type: "stairs_down", x: 13.5, y: 20.5 },
    { id: "t1", type: "torch", x: 5.5, y: 5.5 },
    { id: "t2", type: "torch", x: 20.5, y: 5.5 },
    { id: "t3", type: "torch", x: 5.5, y: 18.5 },
    { id: "t4", type: "torch", x: 20.5, y: 18.5 },
  ];
  return { w, h, tiles, variant, objects, spawnX: 13.5, spawnY: 13.5, packs: [], theme: 4 };
}

export function isWalkable(map: GameMap, x: number, y: number): boolean {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return false;
  return map.tiles[ty * map.w + tx] === T_FLOOR;
}

// Circle-ish walkability for entity movement with wall sliding.
export function moveWithCollision(map: GameMap, x: number, y: number, dx: number, dy: number, radius = 0.3): [number, number] {
  let nx = x + dx, ny = y + dy;
  const ok = (px: number, py: number) =>
    isWalkable(map, px - radius, py - radius) && isWalkable(map, px + radius, py - radius) &&
    isWalkable(map, px - radius, py + radius) && isWalkable(map, px + radius, py + radius);
  if (ok(nx, ny)) return [nx, ny];
  if (ok(nx, y)) return [nx, y];
  if (ok(x, ny)) return [x, ny];
  return [x, y];
}
