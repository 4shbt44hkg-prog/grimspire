// Core shared types for Grimspire.

export type Rarity = "normal" | "magic" | "rare" | "crafted" | "unique" | "set";

export type Slot =
  | "weapon" | "offhand" | "helm" | "body" | "gloves" | "boots" | "belt" | "ring" | "amulet";

export type ItemKind =
  | "sword" | "axe" | "mace" | "staff" | "shield" | "armor" | "helm" | "gloves" | "boots" | "belt"
  | "ring" | "amulet" | "gem" | "rune" | "mat" | "potion";

// Every stat an affix/gem/rune can grant.
export type StatId =
  | "dmg_pct" | "dmg_min" | "dmg_max" | "as_pct" | "cs_pct"
  | "fire_dmg" | "cold_dmg" | "light_dmg" | "pois_dmg"
  | "life" | "mana" | "str" | "dex" | "vit" | "ene"
  | "def" | "def_pct"
  | "res_fire" | "res_cold" | "res_light" | "res_pois" | "res_all"
  | "mf" | "move_pct" | "lifesteal" | "manasteal"
  | "regen_life" | "regen_mana" | "skill_lvl" | "spell_pct" | "gold_pct";

export interface Mod {
  stat: StatId;
  v: number;
}

export interface Item {
  id: string;
  base: string;           // BaseItem id
  rarity: Rarity;
  name: string;           // display name
  ilvl: number;
  mods: Mod[];            // rolled/fixed mods (not incl. socketed)
  sockets: number;
  socketed: Item[];       // gems / runes
  runeword?: string;      // runeword id once completed
  setId?: string;
  qty?: number;           // stackables (gems, runes, mats, potions)
}

export interface BaseItem {
  id: string;
  name: string;
  slot?: Slot;
  kind: ItemKind;
  tier: 1 | 2 | 3;
  next?: string;          // next tier base id (ES gear upgrading)
  dmg?: [number, number];
  def?: number;
  maxSockets?: number;
  reqLvl: number;
  twoHand?: boolean;
  caster?: boolean;       // staves boost spell damage
  stack?: number;         // max stack size
  w: number;              // inventory grid width
  h: number;
  spr: string;            // sprite key
  potion?: { hp?: number; mp?: number };
}

export interface AffixTier {
  ilvl: number;           // min ilvl for this tier
  min: number;
  max: number;
  name: string;           // "Sturdy", "of the Fox", ...
}

export interface Affix {
  id: string;
  kind: "prefix" | "suffix";
  stat: StatId;
  slots: (Slot | "any" | "weaponish" | "armorish")[]; // where it may roll
  tiers: AffixTier[];
}

export interface UniqueDef {
  id: string;
  name: string;
  base: string;
  reqIlvl: number;
  mods: Mod[];
}

export interface SetDef {
  id: string;
  name: string;
  pieces: { base: string; name: string; mods: Mod[] }[];
  // bonuses[k] applies when k+2 pieces are worn
  bonuses: Mod[][];
}

export interface RunewordDef {
  id: string;
  name: string;
  runes: string[];        // rune base ids, in order
  slots: ("weapon" | "shield" | "body" | "helm")[];
  mods: Mod[];
}

// ---- Skills ----
export type SkillKind = "melee" | "proj" | "nova" | "ground" | "buff" | "blink" | "passive" | "spin" | "summon";

export interface SkillDef {
  id: string;
  name: string;
  cls: "warlord" | "pyromancer";
  reqLvl: number;
  kind: SkillKind;
  element?: "phys" | "fire" | "cold" | "light" | "pois";
  mana: number;
  manaPerLvl?: number;
  // damage = weaponAvg * wd + base + perLvl * (lvl-1)   (phys skills)
  // damage = base + perLvl * (lvl-1)                    (spells)
  wd?: number;
  base?: number;
  perLvl?: number;
  radius?: number;        // aoe / nova radius (tiles)
  projSpeed?: number;
  cooldown?: number;      // seconds
  duration?: number;      // buffs
  buff?: { stat: StatId; v: number; perLvl: number };
  passive?: { stat: StatId; v: number; perLvl: number };
  slow?: number;          // cold slow fraction
  chain?: boolean;        // projectile jumps between enemies
  desc: string;
  icon: string;
}

// ---- Monsters ----
export interface MonsterDef {
  id: string;
  name: string;
  hp: number;             // at depth 1, scales up
  dmg: [number, number];
  speed: number;          // tiles/sec
  attackRange: number;
  attackRate: number;     // attacks/sec
  proj?: { speed: number; element: "phys" | "fire" | "cold" | "light" | "pois" };
  xp: number;
  size: number;           // radius, tiles
  spr: string;
  boss?: boolean;
  aggro: number;          // sight range
  // ---- behavior depth ----
  heal?: number;          // heals nearby allies this much per pulse (support enemy)
  charge?: { windup: number; speed: number; dmgMult: number; cooldown: number }; // telegraphed rush
  splitInto?: { def: string; count: number }; // spawns on death
  chillOnHit?: number;    // slows the player's movement for this many seconds
}

export interface MonsterAffix {
  id: string;
  name: string;
  hpMult?: number;
  dmgMult?: number;
  speedMult?: number;
  asMult?: number;
  aura?: "fire" | "cold";
  leech?: boolean;
}

// ---- Map ----
export const T_VOID = 0;
export const T_FLOOR = 1;
export const T_WALL = 2;
export const T_WATER = 3;

export interface MapObject {
  id: string;
  type: "stairs_down" | "stairs_up" | "chest" | "shrine" | "stash" | "well" | "waypoint" | "torch" | "vendor" | "gambler";
  x: number;
  y: number;
  used?: boolean;
  shrineKind?: string;
}

export interface GameMap {
  w: number;
  h: number;
  tiles: Uint8Array;      // T_VOID / T_FLOOR / T_WALL
  variant: Uint8Array;    // visual variety
  objects: MapObject[];
  spawnX: number;
  spawnY: number;
  packs: { x: number; y: number; count: number }[]; // monster pack seeds (server uses)
  theme: number;
}

// ---- Net entities ----
export interface PlayerPub {
  id: string;
  name: string;
  cls: "warlord" | "pyromancer";
  lvl: number;
  x: number;
  y: number;
  depth: number;
  anim: string;
  dir: number;
  hp: number;             // fraction 0..1 for party display
  dead?: boolean;
}

export interface MonsterState {
  id: string;
  def: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  affixes: string[];      // MonsterAffix ids
  rare?: boolean;
  champ?: boolean;
  boss?: boolean;
  slow?: number;
  dir: number;
  anim: string;
  lvl: number;
}

export interface ProjState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  element: string;
  friendly: boolean;
  spr: string;
}

export interface GroundItem {
  gid: string;
  item: Item;
  x: number;
  y: number;
}

export interface SentinelState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  until: number;          // remaining lifetime in seconds
}

// Derived combat stats the client syncs to the server (trust-based co-op).
export interface CombatStats {
  lvl: number;
  minDmg: number;
  maxDmg: number;
  eleDmg: { fire: number; cold: number; light: number; pois: number };
  asPct: number;
  csPct: number;
  spellPct: number;
  lifesteal: number;
  manasteal: number;
  mf: number;
  goldPct: number;
  def: number;
  res: { fire: number; cold: number; light: number; pois: number };
  maxLife: number;
  skillLvls: Record<string, number>;
}
