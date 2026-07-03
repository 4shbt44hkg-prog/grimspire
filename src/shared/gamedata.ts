import type {
  Affix, BaseItem, MonsterAffix, MonsterDef, RunewordDef, SetDef, SkillDef, UniqueDef,
} from "./types";

// ============================== ITEM BASES ==============================
// Three tiers per line (normal → exceptional → elite), enabling Eastern
// Sun-style tier upgrade recipes that keep the item's mods.

const B = (b: BaseItem) => b;

export const BASES: Record<string, BaseItem> = {};
function add(...items: BaseItem[]) {
  for (const it of items) BASES[it.id] = it;
}

// --- Weapons ---
add(
  B({ id: "shortsword", name: "Shortsword", slot: "weapon", kind: "sword", tier: 1, next: "broadsword", dmg: [2, 6], maxSockets: 2, reqLvl: 1, w: 1, h: 3, spr: "sword" }),
  B({ id: "broadsword", name: "Broadsword", slot: "weapon", kind: "sword", tier: 2, next: "warblade", dmg: [8, 16], maxSockets: 3, reqLvl: 10, w: 1, h: 3, spr: "sword" }),
  B({ id: "warblade", name: "Warblade", slot: "weapon", kind: "sword", tier: 3, dmg: [18, 34], maxSockets: 3, reqLvl: 22, w: 1, h: 3, spr: "sword" }),
  B({ id: "hatchet", name: "Hatchet", slot: "weapon", kind: "axe", tier: 1, next: "battleaxe", dmg: [3, 8], maxSockets: 2, reqLvl: 1, w: 2, h: 3, spr: "axe" }),
  B({ id: "battleaxe", name: "Battle Axe", slot: "weapon", kind: "axe", tier: 2, next: "doomaxe", dmg: [10, 22], maxSockets: 3, reqLvl: 12, w: 2, h: 3, spr: "axe", twoHand: true }),
  B({ id: "doomaxe", name: "Doom Axe", slot: "weapon", kind: "axe", tier: 3, dmg: [24, 45], maxSockets: 3, reqLvl: 25, w: 2, h: 3, spr: "axe", twoHand: true }),
  B({ id: "club", name: "Club", slot: "weapon", kind: "mace", tier: 1, next: "warhammer", dmg: [3, 7], maxSockets: 2, reqLvl: 1, w: 1, h: 3, spr: "mace" }),
  B({ id: "warhammer", name: "Warhammer", slot: "weapon", kind: "mace", tier: 2, next: "thundermaul", dmg: [9, 20], maxSockets: 3, reqLvl: 11, w: 2, h: 3, spr: "mace" }),
  B({ id: "thundermaul", name: "Thunder Maul", slot: "weapon", kind: "mace", tier: 3, dmg: [22, 42], maxSockets: 3, reqLvl: 24, w: 2, h: 3, spr: "mace", twoHand: true }),
  B({ id: "gnarledstaff", name: "Gnarled Staff", slot: "weapon", kind: "staff", tier: 1, next: "runestaff", dmg: [2, 5], maxSockets: 2, reqLvl: 1, w: 1, h: 4, spr: "staff", caster: true, twoHand: true }),
  B({ id: "runestaff", name: "Rune Staff", slot: "weapon", kind: "staff", tier: 2, next: "archonstaff", dmg: [6, 12], maxSockets: 3, reqLvl: 12, w: 1, h: 4, spr: "staff", caster: true, twoHand: true }),
  B({ id: "archonstaff", name: "Archon Staff", slot: "weapon", kind: "staff", tier: 3, dmg: [12, 24], maxSockets: 3, reqLvl: 24, w: 1, h: 4, spr: "staff", caster: true, twoHand: true }),
);

// --- Armor ---
add(
  B({ id: "leatherarmor", name: "Leather Armor", slot: "body", kind: "armor", tier: 1, next: "chainmail", def: 12, maxSockets: 3, reqLvl: 1, w: 2, h: 3, spr: "body" }),
  B({ id: "chainmail", name: "Chain Mail", slot: "body", kind: "armor", tier: 2, next: "dreadplate", def: 40, maxSockets: 4, reqLvl: 12, w: 2, h: 3, spr: "body" }),
  B({ id: "dreadplate", name: "Dread Plate", slot: "body", kind: "armor", tier: 3, def: 90, maxSockets: 4, reqLvl: 25, w: 2, h: 3, spr: "body" }),
  B({ id: "cap", name: "Cap", slot: "helm", kind: "helm", tier: 1, next: "helm", def: 6, maxSockets: 2, reqLvl: 1, w: 2, h: 2, spr: "helm" }),
  B({ id: "helm", name: "Helm", slot: "helm", kind: "helm", tier: 2, next: "grimcasque", def: 20, maxSockets: 2, reqLvl: 11, w: 2, h: 2, spr: "helm" }),
  B({ id: "grimcasque", name: "Grim Casque", slot: "helm", kind: "helm", tier: 3, def: 45, maxSockets: 3, reqLvl: 24, w: 2, h: 2, spr: "helm" }),
  B({ id: "buckler", name: "Buckler", slot: "offhand", kind: "shield", tier: 1, next: "kiteshield", def: 10, maxSockets: 2, reqLvl: 1, w: 2, h: 2, spr: "shield" }),
  B({ id: "kiteshield", name: "Kite Shield", slot: "offhand", kind: "shield", tier: 2, next: "towershield", def: 30, maxSockets: 3, reqLvl: 12, w: 2, h: 3, spr: "shield" }),
  B({ id: "towershield", name: "Tower Shield", slot: "offhand", kind: "shield", tier: 3, def: 70, maxSockets: 3, reqLvl: 25, w: 2, h: 3, spr: "shield" }),
  B({ id: "lgloves", name: "Leather Gloves", slot: "gloves", kind: "gloves", tier: 1, next: "hgauntlets", def: 4, reqLvl: 1, w: 2, h: 2, spr: "gloves" }),
  B({ id: "hgauntlets", name: "Heavy Gauntlets", slot: "gloves", kind: "gloves", tier: 2, next: "wargauntlets", def: 14, reqLvl: 12, w: 2, h: 2, spr: "gloves" }),
  B({ id: "wargauntlets", name: "War Gauntlets", slot: "gloves", kind: "gloves", tier: 3, def: 32, reqLvl: 24, w: 2, h: 2, spr: "gloves" }),
  B({ id: "lboots", name: "Leather Boots", slot: "boots", kind: "boots", tier: 1, next: "greaves", def: 4, reqLvl: 1, w: 2, h: 2, spr: "boots" }),
  B({ id: "greaves", name: "Greaves", slot: "boots", kind: "boots", tier: 2, next: "wargreaves", def: 14, reqLvl: 12, w: 2, h: 2, spr: "boots" }),
  B({ id: "wargreaves", name: "War Greaves", slot: "boots", kind: "boots", tier: 3, def: 32, reqLvl: 24, w: 2, h: 2, spr: "boots" }),
  B({ id: "sash", name: "Sash", slot: "belt", kind: "belt", tier: 1, next: "warbelt", def: 3, reqLvl: 1, w: 2, h: 1, spr: "belt" }),
  B({ id: "warbelt", name: "War Belt", slot: "belt", kind: "belt", tier: 2, next: "titanbelt", def: 12, reqLvl: 12, w: 2, h: 1, spr: "belt" }),
  B({ id: "titanbelt", name: "Titan Belt", slot: "belt", kind: "belt", tier: 3, def: 28, reqLvl: 24, w: 2, h: 1, spr: "belt" }),
  B({ id: "ring", name: "Ring", slot: "ring", kind: "ring", tier: 1, reqLvl: 1, w: 1, h: 1, spr: "ring" }),
  B({ id: "amulet", name: "Amulet", slot: "amulet", kind: "amulet", tier: 1, reqLvl: 1, w: 1, h: 1, spr: "amulet" }),
);

// --- Gems (3 grades × 5 types) ---
export const GEM_TYPES = ["ruby", "sapphire", "topaz", "emerald", "skull"] as const;
export const GEM_GRADES = ["chipped", "flawed", "perfect"] as const;
const GEM_NAMES: Record<string, string> = { ruby: "Ruby", sapphire: "Sapphire", topaz: "Topaz", emerald: "Emerald", skull: "Skull" };
for (const t of GEM_TYPES) {
  for (let g = 0; g < 3; g++) {
    add(B({
      id: `${t}_${g}`, name: `${GEM_GRADES[g][0].toUpperCase()}${GEM_GRADES[g].slice(1)} ${GEM_NAMES[t]}`,
      kind: "gem", tier: 1, reqLvl: 1, w: 1, h: 1, spr: `gem_${t}`, stack: 20,
    }));
  }
}
// Gem socket effects: [weaponStat, weaponVal, armorStat, armorVal] per grade index.
export const GEM_FX: Record<string, { w: [string, number[]]; a: [string, number[]] }> = {
  ruby: { w: ["fire_dmg", [4, 10, 22]], a: ["life", [8, 18, 38]] },
  sapphire: { w: ["cold_dmg", [3, 8, 18]], a: ["mana", [8, 18, 38]] },
  topaz: { w: ["light_dmg", [1, 12, 28]], a: ["mf", [6, 13, 24]] },
  emerald: { w: ["pois_dmg", [4, 10, 20]], a: ["dex", [3, 6, 10]] },
  skull: { w: ["lifesteal", [2, 3, 5]], a: ["regen_life", [1, 2, 4]] },
};

// --- Runes (8, ascending) ---
export const RUNE_ORDER = ["ash", "bone", "cinder", "dusk", "ember", "fang", "grim", "hex"];
const RUNE_FX: Record<string, { w: [string, number]; a: [string, number] }> = {
  ash: { w: ["dmg_min", 2], a: ["def", 6] },
  bone: { w: ["dmg_max", 4], a: ["life", 12] },
  cinder: { w: ["fire_dmg", 8], a: ["res_fire", 12] },
  dusk: { w: ["cold_dmg", 7], a: ["res_cold", 12] },
  ember: { w: ["light_dmg", 10], a: ["res_light", 12] },
  fang: { w: ["lifesteal", 3], a: ["res_pois", 12] },
  grim: { w: ["dmg_pct", 20], a: ["def_pct", 18] },
  hex: { w: ["spell_pct", 15], a: ["res_all", 8] },
};
for (const rn of RUNE_ORDER) {
  add(B({
    id: `rune_${rn}`, name: `${rn[0].toUpperCase()}${rn.slice(1)} Rune`,
    kind: "rune", tier: 1, reqLvl: 1, w: 1, h: 1, spr: "rune", stack: 20,
  }));
}
export { RUNE_FX };

// --- Materials (Eastern Sun-style crafting reagents) ---
add(
  B({ id: "dust", name: "Arcane Dust", kind: "mat", tier: 1, reqLvl: 1, w: 1, h: 1, spr: "dust", stack: 50 }),
  B({ id: "shard", name: "Glowing Shard", kind: "mat", tier: 1, reqLvl: 1, w: 1, h: 1, spr: "shard", stack: 50 }),
  B({ id: "soulember", name: "Soul Ember", kind: "mat", tier: 1, reqLvl: 1, w: 1, h: 1, spr: "soulember", stack: 50 }),
);

add(
  B({ id: "gold", name: "Gold", kind: "mat", tier: 1, reqLvl: 1, w: 1, h: 1, spr: "gold", stack: 100000 }),
);

// --- Potions ---
add(
  B({ id: "hp1", name: "Minor Healing Potion", kind: "potion", tier: 1, reqLvl: 1, w: 1, h: 1, spr: "hpot", stack: 10, potion: { hp: 40 } }),
  B({ id: "hp2", name: "Healing Potion", kind: "potion", tier: 2, reqLvl: 1, w: 1, h: 1, spr: "hpot", stack: 10, potion: { hp: 100 } }),
  B({ id: "hp3", name: "Greater Healing Potion", kind: "potion", tier: 3, reqLvl: 1, w: 1, h: 1, spr: "hpot", stack: 10, potion: { hp: 220 } }),
  B({ id: "mp1", name: "Minor Mana Potion", kind: "potion", tier: 1, reqLvl: 1, w: 1, h: 1, spr: "mpot", stack: 10, potion: { mp: 30 } }),
  B({ id: "mp2", name: "Mana Potion", kind: "potion", tier: 2, reqLvl: 1, w: 1, h: 1, spr: "mpot", stack: 10, potion: { mp: 70 } }),
  B({ id: "mp3", name: "Greater Mana Potion", kind: "potion", tier: 3, reqLvl: 1, w: 1, h: 1, spr: "mpot", stack: 10, potion: { mp: 150 } }),
);

// ============================== AFFIXES ==============================
const A = (a: Affix) => a;
export const AFFIXES: Affix[] = [
  // Prefixes
  A({ id: "p_dmg", kind: "prefix", stat: "dmg_pct", slots: ["weapon"], tiers: [
    { ilvl: 1, min: 10, max: 25, name: "Sharp" }, { ilvl: 6, min: 26, max: 50, name: "Vicious" },
    { ilvl: 14, min: 51, max: 85, name: "Savage" }, { ilvl: 24, min: 86, max: 140, name: "Merciless" }] }),
  A({ id: "p_dmgmax", kind: "prefix", stat: "dmg_max", slots: ["weapon", "ring", "amulet"], tiers: [
    { ilvl: 1, min: 1, max: 3, name: "Honed" }, { ilvl: 8, min: 4, max: 8, name: "Keen" }, { ilvl: 18, min: 9, max: 16, name: "Brutal" }] }),
  A({ id: "p_def", kind: "prefix", stat: "def_pct", slots: ["armorish"], tiers: [
    { ilvl: 1, min: 10, max: 25, name: "Sturdy" }, { ilvl: 8, min: 26, max: 50, name: "Strong" },
    { ilvl: 16, min: 51, max: 90, name: "Blessed" }, { ilvl: 26, min: 91, max: 150, name: "Holy" }] }),
  A({ id: "p_fdef", kind: "prefix", stat: "def", slots: ["armorish", "ring", "amulet"], tiers: [
    { ilvl: 1, min: 3, max: 10, name: "Stout" }, { ilvl: 9, min: 11, max: 28, name: "Fortified" }, { ilvl: 20, min: 29, max: 60, name: "Bastioned" }] }),
  A({ id: "p_fire", kind: "prefix", stat: "fire_dmg", slots: ["weapon", "ring", "amulet", "gloves"], tiers: [
    { ilvl: 2, min: 2, max: 6, name: "Fiery" }, { ilvl: 10, min: 7, max: 16, name: "Smoldering" }, { ilvl: 20, min: 17, max: 34, name: "Volcanic" }] }),
  A({ id: "p_cold", kind: "prefix", stat: "cold_dmg", slots: ["weapon", "ring", "amulet", "gloves"], tiers: [
    { ilvl: 2, min: 2, max: 5, name: "Chilling" }, { ilvl: 10, min: 6, max: 13, name: "Freezing" }, { ilvl: 20, min: 14, max: 28, name: "Glacial" }] }),
  A({ id: "p_light", kind: "prefix", stat: "light_dmg", slots: ["weapon", "ring", "amulet", "gloves"], tiers: [
    { ilvl: 2, min: 1, max: 8, name: "Static" }, { ilvl: 10, min: 1, max: 22, name: "Charged" }, { ilvl: 20, min: 1, max: 44, name: "Storming" }] }),
  A({ id: "p_mf", kind: "prefix", stat: "mf", slots: ["any"], tiers: [
    { ilvl: 3, min: 5, max: 12, name: "Lucky" }, { ilvl: 12, min: 13, max: 24, name: "Fortuitous" }, { ilvl: 22, min: 25, max: 40, name: "Fated" }] }),
  A({ id: "p_spell", kind: "prefix", stat: "spell_pct", slots: ["weapon", "amulet", "helm"], tiers: [
    { ilvl: 2, min: 5, max: 12, name: "Apprentice's" }, { ilvl: 10, min: 13, max: 25, name: "Magus's" }, { ilvl: 20, min: 26, max: 45, name: "Archon's" }] }),
  A({ id: "p_resall", kind: "prefix", stat: "res_all", slots: ["armorish", "amulet"], tiers: [
    { ilvl: 5, min: 3, max: 8, name: "Warding" }, { ilvl: 14, min: 9, max: 15, name: "Shimmering" }, { ilvl: 24, min: 16, max: 25, name: "Prismatic" }] }),
  A({ id: "p_gold", kind: "prefix", stat: "gold_pct", slots: ["any"], tiers: [
    { ilvl: 1, min: 10, max: 25, name: "Miser's" }, { ilvl: 10, min: 26, max: 60, name: "Dragon's" }] }),
  // Suffixes
  A({ id: "s_str", kind: "suffix", stat: "str", slots: ["any"], tiers: [
    { ilvl: 1, min: 1, max: 3, name: "of the Ox" }, { ilvl: 8, min: 4, max: 8, name: "of the Giant" }, { ilvl: 18, min: 9, max: 15, name: "of the Titan" }] }),
  A({ id: "s_dex", kind: "suffix", stat: "dex", slots: ["any"], tiers: [
    { ilvl: 1, min: 1, max: 3, name: "of the Fox" }, { ilvl: 8, min: 4, max: 8, name: "of the Wolf" }, { ilvl: 18, min: 9, max: 15, name: "of the Wraith" }] }),
  A({ id: "s_vit", kind: "suffix", stat: "vit", slots: ["any"], tiers: [
    { ilvl: 1, min: 1, max: 3, name: "of the Boar" }, { ilvl: 8, min: 4, max: 8, name: "of the Bear" }, { ilvl: 18, min: 9, max: 15, name: "of the Colossus" }] }),
  A({ id: "s_ene", kind: "suffix", stat: "ene", slots: ["any"], tiers: [
    { ilvl: 1, min: 1, max: 3, name: "of the Owl" }, { ilvl: 8, min: 4, max: 8, name: "of the Sage" }, { ilvl: 18, min: 9, max: 15, name: "of the Mind" }] }),
  A({ id: "s_life", kind: "suffix", stat: "life", slots: ["any"], tiers: [
    { ilvl: 1, min: 5, max: 15, name: "of Vigor" }, { ilvl: 9, min: 16, max: 35, name: "of Life" }, { ilvl: 20, min: 36, max: 70, name: "of the Whale" }] }),
  A({ id: "s_mana", kind: "suffix", stat: "mana", slots: ["any"], tiers: [
    { ilvl: 1, min: 5, max: 15, name: "of Mist" }, { ilvl: 9, min: 16, max: 35, name: "of Magic" }, { ilvl: 20, min: 36, max: 70, name: "of the Leviathan" }] }),
  A({ id: "s_as", kind: "suffix", stat: "as_pct", slots: ["weapon", "gloves"], tiers: [
    { ilvl: 3, min: 8, max: 12, name: "of Swiftness" }, { ilvl: 12, min: 13, max: 22, name: "of Alacrity" }, { ilvl: 22, min: 23, max: 35, name: "of Fervor" }] }),
  A({ id: "s_cs", kind: "suffix", stat: "cs_pct", slots: ["weapon", "amulet", "helm"], tiers: [
    { ilvl: 3, min: 8, max: 12, name: "of Focus" }, { ilvl: 12, min: 13, max: 22, name: "of Channeling" }, { ilvl: 22, min: 23, max: 35, name: "of the Zealot" }] }),
  A({ id: "s_move", kind: "suffix", stat: "move_pct", slots: ["boots"], tiers: [
    { ilvl: 1, min: 8, max: 12, name: "of Pacing" }, { ilvl: 8, min: 13, max: 20, name: "of Haste" }, { ilvl: 18, min: 21, max: 30, name: "of the Zephyr" }] }),
  A({ id: "s_ls", kind: "suffix", stat: "lifesteal", slots: ["weapon", "ring", "amulet"], tiers: [
    { ilvl: 6, min: 2, max: 3, name: "of the Leech" }, { ilvl: 15, min: 4, max: 6, name: "of the Lamprey" }, { ilvl: 25, min: 7, max: 9, name: "of the Vampire" }] }),
  A({ id: "s_ms", kind: "suffix", stat: "manasteal", slots: ["weapon", "ring", "amulet"], tiers: [
    { ilvl: 6, min: 2, max: 4, name: "of the Bat" }, { ilvl: 16, min: 5, max: 8, name: "of the Specter" }] }),
  A({ id: "s_rf", kind: "suffix", stat: "res_fire", slots: ["any"], tiers: [
    { ilvl: 1, min: 5, max: 12, name: "of Warmth" }, { ilvl: 9, min: 13, max: 24, name: "of the Dragon" }, { ilvl: 19, min: 25, max: 40, name: "of the Phoenix" }] }),
  A({ id: "s_rc", kind: "suffix", stat: "res_cold", slots: ["any"], tiers: [
    { ilvl: 1, min: 5, max: 12, name: "of Frost" }, { ilvl: 9, min: 13, max: 24, name: "of the Glacier" }, { ilvl: 19, min: 25, max: 40, name: "of the North" }] }),
  A({ id: "s_rl", kind: "suffix", stat: "res_light", slots: ["any"], tiers: [
    { ilvl: 1, min: 5, max: 12, name: "of Sparks" }, { ilvl: 9, min: 13, max: 24, name: "of the Storm" }, { ilvl: 19, min: 25, max: 40, name: "of Thunder" }] }),
  A({ id: "s_rp", kind: "suffix", stat: "res_pois", slots: ["any"], tiers: [
    { ilvl: 1, min: 5, max: 12, name: "of Brine" }, { ilvl: 9, min: 13, max: 24, name: "of the Serpent" }, { ilvl: 19, min: 25, max: 40, name: "of the Hydra" }] }),
  A({ id: "s_regen", kind: "suffix", stat: "regen_life", slots: ["any"], tiers: [
    { ilvl: 2, min: 1, max: 2, name: "of Mending" }, { ilvl: 12, min: 3, max: 5, name: "of Restoration" }] }),
  A({ id: "s_skill", kind: "suffix", stat: "skill_lvl", slots: ["weapon", "amulet", "helm"], tiers: [
    { ilvl: 12, min: 1, max: 1, name: "of Mastery" }, { ilvl: 26, min: 1, max: 2, name: "of the Grandmaster" }] }),
];

// ============================== UNIQUES ==============================
export const UNIQUES: UniqueDef[] = [
  { id: "u_gutter", name: "Gutterfang", base: "shortsword", reqIlvl: 3, mods: [
    { stat: "dmg_pct", v: 60 }, { stat: "pois_dmg", v: 10 }, { stat: "lifesteal", v: 4 }, { stat: "as_pct", v: 15 }] },
  { id: "u_pyre", name: "Pyrelight", base: "gnarledstaff", reqIlvl: 4, mods: [
    { stat: "spell_pct", v: 30 }, { stat: "fire_dmg", v: 12 }, { stat: "skill_lvl", v: 1 }, { stat: "mana", v: 25 }] },
  { id: "u_hide", name: "Wyrmhide", base: "leatherarmor", reqIlvl: 5, mods: [
    { stat: "def_pct", v: 80 }, { stat: "res_all", v: 12 }, { stat: "life", v: 30 }] },
  { id: "u_march", name: "Gravemarch", base: "lboots", reqIlvl: 6, mods: [
    { stat: "move_pct", v: 25 }, { stat: "res_pois", v: 25 }, { stat: "dex", v: 8 }, { stat: "mf", v: 15 }] },
  { id: "u_maul", name: "Ogrebreaker", base: "warhammer", reqIlvl: 12, mods: [
    { stat: "dmg_pct", v: 130 }, { stat: "str", v: 12 }, { stat: "dmg_max", v: 10 }] },
  { id: "u_veil", name: "Duskveil", base: "helm", reqIlvl: 13, mods: [
    { stat: "skill_lvl", v: 1 }, { stat: "cs_pct", v: 20 }, { stat: "res_all", v: 10 }, { stat: "regen_mana", v: 4 }] },
  { id: "u_loop", name: "Ouroboros Loop", base: "ring", reqIlvl: 8, mods: [
    { stat: "lifesteal", v: 4 }, { stat: "manasteal", v: 4 }, { stat: "life", v: 20 }, { stat: "mana", v: 20 }] },
  { id: "u_eye", name: "Eye of the Storm", base: "amulet", reqIlvl: 15, mods: [
    { stat: "light_dmg", v: 30 }, { stat: "spell_pct", v: 20 }, { stat: "res_light", v: 30 }, { stat: "skill_lvl", v: 1 }] },
  { id: "u_aegis", name: "Cindershield Aegis", base: "kiteshield", reqIlvl: 14, mods: [
    { stat: "def_pct", v: 100 }, { stat: "res_fire", v: 40 }, { stat: "life", v: 40 }] },
  { id: "u_blade", name: "Night's Edge", base: "warblade", reqIlvl: 24, mods: [
    { stat: "dmg_pct", v: 180 }, { stat: "cold_dmg", v: 30 }, { stat: "as_pct", v: 25 }, { stat: "lifesteal", v: 6 }] },
  { id: "u_crown", name: "Crown of the Deep", base: "grimcasque", reqIlvl: 26, mods: [
    { stat: "skill_lvl", v: 2 }, { stat: "life", v: 60 }, { stat: "res_all", v: 15 }, { stat: "mf", v: 25 }] },
  { id: "u_plate", name: "Heart of Grimspire", base: "dreadplate", reqIlvl: 28, mods: [
    { stat: "def_pct", v: 140 }, { stat: "life", v: 90 }, { stat: "res_all", v: 20 }, { stat: "skill_lvl", v: 1 }] },
];

// ============================== SETS ==============================
export const SETS: SetDef[] = [
  {
    id: "set_wolf", name: "The Wolfpack",
    pieces: [
      { base: "helm", name: "Wolfpack Visage", mods: [{ stat: "life", v: 25 }, { stat: "as_pct", v: 10 }] },
      { base: "chainmail", name: "Wolfpack Hide", mods: [{ stat: "def_pct", v: 60 }, { stat: "str", v: 8 }] },
      { base: "broadsword", name: "Wolfpack Claw", mods: [{ stat: "dmg_pct", v: 80 }, { stat: "lifesteal", v: 4 }] },
    ],
    bonuses: [
      [{ stat: "as_pct", v: 15 }, { stat: "move_pct", v: 10 }],
      [{ stat: "dmg_pct", v: 60 }, { stat: "life", v: 60 }, { stat: "res_all", v: 15 }],
    ],
  },
  {
    id: "set_arc", name: "Arcanist's Vestments",
    pieces: [
      { base: "runestaff", name: "Arcanist's Reach", mods: [{ stat: "spell_pct", v: 30 }, { stat: "cs_pct", v: 15 }] },
      { base: "amulet", name: "Arcanist's Sigil", mods: [{ stat: "mana", v: 40 }, { stat: "regen_mana", v: 4 }] },
    ],
    bonuses: [
      [{ stat: "skill_lvl", v: 2 }, { stat: "spell_pct", v: 30 }, { stat: "res_all", v: 12 }],
    ],
  },
];

// ============================== RUNEWORDS ==============================
export const RUNEWORDS: RunewordDef[] = [
  { id: "rw_kindle", name: "Kindle", runes: ["rune_ash", "rune_cinder"], slots: ["weapon"], mods: [
    { stat: "fire_dmg", v: 20 }, { stat: "dmg_pct", v: 35 }, { stat: "as_pct", v: 10 }] },
  { id: "rw_stone", name: "Stoneheart", runes: ["rune_bone", "rune_grim"], slots: ["body", "helm"], mods: [
    { stat: "def_pct", v: 60 }, { stat: "life", v: 45 }, { stat: "res_all", v: 8 }] },
  { id: "rw_sanct", name: "Sanctuary", runes: ["rune_dusk", "rune_bone"], slots: ["shield"], mods: [
    { stat: "res_all", v: 18 }, { stat: "def_pct", v: 45 }, { stat: "regen_life", v: 3 }] },
  { id: "rw_tempest", name: "Tempest", runes: ["rune_cinder", "rune_dusk", "rune_hex"], slots: ["weapon"], mods: [
    { stat: "light_dmg", v: 45 }, { stat: "cs_pct", v: 25 }, { stat: "skill_lvl", v: 1 }, { stat: "spell_pct", v: 25 }] },
  { id: "rw_obliv", name: "Oblivion", runes: ["rune_grim", "rune_hex", "rune_ember"], slots: ["weapon"], mods: [
    { stat: "dmg_pct", v: 150 }, { stat: "lifesteal", v: 7 }, { stat: "skill_lvl", v: 1 }, { stat: "light_dmg", v: 30 }] },
];

// ============================== SKILLS ==============================
export const SKILLS: Record<string, SkillDef> = {};
function sk(s: SkillDef) { SKILLS[s.id] = s; }

// Warlord
sk({ id: "bash", name: "Bash", cls: "warlord", reqLvl: 1, kind: "melee", element: "phys", mana: 2, wd: 1.6, base: 3, perLvl: 3, desc: "A crushing blow dealing heavy weapon damage.", icon: "bash" });
sk({ id: "sweep", name: "Sweep", cls: "warlord", reqLvl: 1, kind: "nova", element: "phys", mana: 4, manaPerLvl: 0.15, wd: 0.85, base: 1, perLvl: 2, radius: 2.4, desc: "Whirl your weapon in a full circle, striking every nearby enemy.", icon: "sweep" });
sk({ id: "cleave", name: "Cleave", cls: "warlord", reqLvl: 6, kind: "melee", element: "phys", mana: 4, wd: 1.2, base: 2, perLvl: 3, radius: 2.2, desc: "Sweeping arc that strikes all enemies in front of you.", icon: "cleave" });
sk({ id: "slam", name: "Seismic Slam", cls: "warlord", reqLvl: 12, kind: "ground", element: "phys", mana: 8, manaPerLvl: 0.3, wd: 1.9, base: 8, perLvl: 6, radius: 2.8, cooldown: 1.2, desc: "Smash the earth, damaging all nearby enemies.", icon: "slam" });
sk({ id: "warcry", name: "Battle Cry", cls: "warlord", reqLvl: 18, kind: "buff", mana: 12, duration: 12, buff: { stat: "dmg_pct", v: 30, perLvl: 8 }, desc: "A rallying shout that boosts your damage.", icon: "warcry" });
sk({ id: "whirlwind", name: "Whirlwind", cls: "warlord", reqLvl: 24, kind: "spin", element: "phys", mana: 12, manaPerLvl: 0.4, wd: 0.6, base: 2, perLvl: 3, radius: 1.8, duration: 1.6, cooldown: 2.5, desc: "Become a spinning storm of steel, shredding everything around you as you move.", icon: "whirlwind" });
sk({ id: "ironskin", name: "Iron Skin", cls: "warlord", reqLvl: 6, kind: "passive", mana: 0, passive: { stat: "def_pct", v: 15, perLvl: 10 }, desc: "Passive: increases defense.", icon: "ironskin" });
sk({ id: "frenzy", name: "Frenzy", cls: "warlord", reqLvl: 12, kind: "passive", mana: 0, passive: { stat: "as_pct", v: 6, perLvl: 4 }, desc: "Passive: increases attack speed.", icon: "frenzy" });

// Pyromancer
sk({ id: "firebolt", name: "Firebolt", cls: "pyromancer", reqLvl: 1, kind: "proj", element: "fire", mana: 3, manaPerLvl: 0.2, base: 6, perLvl: 4, projSpeed: 14, desc: "Hurl a bolt of fire.", icon: "firebolt" });
sk({ id: "firenova", name: "Fire Nova", cls: "pyromancer", reqLvl: 1, kind: "nova", element: "fire", mana: 5, manaPerLvl: 0.3, base: 5, perLvl: 4, radius: 2.8, desc: "A ring of flame erupts outward, scorching everything around you.", icon: "firenova" });
sk({ id: "frostnova", name: "Frost Nova", cls: "pyromancer", reqLvl: 6, kind: "nova", element: "cold", mana: 9, manaPerLvl: 0.4, base: 8, perLvl: 5, radius: 3.2, slow: 0.45, cooldown: 1.0, desc: "A ring of frost that damages and chills all around you.", icon: "frostnova" });
sk({ id: "fireball", name: "Fireball", cls: "pyromancer", reqLvl: 12, kind: "proj", element: "fire", mana: 10, manaPerLvl: 0.5, base: 16, perLvl: 9, projSpeed: 12, radius: 1.8, desc: "An explosive orb of flame with splash damage.", icon: "fireball" });
sk({ id: "teleport", name: "Teleport", cls: "pyromancer", reqLvl: 18, kind: "blink", mana: 14, cooldown: 0.8, desc: "Instantly relocate to the target point.", icon: "teleport" });
sk({ id: "chain", name: "Chain Lightning", cls: "pyromancer", reqLvl: 18, kind: "proj", element: "light", mana: 12, manaPerLvl: 0.5, base: 14, perLvl: 8, projSpeed: 15, chain: true, desc: "A bolt of lightning that leaps from enemy to enemy.", icon: "chain" });
sk({ id: "meteor", name: "Meteor", cls: "pyromancer", reqLvl: 24, kind: "ground", element: "fire", mana: 18, manaPerLvl: 0.6, base: 40, perLvl: 16, radius: 2.6, cooldown: 2.0, desc: "Call down a meteor after a short delay.", icon: "meteor" });
sk({ id: "sentinel", name: "Flame Sentinel", cls: "pyromancer", reqLvl: 24, kind: "summon", element: "fire", mana: 25, manaPerLvl: 0.5, base: 12, perLvl: 6, duration: 18, cooldown: 3, desc: "Conjure a burning totem that hurls firebolts at your enemies. Up to 2 at once.", icon: "sentinel" });
sk({ id: "warmth", name: "Warmth", cls: "pyromancer", reqLvl: 1, kind: "passive", mana: 0, passive: { stat: "regen_mana", v: 2, perLvl: 1.5 }, desc: "Passive: increases mana regeneration.", icon: "warmth" });

// ============================== MONSTERS ==============================
export const MONSTERS: Record<string, MonsterDef> = {};
function mo(m: MonsterDef) { MONSTERS[m.id] = m; }

mo({ id: "zombie", name: "Rotwalker", hp: 26, dmg: [3, 6], speed: 1.6, attackRange: 1.1, attackRate: 0.8, xp: 12, size: 0.42, spr: "zombie", aggro: 7 });
mo({ id: "skeleton", name: "Bonewretch", hp: 16, dmg: [2, 5], speed: 3.0, attackRange: 1.1, attackRate: 1.2, xp: 10, size: 0.38, spr: "skeleton", aggro: 9 });
mo({ id: "archer", name: "Gravewatch Archer", hp: 12, dmg: [3, 7], speed: 2.2, attackRange: 7, attackRate: 0.8, proj: { speed: 9, element: "phys" }, xp: 14, size: 0.38, spr: "archer", aggro: 10 });
mo({ id: "imp", name: "Ashfiend", hp: 14, dmg: [4, 8], speed: 2.6, attackRange: 6.5, attackRate: 0.7, proj: { speed: 8, element: "fire" }, xp: 16, size: 0.35, spr: "imp", aggro: 10 });
mo({ id: "bat", name: "Duskwing", hp: 7, dmg: [1, 3], speed: 4.2, attackRange: 0.9, attackRate: 1.6, xp: 6, size: 0.3, spr: "bat", aggro: 11 });
mo({ id: "brute", name: "Gravehulk", hp: 70, dmg: [8, 15], speed: 1.4, attackRange: 1.4, attackRate: 0.6, xp: 40, size: 0.6, spr: "brute", aggro: 8 });
mo({ id: "boss", name: "The Gravelord", hp: 420, dmg: [12, 22], speed: 2.0, attackRange: 1.6, attackRate: 0.9, xp: 400, size: 0.8, spr: "boss", boss: true, aggro: 14 });

export const MONSTER_AFFIXES: Record<string, MonsterAffix> = {
  fanatic: { id: "fanatic", name: "Fanatic", speedMult: 1.5, asMult: 1.4 },
  stoneskin: { id: "stoneskin", name: "Stoneskin", hpMult: 2.2 },
  blazing: { id: "blazing", name: "Blazing", dmgMult: 1.4, aura: "fire" },
  frozen: { id: "frozen", name: "Frigid", dmgMult: 1.2, aura: "cold" },
  vampiric: { id: "vampiric", name: "Vampiric", leech: true, hpMult: 1.4 },
  mighty: { id: "mighty", name: "Mighty", dmgMult: 1.6, hpMult: 1.3 },
};

// Which monsters appear at a given depth.
export function monsterPool(depth: number): string[] {
  const pool = ["zombie", "skeleton"];
  if (depth >= 2) pool.push("bat", "archer");
  if (depth >= 3) pool.push("imp");
  if (depth >= 4) pool.push("brute");
  return pool;
}

// Depth scaling — the endless endgame ladder.
export function depthHpMult(depth: number) { return 1 + (depth - 1) * 0.55 + Math.pow(Math.max(0, depth - 10), 1.6) * 0.12; }
export function depthDmgMult(depth: number) { return 1 + (depth - 1) * 0.32 + Math.pow(Math.max(0, depth - 10), 1.5) * 0.08; }
export function depthXpMult(depth: number) { return 1 + (depth - 1) * 0.45; }

export function xpForLevel(lvl: number): number {
  return Math.floor(80 * Math.pow(lvl, 2.4));
}

export const BIOMES = ["The Blighted Moor", "Emberfall Wastes", "The Frozen Reach", "Gloomwood"];

export const MAX_DEPTH_NAME = (d: number) =>
  d === 0 ? "Emberfall Refuge" :
  d % 5 === 0 ? `${BIOMES[(d - 1) % 4]} — Zone ${d} · Gravelord's Domain` : `${BIOMES[(d - 1) % 4]} — Zone ${d}`;
