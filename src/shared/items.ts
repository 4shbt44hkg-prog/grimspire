import { AFFIXES, BASES, GEM_FX, RUNE_FX, RUNE_ORDER, RUNEWORDS, SETS, UNIQUES } from "./gamedata";
import { chance, pick, ri, uid, type RNG } from "./rng";
import type { Affix, BaseItem, Item, Mod, Rarity, Slot, StatId } from "./types";

export const RARITY_COLOR: Record<Rarity, string> = {
  normal: "#c8c8c8", magic: "#6f6fff", rare: "#ffff64",
  crafted: "#ff9a3c", unique: "#b8860b", set: "#00c400",
};

export function baseOf(it: Item): BaseItem {
  return BASES[it.base];
}

// ---------- Affix rolling ----------
function affixApplies(a: Affix, base: BaseItem): boolean {
  const slot = base.slot;
  if (!slot) return false;
  for (const s of a.slots) {
    if (s === "any") return true;
    if (s === "weaponish" && slot === "weapon") return true;
    if (s === "armorish" && (slot === "body" || slot === "helm" || slot === "offhand" || slot === "gloves" || slot === "boots" || slot === "belt")) return true;
    if (s === slot) return true;
  }
  return false;
}

function rollAffix(r: RNG, a: Affix, ilvl: number): { mod: Mod; name: string } | null {
  const tiers = a.tiers.filter((t) => t.ilvl <= ilvl);
  if (!tiers.length) return null;
  // Weight towards the highest available tier but allow lower rolls (D2 style).
  const t = tiers[Math.min(tiers.length - 1, Math.floor(r() * tiers.length * 1.35))] ?? tiers[tiers.length - 1];
  return { mod: { stat: a.stat, v: ri(r, t.min, t.max) }, name: t.name };
}

function rollAffixes(r: RNG, base: BaseItem, ilvl: number, nPre: number, nSuf: number, exclude: StatId[] = []):
  { mods: Mod[]; preName?: string; sufName?: string } {
  const mods: Mod[] = [];
  const used = new Set<string>(exclude);
  let preName: string | undefined, sufName: string | undefined;
  const roll = (kind: "prefix" | "suffix", n: number) => {
    const pool = AFFIXES.filter((a) => a.kind === kind && affixApplies(a, base) && !used.has(a.stat) && a.tiers.some((t) => t.ilvl <= ilvl));
    for (let i = 0; i < n && pool.length; i++) {
      const a = pool.splice(Math.floor(r() * pool.length), 1)[0];
      const rolled = rollAffix(r, a, ilvl);
      if (!rolled) continue;
      used.add(a.stat);
      mods.push(rolled.mod);
      if (kind === "prefix" && !preName) preName = rolled.name;
      if (kind === "suffix" && !sufName) sufName = rolled.name;
    }
  };
  roll("prefix", nPre);
  roll("suffix", nSuf);
  return { mods, preName, sufName };
}

// Random affixes for crafted items (avoids duplicating craft theme stats).
export function rollAffixesForCraft(r: RNG, base: BaseItem, ilvl: number, n: number): Mod[] {
  const nPre = Math.round(r() * n);
  return rollAffixes(r, base, ilvl, nPre, n - nPre).mods;
}

const RARE_NAMES_A = ["Grim", "Doom", "Blood", "Storm", "Bone", "Shadow", "Ember", "Frost", "Dread", "Viper", "Raven", "Iron"];
const RARE_NAMES_B = ["bite", "song", "ward", "shear", "brand", "grip", "howl", "veil", "mark", "fall", "coil", "bane"];

export function rareName(r: RNG): string {
  return pick(r, RARE_NAMES_A) + pick(r, RARE_NAMES_B);
}

// ---------- Item factories ----------
export function makeItem(baseId: string, rarity: Rarity = "normal", qty = 1): Item {
  const base = BASES[baseId];
  return {
    id: uid(), base: baseId, rarity, name: base.name, ilvl: 1,
    mods: [], sockets: 0, socketed: [], qty: base.stack ? qty : undefined,
  };
}

export function rollMagic(r: RNG, baseId: string, ilvl: number): Item {
  const it = makeItem(baseId, "magic");
  it.ilvl = ilvl;
  const base = BASES[baseId];
  const hasPre = chance(r, 0.8);
  const hasSuf = !hasPre || chance(r, 0.55);
  const { mods, preName, sufName } = rollAffixes(r, base, ilvl, hasPre ? 1 : 0, hasSuf ? 1 : 0);
  it.mods = mods;
  it.name = `${preName ? preName + " " : ""}${base.name}${sufName ? " " + sufName : ""}`;
  if (base.maxSockets && chance(r, 0.22)) it.sockets = ri(r, 1, Math.min(2, base.maxSockets));
  return it;
}

export function rollRare(r: RNG, baseId: string, ilvl: number): Item {
  const it = makeItem(baseId, "rare");
  it.ilvl = ilvl;
  const base = BASES[baseId];
  const { mods } = rollAffixes(r, base, ilvl, ri(r, 1, 3), ri(r, 1, 3));
  it.mods = mods;
  it.name = rareName(r);
  if (base.maxSockets && chance(r, 0.18)) it.sockets = ri(r, 1, Math.min(2, base.maxSockets));
  return it;
}

export function rollUnique(r: RNG, ilvl: number): Item | null {
  const pool = UNIQUES.filter((u) => u.reqIlvl <= ilvl);
  if (!pool.length) return null;
  const u = pick(r, pool);
  const it = makeItem(u.base, "unique");
  it.ilvl = ilvl;
  it.name = u.name;
  it.mods = u.mods.map((m) => ({ ...m }));
  return it;
}

export function rollSet(r: RNG, ilvl: number): Item | null {
  const candidates: { setId: string; idx: number }[] = [];
  for (const s of SETS) s.pieces.forEach((p, idx) => {
    if (BASES[p.base].reqLvl <= Math.max(1, ilvl) ) candidates.push({ setId: s.id, idx });
  });
  if (!candidates.length) return null;
  const c = pick(r, candidates);
  const s = SETS.find((x) => x.id === c.setId)!;
  const p = s.pieces[c.idx];
  const it = makeItem(p.base, "set");
  it.ilvl = ilvl;
  it.name = p.name;
  it.setId = s.id;
  it.mods = p.mods.map((m) => ({ ...m }));
  return it;
}

export function rollNormal(r: RNG, baseId: string, ilvl: number): Item {
  const it = makeItem(baseId, "normal");
  it.ilvl = ilvl;
  const base = BASES[baseId];
  if (base.maxSockets && chance(r, 0.4)) it.sockets = ri(r, 1, base.maxSockets);
  return it;
}

// Pick an equipment base appropriate to ilvl.
export function pickEquipBase(r: RNG, ilvl: number): string {
  const pool = Object.values(BASES).filter(
    (b) => b.slot && b.reqLvl <= Math.max(1, ilvl + 2) && (b.tier === 1 || b.reqLvl >= ilvl - 14),
  );
  return pick(r, pool).id;
}

// Full loot-drop rarity roll. mf = magic find %.
export function rollEquipDrop(r: RNG, ilvl: number, mf: number, rareBoost = 1): Item {
  const m = 1 + mf / 100;
  const baseId = pickEquipBase(r, ilvl);
  if (chance(r, 0.015 * m * rareBoost)) { const u = rollUnique(r, ilvl); if (u) return u; }
  if (chance(r, 0.012 * m * rareBoost)) { const s = rollSet(r, ilvl); if (s) return s; }
  if (chance(r, 0.09 * m * rareBoost)) return rollRare(r, baseId, ilvl);
  if (chance(r, 0.38 * Math.sqrt(m))) return rollMagic(r, baseId, ilvl);
  return rollNormal(r, baseId, ilvl);
}

// ---------- Sockets & runewords ----------
export function canSocketInto(it: Item, target: Item): boolean {
  const b = baseOf(it);
  return (b.kind === "gem" || b.kind === "rune") && target.socketed.length < target.sockets;
}

export function socketItem(gem: Item, target: Item): void {
  target.socketed.push({ ...gem, qty: 1 });
  checkRuneword(target);
}

export function checkRuneword(it: Item): void {
  if (it.rarity !== "normal" || it.runeword) return;
  const b = baseOf(it);
  if (it.socketed.some((s) => baseOf(s).kind !== "rune")) return;
  const seq = it.socketed.map((s) => s.base);
  for (const rw of RUNEWORDS) {
    const slotOk =
      (rw.slots.includes("weapon") && b.slot === "weapon") ||
      (rw.slots.includes("shield") && b.kind === "shield") ||
      (rw.slots.includes("body") && b.slot === "body") ||
      (rw.slots.includes("helm") && b.slot === "helm");
    if (slotOk && seq.length === rw.runes.length && seq.every((s, i) => s === rw.runes[i])) {
      it.runeword = rw.id;
      it.name = rw.name;
      return;
    }
  }
}

// Mods granted by a socketed gem/rune, contextual to the host item.
export function socketMods(sock: Item, host: BaseItem): Mod[] {
  const b = baseOf(sock);
  const isWeapon = host.slot === "weapon";
  if (b.kind === "gem") {
    const [type, gradeS] = sock.base.split("_");
    const grade = parseInt(gradeS);
    const fx = GEM_FX[type];
    const [stat, vals] = isWeapon ? fx.w : fx.a;
    return [{ stat: stat as StatId, v: vals[grade] }];
  }
  if (b.kind === "rune") {
    const rn = sock.base.replace("rune_", "");
    const fx = RUNE_FX[rn];
    const [stat, v] = isWeapon ? fx.w : fx.a;
    return [{ stat: stat as StatId, v }];
  }
  return [];
}

// All effective mods of an item: own + sockets + runeword.
export function allMods(it: Item): Mod[] {
  const base = baseOf(it);
  const out: Mod[] = [...it.mods];
  for (const s of it.socketed) out.push(...socketMods(s, base));
  if (it.runeword) {
    const rw = RUNEWORDS.find((r) => r.id === it.runeword);
    if (rw) out.push(...rw.mods);
  }
  return out;
}

export function statTotal(mods: Mod[], stat: StatId): number {
  let t = 0;
  for (const m of mods) if (m.stat === stat) t += m.v;
  return t;
}

// ---------- Vendor economy ----------
// What a merchant pays for an item. Nothing is worthless — Eastern Sun style.
export function itemValue(it: Item): number {
  const b = baseOf(it);
  let v = 0;
  if (b.kind === "gem") {
    const grade = parseInt(it.base.split("_")[1] ?? "0");
    v = [20, 80, 180][grade] ?? 20;
  } else if (b.kind === "rune") {
    const idx = RUNE_ORDER.indexOf(it.base.replace("rune_", ""));
    v = Math.round(30 * Math.pow(1.9, Math.max(0, idx)));
  } else if (b.kind === "mat") {
    v = it.base === "soulember" ? 400 : it.base === "shard" ? 150 : 40;
  } else if (b.kind === "potion") {
    v = b.tier * 8;
  } else {
    const ilvl = Math.max(1, it.ilvl);
    switch (it.rarity) {
      case "normal": v = 8 + ilvl * 2 + it.sockets * 15; break;
      case "magic": v = 25 + ilvl * 6; break;
      case "rare": v = 80 + ilvl * 12; break;
      case "crafted": v = 70 + ilvl * 10; break;
      case "set": v = 250 + ilvl * 12; break;
      case "unique": v = 300 + ilvl * 15; break;
    }
    for (const s of it.socketed) v += Math.round(itemValue(s) * 0.5);
    if (it.runeword) v += 200;
  }
  return Math.max(1, Math.round(v * (it.qty ?? 1)));
}

// ---------- Gambling ----------
export const GAMBLE_BASE_PRICE: Record<string, number> = {
  weapon: 450, offhand: 400, helm: 400, body: 500,
  gloves: 300, boots: 300, belt: 300, ring: 600, amulet: 700,
};

export function gamblePrice(slot: Slot, lvl: number): number {
  return Math.round(((GAMBLE_BASE_PRICE[slot] ?? 400) * (1 + lvl * 0.08)) / 10) * 10;
}

// D2-style gamble: pay for a slot, get a hidden roll. Better odds than
// finding, worse than earning — uniques and sets can appear.
export function gambleItem(r: RNG, slot: Slot, lvl: number): Item {
  const pool = Object.values(BASES).filter((b) => b.slot === slot && b.reqLvl <= Math.max(1, lvl + 2));
  const baseId = pick(r, pool).id;
  const ilvl = Math.max(1, lvl + ri(r, -1, 2));
  const roll = r();
  if (roll < 0.03) {
    const cands = UNIQUES.filter((u) => BASES[u.base].slot === slot && u.reqIlvl <= ilvl + 4);
    if (cands.length) {
      const u = pick(r, cands);
      const it = makeItem(u.base, "unique");
      it.ilvl = ilvl;
      it.name = u.name;
      it.mods = u.mods.map((m) => ({ ...m }));
      return it;
    }
  }
  if (roll < 0.055) {
    const cands: { setId: string; idx: number }[] = [];
    for (const s of SETS) s.pieces.forEach((p, idx) => {
      if (BASES[p.base].slot === slot) cands.push({ setId: s.id, idx });
    });
    if (cands.length) {
      const c = pick(r, cands);
      const s = SETS.find((x) => x.id === c.setId)!;
      const p = s.pieces[c.idx];
      const it = makeItem(p.base, "set");
      it.ilvl = ilvl;
      it.name = p.name;
      it.setId = s.id;
      it.mods = p.mods.map((m) => ({ ...m }));
      return it;
    }
  }
  if (roll < 0.32) return rollRare(r, baseId, ilvl + 1);
  return rollMagic(r, baseId, ilvl + 1);
}

// ---------- Display ----------
export const STAT_LABEL: Record<StatId, (v: number) => string> = {
  dmg_pct: (v) => `+${v}% Enhanced Damage`,
  dmg_min: (v) => `+${v} to Minimum Damage`,
  dmg_max: (v) => `+${v} to Maximum Damage`,
  as_pct: (v) => `+${v}% Attack Speed`,
  cs_pct: (v) => `+${v}% Cast Speed`,
  fire_dmg: (v) => `Adds ${v} Fire Damage`,
  cold_dmg: (v) => `Adds ${v} Cold Damage`,
  light_dmg: (v) => `Adds 1-${v * 2} Lightning Damage`,
  pois_dmg: (v) => `Adds ${v} Poison Damage over 3s`,
  life: (v) => `+${v} to Life`,
  mana: (v) => `+${v} to Mana`,
  str: (v) => `+${v} to Strength`,
  dex: (v) => `+${v} to Dexterity`,
  vit: (v) => `+${v} to Vitality`,
  ene: (v) => `+${v} to Energy`,
  def: (v) => `+${v} Defense`,
  def_pct: (v) => `+${v}% Enhanced Defense`,
  res_fire: (v) => `Fire Resist +${v}%`,
  res_cold: (v) => `Cold Resist +${v}%`,
  res_light: (v) => `Lightning Resist +${v}%`,
  res_pois: (v) => `Poison Resist +${v}%`,
  res_all: (v) => `All Resistances +${v}%`,
  mf: (v) => `${v}% Better Chance of Magic Items`,
  move_pct: (v) => `+${v}% Faster Run/Walk`,
  lifesteal: (v) => `${v}% Life Stolen per Hit`,
  manasteal: (v) => `${v}% Mana Stolen per Hit`,
  regen_life: (v) => `Replenish Life +${v}`,
  regen_mana: (v) => `Regenerate Mana +${v}`,
  skill_lvl: (v) => `+${v} to All Skills`,
  spell_pct: (v) => `+${v}% Spell Damage`,
  gold_pct: (v) => `${v}% Extra Gold from Monsters`,
};
