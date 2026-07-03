// The Umbral Cube — Eastern Sun-style transmutation engine.
// Recipes operate on the list of items placed in the cube and return
// replacement items (or null if no recipe matches).

import { BASES, GEM_TYPES, RUNE_ORDER } from "./gamedata";
import { baseOf, makeItem, rollAffixesForCraft, rollMagic, rollRare, rollUnique } from "./items";
import { mulberry32, ri, type RNG } from "./rng";
import type { Item } from "./types";

export interface CubeResult {
  out: Item[];
  msg: string;
}

export interface RecipeDoc {
  name: string;
  inputs: string;
  output: string;
}

// Human-readable recipe book, shown in the cube panel (ES documented its
// recipes well; so do we).
export const RECIPE_BOOK: RecipeDoc[] = [
  { name: "Gem Fusion", inputs: "3 identical gems", output: "1 gem of the next grade" },
  { name: "Rune Fusion", inputs: "2 identical runes", output: "1 rune of the next rank" },
  { name: "Disenchant (magic)", inputs: "1 magic item", output: "Arcane Dust" },
  { name: "Disenchant (rare)", inputs: "1 rare item", output: "Glowing Shard + Arcane Dust" },
  { name: "Disenchant (unique/set)", inputs: "1 unique or set item", output: "Soul Ember + Arcane Dust" },
  { name: "Reroll Magic", inputs: "Magic item + 3 Arcane Dust", output: "Same base, new magic mods" },
  { name: "Reroll Rare", inputs: "Rare item + 5 Arcane Dust + 1 Glowing Shard", output: "Same base, new rare mods" },
  { name: "Empower", inputs: "3 magic items", output: "1 random rare item" },
  { name: "Add Sockets", inputs: "Normal equipment + 1 Glowing Shard", output: "Same item with sockets" },
  { name: "Blood Craft", inputs: "Magic weapon/armor + Perfect Ruby + 2 Arcane Dust", output: "Crafted item: life mods + random" },
  { name: "Storm Craft", inputs: "Magic weapon/armor + Perfect Topaz + 2 Arcane Dust", output: "Crafted item: lightning/luck mods + random" },
  { name: "Frost Craft", inputs: "Magic weapon/armor + Perfect Sapphire + 2 Arcane Dust", output: "Crafted item: mana/cold mods + random" },
  { name: "Tier Ascension", inputs: "Any equipment + Fang rune (or higher) + any Perfect gem", output: "Same item, next base tier (keeps all mods)" },
  { name: "Relic Gamble", inputs: "2 Soul Embers + 1 Glowing Shard", output: "1 random unique item" },
];

const isGem = (it: Item) => baseOf(it).kind === "gem";
const isRune = (it: Item) => baseOf(it).kind === "rune";
const isMat = (id: string) => (it: Item) => it.base === id;
const isEquip = (it: Item) => !!baseOf(it).slot;

// Expand stacks into per-unit counts for matching.
function countOf(items: Item[], pred: (it: Item) => boolean): number {
  return items.filter(pred).reduce((n, it) => n + (it.qty ?? 1), 0);
}

function take(items: Item[], pred: (it: Item) => boolean, n: number): Item[] {
  // Consumes n units matching pred from the list (mutates), returns consumed.
  const consumed: Item[] = [];
  for (const it of [...items]) {
    if (n <= 0) break;
    if (!pred(it)) continue;
    const q = it.qty ?? 1;
    const use = Math.min(q, n);
    n -= use;
    if (use >= q) items.splice(items.indexOf(it), 1);
    else it.qty = q - use;
    consumed.push(it);
  }
  return consumed;
}

export function transmute(itemsIn: Item[], seedExtra = 0): CubeResult | null {
  const items = itemsIn.map((i) => ({ ...i, socketed: [...i.socketed], mods: i.mods.map((m) => ({ ...m })) }));
  const r = mulberry32((Date.now() ^ (seedExtra * 2654435761)) >>> 0);
  const totalUnits = items.reduce((n, it) => n + (it.qty ?? 1), 0);

  // --- Gem Fusion: 3 identical gems -> next grade ---
  for (const t of GEM_TYPES) {
    for (let g = 0; g < 2; g++) {
      const id = `${t}_${g}`;
      if (countOf(items, isMat(id)) >= 3 && totalUnits === 3 && items.every((i) => i.base === id)) {
        return { out: [makeItem(`${t}_${g + 1}`)], msg: `The gems fuse into a ${BASES[`${t}_${g + 1}`].name}!` };
      }
    }
  }

  // --- Rune Fusion: 2 identical runes -> next rank ---
  for (let i = 0; i < RUNE_ORDER.length - 1; i++) {
    const id = `rune_${RUNE_ORDER[i]}`;
    if (countOf(items, isMat(id)) >= 2 && totalUnits === 2 && items.every((x) => x.base === id)) {
      const next = `rune_${RUNE_ORDER[i + 1]}`;
      return { out: [makeItem(next)], msg: `The runes merge into ${BASES[next].name}!` };
    }
  }

  // --- Tier Ascension: equipment + fang+ rune + perfect gem -> next tier base ---
  if (items.length === 3) {
    const eq = items.find((i) => isEquip(i) && baseOf(i).next);
    const rune = items.find((i) => isRune(i) && RUNE_ORDER.indexOf(i.base.replace("rune_", "")) >= RUNE_ORDER.indexOf("fang"));
    const gem = items.find((i) => isGem(i) && i.base.endsWith("_2"));
    if (eq && rune && gem) {
      const upgraded: Item = { ...eq, base: baseOf(eq).next! };
      if (upgraded.rarity === "normal") upgraded.name = BASES[upgraded.base].name;
      return { out: [upgraded], msg: `${eq.name} ascends to a higher tier!` };
    }
  }

  // --- Relic Gamble: 2 soul embers + shard -> random unique ---
  if (countOf(items, isMat("soulember")) >= 2 && countOf(items, isMat("shard")) >= 1 && totalUnits === 3) {
    const u = rollUnique(r, ri(r, 8, 30));
    if (u) return { out: [u], msg: `The embers coalesce into ${u.name}!` };
  }

  // --- Crafts: magic equip + perfect gem + 2 dust ---
  {
    const eq = items.find((i) => isEquip(i) && i.rarity === "magic");
    const gem = items.find((i) => isGem(i) && i.base.endsWith("_2"));
    const dust = countOf(items, isMat("dust"));
    const nonDust = items.filter((i) => i.base !== "dust").length;
    if (eq && gem && dust === 2 && nonDust === 2) {
      const type = gem.base.split("_")[0];
      const crafted = craftItem(r, eq, type);
      if (crafted) return { out: [crafted], msg: `The cube forges ${crafted.name}!` };
    }
  }

  // --- Reroll Rare: rare + 5 dust + 1 shard ---
  {
    const eq = items.find((i) => isEquip(i) && i.rarity === "rare");
    if (eq && countOf(items, isMat("dust")) >= 5 && countOf(items, isMat("shard")) >= 1) {
      const rerolled = rollRare(r, eq.base, Math.max(eq.ilvl, 1));
      return { out: [rerolled], msg: "Fate reshuffles the item's power!" };
    }
  }

  // --- Reroll Magic: magic + 3 dust ---
  {
    const eq = items.find((i) => isEquip(i) && i.rarity === "magic");
    if (eq && countOf(items, isMat("dust")) >= 3) {
      const rerolled = rollMagic(r, eq.base, Math.max(eq.ilvl, 1));
      return { out: [rerolled], msg: "Fate reshuffles the item's power!" };
    }
  }

  // --- Add Sockets: normal equip + shard ---
  if (items.length === 2) {
    const eq = items.find((i) => isEquip(i) && i.rarity === "normal" && baseOf(i).maxSockets && i.socketed.length === 0);
    const shard = items.find(isMat("shard"));
    if (eq && shard && (shard.qty ?? 1) === 1) {
      const max = baseOf(eq).maxSockets!;
      const upgraded = { ...eq, sockets: ri(r, Math.min(2, max), max) };
      return { out: [upgraded], msg: `The item now has ${upgraded.sockets} sockets!` };
    }
  }

  // --- Empower: 3 magic items -> 1 rare ---
  {
    const magics = items.filter((i) => isEquip(i) && i.rarity === "magic");
    if (magics.length === 3 && items.length === 3) {
      const ilvl = Math.max(...magics.map((m) => m.ilvl));
      const out = rollRare(r, magics[Math.floor(r() * 3)].base, ilvl);
      return { out: [out], msg: `The essences combine into ${out.name}!` };
    }
  }

  // --- Disenchant: single item alone ---
  if (items.length === 1 && isEquip(items[0]) && (items[0].qty ?? 1) === 1) {
    const it = items[0];
    if (it.rarity === "magic") {
      return { out: [makeItem("dust", "normal", ri(r, 1, 2))], msg: "The item dissolves into Arcane Dust." };
    }
    if (it.rarity === "rare" || it.rarity === "crafted") {
      return { out: [makeItem("shard"), makeItem("dust", "normal", ri(r, 1, 3))], msg: "The item shatters into glowing fragments." };
    }
    if (it.rarity === "unique" || it.rarity === "set") {
      return { out: [makeItem("soulember"), makeItem("dust", "normal", ri(r, 2, 4))], msg: "A soul ember rises from the ashes." };
    }
  }

  return null;
}

// Crafted (orange) items: fixed theme mods + 1-2 random affixes.
const CRAFT_THEMES: Record<string, { name: string; mods: (r: RNG, ilvl: number) => { stat: string; v: number }[] }> = {
  ruby: {
    name: "Blood", mods: (r, ilvl) => [
      { stat: "life", v: ri(r, 10, 20 + ilvl * 2) },
      { stat: "lifesteal", v: ri(r, 2, 4) },
    ],
  },
  topaz: {
    name: "Storm", mods: (r, ilvl) => [
      { stat: "light_dmg", v: ri(r, 6, 10 + ilvl) },
      { stat: "mf", v: ri(r, 5, 10 + ilvl) },
    ],
  },
  sapphire: {
    name: "Frost", mods: (r, ilvl) => [
      { stat: "mana", v: ri(r, 10, 20 + ilvl * 2) },
      { stat: "cold_dmg", v: ri(r, 4, 8 + ilvl) },
    ],
  },
  emerald: {
    name: "Venom", mods: (r, ilvl) => [
      { stat: "pois_dmg", v: ri(r, 6, 10 + ilvl) },
      { stat: "dex", v: ri(r, 3, 6 + Math.floor(ilvl / 3)) },
    ],
  },
  skull: {
    name: "Bone", mods: (r, ilvl) => [
      { stat: "lifesteal", v: ri(r, 2, 4) },
      { stat: "manasteal", v: ri(r, 2, 4) },
    ],
  },
};

function craftItem(r: RNG, src: Item, gemType: string): Item | null {
  const theme = CRAFT_THEMES[gemType];
  if (!theme) return null;
  const ilvl = Math.max(src.ilvl, 1);
  const it = makeItem(src.base, "crafted");
  it.ilvl = ilvl;
  const fixed = theme.mods(r, ilvl).map((m) => ({ stat: m.stat as any, v: m.v }));
  const random = rollAffixesForCraft(r, baseOf(it), ilvl, ri(r, 1, 2));
  it.mods = [...fixed, ...random];
  it.name = `${theme.name} ${BASES[src.base].name}`;
  return it;
}
