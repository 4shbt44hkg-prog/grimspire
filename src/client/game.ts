import { BASES, SKILLS, xpForLevel, MAX_DEPTH_NAME } from "../shared/gamedata";
import { allMods, baseOf, statTotal } from "../shared/items";
import { generateMap, moveWithCollision } from "../shared/mapgen";
import type { Ev } from "../shared/protocol";
import type { CombatStats, GameMap, GroundItem, Item, Mod, MonsterState, PlayerPub, ProjState, SentinelState, StatId } from "../shared/types";
import { SFX } from "./sound";

// Touch device? (localStorage override "grimspire_touch"="1"/"0" for testing)
export const IS_TOUCH: boolean = (() => {
  try {
    const o = localStorage.getItem("grimspire_touch");
    if (o === "1") return true;
    if (o === "0") return false;
    return (navigator.maxTouchPoints > 0 || "ontouchstart" in window) && matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
})();

// ---------------- Character (persisted) ----------------
export interface Placed {
  item: Item;
  x: number;
  y: number;
}

export interface Character {
  v: number;
  name: string;
  cls: "warlord" | "pyromancer";
  lvl: number;
  xp: number;
  statPts: number;
  skillPts: number;
  str: number; dex: number; vit: number; ene: number;
  skills: Record<string, number>;
  equip: Partial<Record<string, Item>>; // weapon offhand helm body gloves boots belt ring1 ring2 amulet
  inv: Placed[];
  stash: Placed[];
  cube: Placed[];
  belt: (Item | null)[];
  gold: number;
  maxDepth: number;
  skillAssign: string[];
}

export const INV_W = 15, INV_H = 8, STASH_W = 10, STASH_H = 8, CUBE_W = 4, CUBE_H = 3;

export function newCharacter(name: string, cls: "warlord" | "pyromancer"): Character {
  const c: Character = {
    v: 1, name, cls, lvl: 1, xp: 0, statPts: 0, skillPts: 0,
    str: cls === "warlord" ? 20 : 12, dex: 14, vit: cls === "warlord" ? 18 : 14, ene: cls === "warlord" ? 8 : 20,
    skills: {}, equip: {}, inv: [], stash: [], cube: [], belt: [null, null, null, null],
    gold: 0, maxDepth: 0, skillAssign: [],
  };
  const starterSkill = cls === "warlord" ? "bash" : "firebolt";
  const starterAoe = cls === "warlord" ? "sweep" : "firenova";
  c.skills[starterSkill] = 1;
  c.skills[starterAoe] = 1;
  c.skillAssign = [starterSkill, starterAoe];
  const weapon = { ...BASES[cls === "warlord" ? "shortsword" : "gnarledstaff"] };
  c.equip.weapon = { id: "start" + Math.random().toString(36).slice(2), base: weapon.id, rarity: "normal", name: weapon.name, ilvl: 1, mods: [], sockets: 0, socketed: [] };
  c.belt[0] = { id: "sp" + Math.random().toString(36).slice(2), base: "hp1", rarity: "normal", name: BASES.hp1.name, ilvl: 1, mods: [], sockets: 0, socketed: [], qty: 3 };
  c.belt[1] = { id: "sp2" + Math.random().toString(36).slice(2), base: "mp1", rarity: "normal", name: BASES.mp1.name, ilvl: 1, mods: [], sockets: 0, socketed: [], qty: 2 };
  return c;
}

// ---------------- Save / load ----------------
const SAVE_KEY = "grimspire_chars_v1";

export function loadChars(): Record<string, Character> {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveChar(c: Character) {
  const all = loadChars();
  all[c.name] = c;
  localStorage.setItem(SAVE_KEY, JSON.stringify(all));
}

export function deleteChar(name: string) {
  const all = loadChars();
  delete all[name];
  localStorage.setItem(SAVE_KEY, JSON.stringify(all));
}

// ---------------- Grid helpers ----------------
export function canPlace(list: Placed[], item: Item, x: number, y: number, gw: number, gh: number, ignore?: Placed): boolean {
  const b = BASES[item.base];
  if (x < 0 || y < 0 || x + b.w > gw || y + b.h > gh) return false;
  for (const p of list) {
    if (p === ignore) continue;
    const pb = BASES[p.item.base];
    if (x < p.x + pb.w && x + b.w > p.x && y < p.y + pb.h && y + b.h > p.y) return false;
  }
  return true;
}

export function itemAt(list: Placed[], x: number, y: number): Placed | null {
  for (const p of list) {
    const pb = BASES[p.item.base];
    if (x >= p.x && x < p.x + pb.w && y >= p.y && y < p.y + pb.h) return p;
  }
  return null;
}

export function findSpot(list: Placed[], item: Item, gw: number, gh: number): { x: number; y: number } | null {
  // try stacking first
  const b = BASES[item.base];
  if (b.stack) {
    for (const p of list) {
      if (p.item.base === item.base && (p.item.qty ?? 1) + (item.qty ?? 1) <= b.stack) return { x: -1, y: -1 }; // signal stack
    }
  }
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++)
      if (canPlace(list, item, x, y, gw, gh)) return { x, y };
  return null;
}

export function addToGrid(list: Placed[], item: Item, gw: number, gh: number): boolean {
  const b = BASES[item.base];
  if (b.stack) {
    for (const p of list) {
      if (p.item.base === item.base && (p.item.qty ?? 1) + (item.qty ?? 1) <= b.stack) {
        p.item.qty = (p.item.qty ?? 1) + (item.qty ?? 1);
        return true;
      }
    }
  }
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++)
      if (canPlace(list, item, x, y, gw, gh)) {
        list.push({ item, x, y });
        return true;
      }
  return false;
}

// ---------------- Derived stats ----------------
export interface Derived {
  maxLife: number; maxMana: number;
  minDmg: number; maxDmg: number;
  def: number;
  res: { fire: number; cold: number; light: number; pois: number };
  asPct: number; csPct: number; spellPct: number;
  moveSpeed: number;
  mf: number; goldPct: number;
  lifesteal: number; manasteal: number;
  regenLife: number; regenMana: number;
  eleDmg: { fire: number; cold: number; light: number; pois: number };
  skillLvls: Record<string, number>;
  attackRate: number; castRate: number;
  allSkills: number;
}

export function computeDerived(c: Character, buffs: Buff[]): Derived {
  const mods: Mod[] = [];
  let wepMin = 1, wepMax = 3, defBase = 0;
  const setCounts: Record<string, number> = {};
  for (const key of Object.keys(c.equip)) {
    const it = c.equip[key];
    if (!it) continue;
    const b = baseOf(it);
    mods.push(...allMods(it));
    if (key === "weapon" && b.dmg) { wepMin = b.dmg[0]; wepMax = b.dmg[1]; }
    if (b.def) defBase += b.def;
    if (b.caster) mods.push({ stat: "spell_pct", v: 8 + b.tier * 7 });
    if (it.setId) setCounts[it.setId] = (setCounts[it.setId] ?? 0) + 1;
  }
  // set bonuses
  for (const sid of Object.keys(setCounts)) {
    const n = setCounts[sid];
    const set = SETS_BY_ID[sid];
    if (set) for (let k = 0; k + 2 <= n; k++) mods.push(...set.bonuses[k] ?? []);
  }
  for (const b of buffs) mods.push(...b.mods);
  // passives
  for (const sid of Object.keys(c.skills)) {
    const sk = SKILLS[sid];
    if (sk?.kind === "passive" && c.skills[sid] > 0) {
      mods.push({ stat: sk.passive!.stat, v: sk.passive!.v + sk.passive!.perLvl * (c.skills[sid] - 1) });
    }
  }

  const t = (s: StatId) => statTotal(mods, s);
  const str = c.str + t("str"), dex = c.dex + t("dex"), vit = c.vit + t("vit"), ene = c.ene + t("ene");
  const ed = t("dmg_pct") + str * 0.75;
  const minDmg = Math.max(1, Math.round(wepMin * (1 + ed / 100) + t("dmg_min")));
  const maxDmg = Math.max(minDmg, Math.round(wepMax * (1 + ed / 100) + t("dmg_max")));
  const allSkills = t("skill_lvl");
  const skillLvls: Record<string, number> = {};
  for (const sid of Object.keys(c.skills)) if (c.skills[sid] > 0) skillLvls[sid] = c.skills[sid] + allSkills;
  const resAll = t("res_all");
  const cap = (x: number) => Math.min(75, x);
  return {
    maxLife: Math.round(38 + c.lvl * 2.2 + vit * 3 + t("life")),
    maxMana: Math.round(18 + c.lvl * 1.2 + ene * 2 + t("mana")),
    minDmg, maxDmg,
    def: Math.round((defBase + t("def")) * (1 + t("def_pct") / 100) + dex * 0.25),
    res: { fire: cap(t("res_fire") + resAll), cold: cap(t("res_cold") + resAll), light: cap(t("res_light") + resAll), pois: cap(t("res_pois") + resAll) },
    asPct: t("as_pct"), csPct: t("cs_pct"), spellPct: t("spell_pct") + ene * 0.4,
    moveSpeed: 5.2 * (1 + t("move_pct") / 100),
    mf: t("mf"), goldPct: t("gold_pct"),
    lifesteal: t("lifesteal"), manasteal: t("manasteal"),
    regenLife: t("regen_life"), regenMana: 1 + ene * 0.04 + t("regen_mana"),
    eleDmg: { fire: t("fire_dmg"), cold: t("cold_dmg"), light: t("light_dmg"), pois: t("pois_dmg") },
    skillLvls,
    attackRate: 1.35 * (1 + t("as_pct") / 100),
    castRate: 1.5 * (1 + t("cs_pct") / 100),
    allSkills,
  };
}

import { SETS } from "../shared/gamedata";
const SETS_BY_ID: Record<string, (typeof SETS)[number]> = {};
for (const s of SETS) SETS_BY_ID[s.id] = s;

export function toCombatStats(c: Character, d: Derived): CombatStats {
  return {
    lvl: c.lvl, minDmg: d.minDmg, maxDmg: d.maxDmg, eleDmg: d.eleDmg,
    asPct: d.asPct, csPct: d.csPct, spellPct: d.spellPct,
    lifesteal: d.lifesteal, manasteal: d.manasteal, mf: d.mf, goldPct: d.goldPct,
    def: d.def, res: d.res, maxLife: d.maxLife, skillLvls: d.skillLvls,
  };
}

// ---------------- Buffs ----------------
export interface Buff {
  id: string;
  name: string;
  mods: Mod[];
  until: number;
}

// ---------------- FX ----------------
export interface FX {
  type: string;
  x: number; y: number;
  t: number; dur: number;
  r?: number;
  ele?: string;
  ang?: number;
}

export interface DmgNum {
  x: number; y: number;
  amt: string;
  color: string;
  t: number;
}

// ---------------- Global game state ----------------
interface Lerped<T> {
  cur: T;
  px: number; py: number;   // previous position for interpolation
  tx: number; ty: number;   // target (latest snapshot)
  snapAt: number;
}

export const G = {
  connected: false,
  playerId: "",
  roomCode: "",
  seed: 0,
  char: null as Character | null,
  derived: null as Derived | null,
  life: 50, mana: 20,
  healPool: 0, manaPool: 0,
  depth: 0,
  map: null as GameMap | null,
  moveTarget: null as { x: number; y: number } | null,
  pendingPickup: null as string | null,
  pendingObj: null as string | null,
  x: 13.5, y: 13.5, dir: 1, anim: "idle",
  players: new Map<string, Lerped<PlayerPub>>(),
  monsters: new Map<string, Lerped<MonsterState>>(),
  projs: new Map<string, Lerped<ProjState>>(),
  groundItems: new Map<string, GroundItem>(),
  sentinels: new Map<string, SentinelState>(),
  usedObjects: new Set<string>(),
  spinUntil: 0,
  chillUntil: 0,
  dustT: 0,
  autoPicked: new Set<string>(),
  fx: [] as FX[],
  dmgNums: [] as DmgNum[],
  buffs: [] as Buff[],
  cooldowns: {} as Record<string, number>,
  attackCd: 0,
  castAnimT: 0,
  heldItem: null as Item | null,
  dead: false,
  returnDepth: 1,
  now: 0,
  camX: 0, camY: 0,
  shake: 0,
  labelRects: [] as { gid: string; x: number; y: number; w: number; h: number }[],
  objRects: [] as { id: string; x: number; y: number; w: number; h: number; type: string }[],
  monRects: [] as { id: string; x: number; y: number; w: number; h: number }[],
  hoverMonster: null as string | null,
  hoverObj: null as string | null,
  send: (_msg: unknown) => { /* replaced by net */ },
  onStateChange: () => { /* replaced by ui */ },
  toast: (_m: string, _c?: string) => { /* replaced by ui */ },
  statsDirty: true,
  lastStatSync: 0,
  lastPosSync: 0,
  saveTimer: 0,
};

export function currentSkill(): string {
  const c = G.char!;
  const sel = c.skillAssign[selIdx] ?? null;
  return sel && (c.skills[sel] ?? 0) > 0 ? sel : c.cls === "warlord" ? "basic" : "basic_bolt";
}
export let selIdx = 0;
export function setSelIdx(i: number) { selIdx = i; }

export function markStatsDirty() {
  G.statsDirty = true;
  if (G.char && G.derived) {
    const d = computeDerived(G.char, G.buffs);
    G.derived = d;
    G.life = Math.min(G.life, d.maxLife);
    G.mana = Math.min(G.mana, d.maxMana);
  }
  G.onStateChange();
}

export function setDepth(d: number, spawnAt?: "up" | "down") {
  G.depth = d;
  G.map = generateMap(G.seed, d);
  const obj = G.map.objects.find((o) => (spawnAt === "down" ? o.type === "stairs_down" : o.type === "stairs_up"));
  if (spawnAt && obj) {
    G.x = obj.x; G.y = obj.y + 0.8;
  } else {
    G.x = G.map.spawnX; G.y = G.map.spawnY;
  }
  G.moveTarget = null;
  G.pendingPickup = null;
  G.monsters.clear();
  G.projs.clear();
  G.groundItems.clear();
  G.usedObjects.clear();
  G.autoPicked.clear();
  if (G.char && d > G.char.maxDepth) { G.char.maxDepth = d; saveChar(G.char); }
  document.getElementById("zonename")!.textContent = MAX_DEPTH_NAME(d) + (G.roomCode ? `   ·   game ${G.roomCode}` : "");
  sendPos(true);
}

export function sendPos(force = false) {
  if (!G.connected || !G.char) return;
  if (!force && G.now - G.lastPosSync < 0.1) return;
  G.lastPosSync = G.now;
  G.send({
    t: "pos", x: G.x, y: G.y, depth: G.depth, anim: G.anim, dir: G.dir,
    hpFrac: G.derived ? G.life / G.derived.maxLife : 1, lvl: G.char.lvl,
  });
}

export function syncStats(force = false) {
  if (!G.connected || !G.char || !G.derived) return;
  if (!force && !G.statsDirty && G.now - G.lastStatSync < 2) return;
  G.statsDirty = false;
  G.lastStatSync = G.now;
  G.send({ t: "stats", stats: toCombatStats(G.char, G.derived) });
}

// ---------------- Casting ----------------
export function tryCast(skillId: string, wx: number, wy: number, targetId?: string) {
  const c = G.char!, d = G.derived!;
  if (G.dead) return;
  const isBasic = skillId === "basic" || skillId === "basic_bolt";
  const sk = SKILLS[skillId];
  if (!isBasic && (!sk || (c.skills[skillId] ?? 0) <= 0)) return;
  if (G.attackCd > 0) return;
  const lvl = isBasic ? 1 : d.skillLvls[skillId] ?? 1;
  const mana = isBasic ? 0 : (sk.mana + (sk.manaPerLvl ?? 0) * (lvl - 1));
  if (G.mana < mana) { SFX.error(); return; }
  if (!isBasic && sk.cooldown && (G.cooldowns[skillId] ?? 0) > G.now) return;
  if (!isBasic && (sk.kind === "passive")) return;

  G.mana -= mana;
  if (!isBasic && sk.cooldown) G.cooldowns[skillId] = G.now + sk.cooldown;
  const isSpell = !isBasic && (sk.kind === "proj" || sk.kind === "blink" || ((sk.kind === "ground" || sk.kind === "nova") && !sk.wd));
  G.attackCd = 1 / (isSpell ? d.castRate : d.attackRate);
  G.castAnimT = 0.22;
  G.dir = wx < G.x ? -1 : 1;

  if (!isBasic && sk.kind === "blink") {
    // teleport client-side
    const dist = Math.hypot(wx - G.x, wy - G.y);
    const max = 9;
    let tx = wx, ty = wy;
    if (dist > max) { tx = G.x + ((wx - G.x) / dist) * max; ty = G.y + ((wy - G.y) / dist) * max; }
    if (G.map) {
      const [nx, ny] = moveWithCollision(G.map, tx, ty, 0, 0);
      if (nx === tx && ny === ty) { G.x = tx; G.y = ty; }
      else {
        // fallback: walk the line to the last walkable point
        const steps = 24;
        for (let i = steps; i >= 1; i--) {
          const px = G.x + (tx - G.x) * (i / steps), py = G.y + (ty - G.y) * (i / steps);
          const [ox, oy] = moveWithCollision(G.map, px, py, 0, 0);
          if (ox === px && oy === py) { G.x = px; G.y = py; break; }
        }
      }
    }
    G.fx.push({ type: "teleport", x: G.x, y: G.y, t: G.now, dur: 0.4 });
    SFX.teleport();
    G.moveTarget = null;
    sendPos(true);
    return;
  }
  if (!isBasic && sk.kind === "spin") {
    G.spinUntil = G.now + (sk.duration ?? 1.6);
    G.anim = "spin";
    SFX.swing();
    syncStats();
    G.send({ t: "cast", skill: skillId, x: G.x, y: G.y, tx: wx, ty: wy });
    return;
  }
  if (!isBasic && sk.kind === "summon") {
    SFX.shrine();
    syncStats();
    G.send({ t: "cast", skill: skillId, x: G.x, y: G.y, tx: wx, ty: wy });
    return;
  }
  if (!isBasic && sk.kind === "buff") {
    const b = sk.buff!;
    G.buffs = G.buffs.filter((x) => x.id !== skillId);
    G.buffs.push({ id: skillId, name: sk.name, mods: [{ stat: b.stat, v: b.v + b.perLvl * (lvl - 1) }], until: G.now + (sk.duration ?? 10) });
    markStatsDirty();
    syncStats(true);
    G.fx.push({ type: "warcry", x: G.x, y: G.y, t: G.now, dur: 0.5 });
    SFX.shrine();
    return;
  }

  // visual feedback immediately; server resolves damage
  if (isBasic && G.char!.cls === "warlord" || (!isBasic && sk.kind === "melee")) {
    G.fx.push({ type: "swing", x: G.x, y: G.y, t: G.now, dur: 0.18, ang: Math.atan2(wy - G.y, wx - G.x) });
    SFX.swing();
  } else {
    SFX.shoot();
  }
  syncStats();
  G.send({ t: "cast", skill: skillId, x: G.x, y: G.y, tx: wx, ty: wy, targetId });
}

// ---------------- Potions ----------------
export function drinkBelt(i: number) {
  const c = G.char!;
  const it = c.belt[i];
  if (!it) return;
  const b = BASES[it.base];
  if (b.potion?.hp) G.healPool += b.potion.hp;
  if (b.potion?.mp) G.manaPool += b.potion.mp;
  it.qty = (it.qty ?? 1) - 1;
  if (it.qty <= 0) c.belt[i] = null;
  SFX.potion();
  saveChar(c);
  G.onStateChange();
}

// ---------------- XP ----------------
export function gainXp(amt: number) {
  const c = G.char!;
  c.xp += amt;
  let leveled = false;
  while (c.xp >= xpForLevel(c.lvl + 1)) {
    c.lvl++;
    c.statPts += 5;
    c.skillPts += 1;
    leveled = true;
  }
  if (leveled) {
    markStatsDirty();
    G.life = G.derived!.maxLife;
    G.mana = G.derived!.maxMana;
    G.fx.push({ type: "levelup", x: G.x, y: G.y, t: G.now, dur: 1.2 });
    SFX.levelup();
    G.toast(`You are now level ${c.lvl}!`, "#e8c860");
    syncStats(true);
  }
  saveChar(c);
  G.onStateChange();
}

// ---------------- Server events ----------------
export function handleEvents(evs: Ev[]) {
  for (const e of evs) {
    switch (e.k) {
      case "dmg": {
        const m = G.monsters.get(e.id as string);
        if (m) {
          m.cur.hp = Math.max(0, m.cur.hp - (e.amt as number));
          const col = e.ele === "fire" ? "#ff9a3c" : e.ele === "cold" ? "#7ad8ff" : e.ele === "light" ? "#ffe97a" : e.ele === "pois" ? "#7ad87a" : "#fff";
          G.dmgNums.push({ x: m.tx, y: m.ty, amt: String(e.amt), color: col, t: G.now });
          SFX.hit();
        }
        break;
      }
      case "die": {
        const m = G.monsters.get(e.id as string);
        const mx = (e.x as number) ?? m?.tx ?? G.x;
        const my = (e.y as number) ?? m?.ty ?? G.y;
        if (Math.hypot(mx - G.x, my - G.y) < 26) gainXp(e.xp as number);
        G.fx.push({ type: "death", x: mx, y: my, t: G.now, dur: 0.5 });
        if (e.boss) { G.toast("The Gravelord has fallen!", "#b8860b"); G.shake = 0.5; }
        G.monsters.delete(e.id as string);
        SFX.die();
        break;
      }
      case "drop": {
        G.fx.push({ type: "dropflash", x: e.x as number, y: e.y as number, t: G.now, dur: 0.4 });
        break;
      }
      case "phit": {
        if (G.dead) break;
        G.life -= e.amt as number;
        G.shake = Math.min(0.35, 0.1 + (e.amt as number) / 120);
        if (e.chill) {
          G.chillUntil = Math.max(G.chillUntil, G.now + (e.chill as number));
          G.toast("Chilled!", "#7ad8ff");
        }
        SFX.hurt();
        if (G.life <= 0) {
          G.life = 0;
          die();
        }
        G.onStateChange();
        break;
      }
      case "fx": {
        if (e.fx === "nova") { G.fx.push({ type: "nova", x: e.x as number, y: e.y as number, t: G.now, dur: 0.5, r: e.r as number, ele: e.ele as string }); SFX.nova(); }
        else if (e.fx === "boom") { G.fx.push({ type: "boom", x: e.x as number, y: e.y as number, t: G.now, dur: 0.5, r: (e.r as number) || 1 }); SFX.boom(); G.shake = Math.max(G.shake, 0.18); }
        else if (e.fx === "meteor") { G.fx.push({ type: "meteorwarn", x: e.x as number, y: e.y as number, t: G.now, dur: (e.delay as number) || 0.9, r: e.r as number }); }
        else if (e.fx === "slam") { G.fx.push({ type: "boom", x: e.x as number, y: e.y as number, t: G.now, dur: 0.4, r: e.r as number }); SFX.boom(); }
        else if (e.fx === "summon") { G.fx.push({ type: "dropflash", x: e.x as number, y: e.y as number, t: G.now, dur: 0.5 }); }
        else if (e.fx === "heal") { G.fx.push({ type: "heal", x: e.x as number, y: e.y as number, t: G.now, dur: 0.6 }); }
        else if (e.fx === "split") { G.fx.push({ type: "boom", x: e.x as number, y: e.y as number, t: G.now, dur: 0.4, r: 0.8, ele: "pois" }); }
        else if (e.fx === "leech") { /* subtle heal */ G.life = Math.min(G.derived?.maxLife ?? G.life, G.life + (e.amt as number)); }
        break;
      }
      case "chest": SFX.chest(); break;
      case "shrine": SFX.shrine(); break;
      case "chat": addChat(`${e.name}: ${e.msg}`, "#d8cdb4"); break;
      case "join": addChat(`${e.name} joined the game.`, "#7fd15f"); break;
      case "leave": addChat(`${e.name} left the game.`, "#c88"); break;
    }
  }
}

export function die() {
  G.dead = true;
  G.send({ t: "dead" });
  SFX.playerdie();
  document.getElementById("deathscreen")!.classList.remove("hidden");
  document.getElementById("deathmsg")!.textContent =
    `${G.char!.name} was slain at depth ${G.depth}. Your items are safe.`;
}

// Town Portal — innate level-1 ability for every hero. Opens passage to
// town; used again in town, it returns you to the zone you left.
export function townPortal() {
  if (G.dead || !G.char) return;
  if ((G.cooldowns.townportal ?? 0) > G.now) {
    G.toast("The portal is still forming...", "#8a7d63");
    return;
  }
  G.cooldowns.townportal = G.now + 6;
  G.fx.push({ type: "teleport", x: G.x, y: G.y, t: G.now, dur: 0.5 });
  SFX.teleport();
  if (G.depth > 0) {
    G.returnDepth = G.depth;
    setDepth(0);
    G.toast("You step through the portal to Emberfall Refuge.");
  } else {
    setDepth(G.returnDepth || 1, "up");
    G.toast(MAX_DEPTH_NAME(G.depth));
  }
}

export function respawn() {
  G.dead = false;
  G.send({ t: "respawn" });
  document.getElementById("deathscreen")!.classList.add("hidden");
  setDepth(0);
  G.life = G.derived!.maxLife;
  G.mana = G.derived!.maxMana;
  G.onStateChange();
}

export function addChat(line: string, color: string) {
  const log = document.getElementById("chatlog")!;
  const div = document.createElement("div");
  div.className = "line";
  div.style.color = color;
  div.textContent = line;
  log.appendChild(div);
  while (log.children.length > 6) log.removeChild(log.firstChild!);
  setTimeout(() => { if (div.parentNode) div.remove(); }, 14000);
}

// ---------------- Snapshot handling ----------------
export function applySnapshot(snap: { depth: number; players: PlayerPub[]; monsters: MonsterState[]; projs: ProjState[]; items: GroundItem[]; objUsed: string[]; sentinels?: SentinelState[] }) {
  if (snap.depth !== G.depth) return;
  const t = G.now;
  const seen = new Set<string>();
  for (const m of snap.monsters) {
    seen.add(m.id);
    const ex = G.monsters.get(m.id);
    if (ex) {
      ex.px = ex.tx; ex.py = ex.ty;
      ex.tx = m.x; ex.ty = m.y;
      ex.cur = m;
      ex.snapAt = t;
    } else {
      G.monsters.set(m.id, { cur: m, px: m.x, py: m.y, tx: m.x, ty: m.y, snapAt: t });
    }
  }
  for (const id of [...G.monsters.keys()]) if (!seen.has(id)) G.monsters.delete(id);

  seen.clear();
  for (const p of snap.players) {
    if (p.id === G.playerId) continue;
    seen.add(p.id);
    const ex = G.players.get(p.id);
    if (ex) {
      ex.px = ex.tx; ex.py = ex.ty;
      ex.tx = p.x; ex.ty = p.y;
      ex.cur = p;
      ex.snapAt = t;
    } else {
      G.players.set(p.id, { cur: p, px: p.x, py: p.y, tx: p.x, ty: p.y, snapAt: t });
    }
  }
  for (const id of [...G.players.keys()]) if (!seen.has(id)) G.players.delete(id);

  seen.clear();
  for (const pr of snap.projs) {
    seen.add(pr.id);
    const ex = G.projs.get(pr.id);
    if (ex) {
      ex.px = ex.tx; ex.py = ex.ty;
      ex.tx = pr.x; ex.ty = pr.y;
      ex.cur = pr;
      ex.snapAt = t;
    } else {
      G.projs.set(pr.id, { cur: pr, px: pr.x, py: pr.y, tx: pr.x, ty: pr.y, snapAt: t });
    }
  }
  for (const id of [...G.projs.keys()]) if (!seen.has(id)) G.projs.delete(id);

  G.groundItems.clear();
  for (const g of snap.items) G.groundItems.set(g.gid, g);
  G.sentinels.clear();
  for (const s of snap.sentinels ?? []) G.sentinels.set(s.id, s);
  G.usedObjects = new Set(snap.objUsed);
}

// ---------------- Per-frame update ----------------
export function update(dt: number) {
  const c = G.char, d = G.derived;
  if (!c || !d || !G.map) return;
  G.now += dt;
  if (G.attackCd > 0) G.attackCd -= dt;
  if (G.castAnimT > 0) G.castAnimT -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.4);

  // buffs expiry
  const nBuffs = G.buffs.filter((b) => b.until > G.now);
  if (nBuffs.length !== G.buffs.length) {
    G.buffs = nBuffs;
    markStatsDirty();
    syncStats(true);
  }

  // regen + potion pools
  if (!G.dead) {
    if (G.healPool > 0) {
      const h = Math.min(G.healPool, 45 * dt);
      G.healPool -= h;
      G.life = Math.min(d.maxLife, G.life + h);
    }
    if (G.manaPool > 0) {
      const h = Math.min(G.manaPool, 40 * dt);
      G.manaPool -= h;
      G.mana = Math.min(d.maxMana, G.mana + h);
    }
    G.life = Math.min(d.maxLife, G.life + d.regenLife * dt);
    G.mana = Math.min(d.maxMana, G.mana + d.regenMana * dt);
    if (G.depth === 0) G.life = Math.min(d.maxLife, G.life + 6 * dt); // town is restful
  }

  // whirlwind visual state
  if (G.spinUntil > G.now) G.anim = "spin";
  else if (G.anim === "spin") G.anim = "idle";

  // movement
  if (!G.dead && G.moveTarget) {
    const dx = G.moveTarget.x - G.x, dy = G.moveTarget.y - G.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.15) {
      G.moveTarget = null;
      G.anim = "idle";
    } else {
      const sp = d.moveSpeed * (G.chillUntil > G.now ? 0.55 : 1);
      const [nx, ny] = moveWithCollision(G.map, G.x, G.y, (dx / dist) * sp * dt, (dy / dist) * sp * dt);
      if (Math.abs(nx - G.x) < 0.001 && Math.abs(ny - G.y) < 0.001) {
        G.moveTarget = null; // stuck on wall
        if (G.anim === "walk") G.anim = "idle";
      } else {
        G.x = nx; G.y = ny;
        G.dir = dx < 0 ? -1 : 1;
        if (G.anim !== "spin") G.anim = "walk";
      }
    }
  } else if (!G.moveTarget) {
    if (G.anim === "walk") G.anim = "idle";
  }

  // pending pickup
  if (G.pendingPickup) {
    const g = G.groundItems.get(G.pendingPickup);
    if (!g) G.pendingPickup = null;
    else if (Math.hypot(g.x - G.x, g.y - G.y) < 1.3) {
      G.send({ t: "pickup", gid: g.gid });
      G.pendingPickup = null;
    }
  }
  // pending object interaction
  if (G.pendingObj) {
    const obj = G.map.objects.find((o) => o.id === G.pendingObj);
    if (!obj) G.pendingObj = null;
    else if (Math.hypot(obj.x - G.x, obj.y - G.y) < 2.0) {
      interactObject(obj.id);
      G.pendingObj = null;
    }
  }

  // auto-pickup gold, potions and crafting materials (only if they'll fit,
  // so nothing bounces back to the ground in a loop)
  if (!G.dead) {
    for (const g of G.groundItems.values()) {
      if (G.autoPicked.has(g.gid)) continue;
      if (Math.hypot(g.x - G.x, g.y - G.y) > 1.6) continue;
      const b = BASES[g.item.base];
      const auto = g.item.base === "gold" || b.kind === "mat" || b.kind === "potion" || b.kind === "gem" || b.kind === "rune";
      if (!auto) continue;
      if (g.item.base !== "gold" && !canFit(g.item)) continue;
      G.autoPicked.add(g.gid);
      G.send({ t: "pickup", gid: g.gid });
    }
  }

  // dust kicked up while running
  if (G.anim === "walk" && !G.dead) {
    G.dustT -= dt;
    if (G.dustT <= 0) {
      G.dustT = 0.22;
      G.fx.push({ type: "dust", x: G.x + (Math.random() - 0.5) * 0.3, y: G.y + (Math.random() - 0.5) * 0.3, t: G.now, dur: 0.55 });
    }
  }

  // camera follows
  G.camX += (G.x - G.camX) * Math.min(1, dt * 8);
  G.camY += (G.y - G.camY) * Math.min(1, dt * 8);

  // fx cleanup
  G.fx = G.fx.filter((f) => G.now - f.t < f.dur);
  G.dmgNums = G.dmgNums.filter((n) => G.now - n.t < 1.0);

  sendPos();
  syncStats();

  // periodic save
  G.saveTimer += dt;
  if (G.saveTimer > 5) {
    G.saveTimer = 0;
    saveChar(c);
  }
}

// ---------------- Object interaction ----------------
export function interactObject(objId: string) {
  const obj = G.map?.objects.find((o) => o.id === objId);
  if (!obj) return;
  switch (obj.type) {
    case "stairs_down":
      if (G.depth === 0) setDepth(Math.max(1, 1), "up");
      else setDepth(G.depth + 1, "up");
      G.toast(MAX_DEPTH_NAME(G.depth));
      break;
    case "stairs_up":
      setDepth(G.depth - 1, G.depth - 1 === 0 ? undefined : "down");
      G.toast(MAX_DEPTH_NAME(G.depth));
      break;
    case "well":
      G.life = G.derived!.maxLife;
      G.mana = G.derived!.maxMana;
      SFX.potion();
      G.toast("You feel refreshed.");
      break;
    case "stash":
      G.onStateChange();
      document.dispatchEvent(new CustomEvent("open-stash"));
      break;
    case "waypoint":
      document.dispatchEvent(new CustomEvent("open-waypoint"));
      break;
    case "vendor":
      document.dispatchEvent(new CustomEvent("open-vendor"));
      break;
    case "gambler":
      document.dispatchEvent(new CustomEvent("open-gamble"));
      break;
    case "chest":
    case "shrine":
      if (!G.usedObjects.has(objId)) G.send({ t: "interact", objId });
      break;
  }
}

// Can this item go somewhere (belt for potions, else inventory)?
function canFit(item: Item): boolean {
  const c = G.char;
  if (!c) return false;
  const b = BASES[item.base];
  if (b.kind === "potion") {
    for (let i = 0; i < 4; i++) {
      const s = c.belt[i];
      if (!s) return true;
      if (s.base === item.base && (s.qty ?? 1) + (item.qty ?? 1) <= (b.stack ?? 10)) return true;
    }
  }
  return findSpot(c.inv, item, INV_W, INV_H) !== null;
}

// ---------------- Pickup result ----------------
export function receivePickup(item: Item) {
  const c = G.char!;
  if (item.base === "gold") {
    const amt = Math.round((item.qty ?? 1) * (1 + (G.derived?.goldPct ?? 0) / 100));
    c.gold += amt;
    SFX.gold();
    G.toast(`+${amt} gold`, "#e8c860");
    saveChar(c);
    G.onStateChange();
    return;
  }
  const b = BASES[item.base];
  if (b.kind === "potion") {
    // try belt first
    for (let i = 0; i < 4; i++) {
      const s = c.belt[i];
      if (s && s.base === item.base && (s.qty ?? 1) < (b.stack ?? 10)) {
        s.qty = (s.qty ?? 1) + (item.qty ?? 1);
        SFX.pickup();
        saveChar(c);
        G.onStateChange();
        return;
      }
    }
    for (let i = 0; i < 4; i++) {
      if (!c.belt[i]) {
        c.belt[i] = item;
        SFX.pickup();
        saveChar(c);
        G.onStateChange();
        return;
      }
    }
  }
  if (addToGrid(c.inv, item, INV_W, INV_H)) {
    SFX.pickup();
    saveChar(c);
    G.onStateChange();
  } else {
    G.toast("Inventory full!", "#d05050");
    SFX.error();
    G.send({ t: "drop", item, x: G.x + 0.5, y: G.y + 0.5 });
  }
}
