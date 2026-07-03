import { BASES, SETS, SKILLS, RUNEWORDS, xpForLevel } from "../shared/gamedata";
import { RECIPE_BOOK, transmute } from "../shared/craft";
import { baseOf, canSocketInto, checkRuneword, gambleItem, gamblePrice, itemValue, makeItem, RARITY_COLOR, socketMods, STAT_LABEL } from "../shared/items";
import { mulberry32 } from "../shared/rng";
import type { Slot } from "../shared/types";
import type { Item } from "../shared/types";
import {
  addToGrid, canPlace, computeDerived, CUBE_H, CUBE_W, drinkBelt, findSpot, G, INV_H, INV_W, IS_TOUCH,
  itemAt, markStatsDirty, type Placed, saveChar, selIdx, setSelIdx, STASH_H, STASH_W, syncStats, currentSkill, respawn, townPortal,
} from "./game";
import { touchRefresh } from "./touch";
import { SFX } from "./sound";
import { copySkillIcon, getSprite } from "./sprites";

const CELL = IS_TOUCH ? 25 : 28;
const $ = (id: string) => document.getElementById(id)!;

const openPanels = new Set<string>();

export function togglePanel(name: string, force?: boolean) {
  const el = $(`panel-${name}`);
  const open = force ?? el.classList.contains("hidden");
  if (open) {
    el.classList.remove("hidden");
    openPanels.add(name);
    rebuildPanel(name);
  } else {
    el.classList.add("hidden");
    openPanels.delete(name);
  }
}

export function closeAllPanels() {
  for (const p of ["char", "inv", "skills", "cube", "stash", "wp", "vendor", "gamble"]) togglePanel(p, false);
}

export function anyPanelOpen() { return openPanels.size > 0; }

function rebuildPanel(name: string) {
  if (name === "inv") rebuildInv();
  else if (name === "char") rebuildChar();
  else if (name === "skills") rebuildSkills();
  else if (name === "cube") rebuildCube();
  else if (name === "stash") rebuildStash();
  else if (name === "wp") rebuildWaypoint();
  else if (name === "vendor") rebuildVendor();
  else if (name === "gamble") rebuildGamble();
}

export function refreshOpenPanels() {
  for (const p of openPanels) rebuildPanel(p);
  refreshHUD();
  renderHeld();
}

// ---------------- item icon ----------------
function itemIcon(it: Item, cellW: number, cellH: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = cellW; c.height = cellH;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  const spr = getSprite(baseOf(it).spr);
  const sc = Math.min((cellW - 4) / spr.width, (cellH - 4) / spr.height);
  const w = spr.width * sc, h = spr.height * sc;
  g.drawImage(spr, (cellW - w) / 2, (cellH - h) / 2, w, h);
  // rarity tint frame
  g.strokeStyle = RARITY_COLOR[it.rarity] + "88";
  if (it.rarity !== "normal") g.strokeRect(0.5, 0.5, cellW - 1, cellH - 1);
  if (it.sockets > 0) {
    g.fillStyle = "#c8c8e8";
    for (let i = 0; i < it.sockets; i++) {
      g.beginPath();
      g.arc(6 + i * 8, cellH - 6, 2.5, 0, 7);
      g.globalAlpha = i < it.socketed.length ? 1 : 0.35;
      g.fill();
    }
    g.globalAlpha = 1;
  }
  return c;
}

// ---------------- tooltip ----------------
const tooltip = $("tooltip");

export function showItemTooltip(it: Item, mx: number, my: number) {
  const b = baseOf(it);
  const lines: string[] = [];
  const nameColor = RARITY_COLOR[it.rarity];
  lines.push(`<div class="iname" style="color:${nameColor}">${esc(it.name)}</div>`);
  if (it.rarity !== "normal" || it.runeword) lines.push(`<div class="base">${esc(b.name)}</div>`);
  if (b.dmg) lines.push(`<div class="base">Damage: ${b.dmg[0]}–${b.dmg[1]}${b.twoHand ? " (two-handed)" : ""}</div>`);
  if (b.def) lines.push(`<div class="base">Defense: ${b.def}</div>`);
  if (b.potion) lines.push(`<div class="mod">Restores ${b.potion.hp ? b.potion.hp + " life" : b.potion.mp + " mana"}</div>`);
  if (b.kind === "gem") {
    const w = socketMods({ ...it }, BASES.shortsword);
    const a = socketMods({ ...it }, BASES.leatherarmor);
    lines.push(`<div class="mod">Weapon: ${STAT_LABEL[w[0].stat](w[0].v)}</div>`);
    lines.push(`<div class="mod">Armor: ${STAT_LABEL[a[0].stat](a[0].v)}</div>`);
    lines.push(`<div class="dim">Socket into an item, or cube 3 to upgrade</div>`);
  } else if (b.kind === "rune") {
    const w = socketMods({ ...it }, BASES.shortsword);
    const a = socketMods({ ...it }, BASES.leatherarmor);
    lines.push(`<div class="mod">Weapon: ${STAT_LABEL[w[0].stat](w[0].v)}</div>`);
    lines.push(`<div class="mod">Armor: ${STAT_LABEL[a[0].stat](a[0].v)}</div>`);
    const words = RUNEWORDS.filter((rw) => rw.runes.includes(it.base));
    for (const rw of words) {
      lines.push(`<div class="dim">Runeword "${rw.name}": ${rw.runes.map((r) => BASES[r].name.replace(" Rune", "")).join(" + ")} (${rw.slots.join("/")})</div>`);
    }
  } else if (b.kind === "mat") {
    if (it.base === "dust") lines.push(`<div class="dim">Crafting reagent — rerolls and crafts (see cube recipes)</div>`);
    if (it.base === "shard") lines.push(`<div class="dim">Crafting reagent — sockets and rare rerolls</div>`);
    if (it.base === "soulember") lines.push(`<div class="dim">Rare reagent — gamble uniques (2 embers + shard)</div>`);
  }
  for (const m of it.mods) lines.push(`<div class="mod">${STAT_LABEL[m.stat](m.v)}</div>`);
  for (const s of it.socketed) {
    const sm = socketMods(s, b);
    lines.push(`<div class="rw">◆ ${esc(s.name)}: ${sm.map((m) => STAT_LABEL[m.stat](m.v)).join(", ")}</div>`);
  }
  if (it.runeword) {
    const rw = RUNEWORDS.find((r) => r.id === it.runeword);
    if (rw) for (const m of rw.mods) lines.push(`<div class="mod">${STAT_LABEL[m.stat](m.v)}</div>`);
  }
  if (it.sockets > 0) lines.push(`<div class="dim">Sockets: ${it.socketed.length}/${it.sockets}</div>`);
  if (it.setId) {
    const set = SETS.find((s) => s.id === it.setId);
    if (set) {
      lines.push(`<div class="setb">${esc(set.name)} (${countWornSet(it.setId)}/${set.pieces.length} worn)</div>`);
      set.bonuses.forEach((bonus, i) => {
        lines.push(`<div class="dim">(${i + 2} pieces) ${bonus.map((m) => STAT_LABEL[m.stat](m.v)).join(", ")}</div>`);
      });
    }
  }
  if (b.reqLvl > 1) {
    const ok = (G.char?.lvl ?? 1) >= b.reqLvl;
    lines.push(`<div style="color:${ok ? "#6d6046" : "#d05050"}" class="dim">Requires level ${b.reqLvl}</div>`);
  }
  if ((it.qty ?? 1) > 1) lines.push(`<div class="dim">Quantity: ${it.qty}</div>`);
  if (openPanels.has("vendor") && it.base !== "gold") {
    lines.push(`<div style="color:#e8c860" class="dim">Sells for ${itemValue(it)} gold (right-click)</div>`);
  }
  tooltip.innerHTML = lines.join("");
  tooltip.classList.remove("hidden");
  positionTooltip(mx, my);
}

function countWornSet(setId: string): number {
  let n = 0;
  for (const k of Object.keys(G.char?.equip ?? {})) if (G.char!.equip[k]?.setId === setId) n++;
  return n;
}

export function positionTooltip(mx: number, my: number) {
  const r = tooltip.getBoundingClientRect();
  let x = mx + 16, y = my - r.height - 8;
  if (x + r.width > window.innerWidth) x = mx - r.width - 12;
  if (y < 4) y = my + 20;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

export function hideTooltip() {
  tooltip.classList.add("hidden");
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

// ---------------- held item (cursor carry) ----------------
const heldEl = $("held-item");

export function renderHeld() {
  if (!G.heldItem) {
    heldEl.classList.add("hidden");
    heldEl.innerHTML = "";
    return;
  }
  const b = baseOf(G.heldItem);
  heldEl.innerHTML = "";
  heldEl.appendChild(itemIcon(G.heldItem, b.w * CELL, b.h * CELL));
  heldEl.classList.remove("hidden");
}

document.addEventListener("mousemove", (e) => {
  if (G.heldItem) {
    const b = baseOf(G.heldItem);
    heldEl.style.left = `${e.clientX - (b.w * CELL) / 2}px`;
    heldEl.style.top = `${e.clientY - (b.h * CELL) / 2}px`;
  }
  if (!tooltip.classList.contains("hidden")) positionTooltip(e.clientX, e.clientY);
});

// Long-press an item on touch devices to read its tooltip (suppresses the
// synthesized click so nothing gets picked up by accident).
function attachLongPressTooltip(el: HTMLElement, getItem: () => Item | undefined) {
  if (!IS_TOUCH) return;
  let timer = 0;
  let shown = false;
  el.addEventListener("touchstart", (e) => {
    shown = false;
    const t = e.touches[0];
    timer = window.setTimeout(() => {
      const it = getItem();
      if (it) {
        shown = true;
        showItemTooltip(it, t.clientX, t.clientY);
      }
    }, 380);
  }, { passive: true });
  const done = (e: TouchEvent) => {
    clearTimeout(timer);
    if (shown) {
      e.preventDefault();
      setTimeout(hideTooltip, 1600);
    }
  };
  el.addEventListener("touchend", done, { passive: false });
  el.addEventListener("touchmove", () => clearTimeout(timer), { passive: true });
  el.addEventListener("touchcancel", () => clearTimeout(timer));
}

// ---------------- generic grid builder ----------------
function buildGrid(list: Placed[], gw: number, gh: number, gridName: string): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "grid";
  grid.style.width = `${gw * CELL}px`;
  grid.style.height = `${gh * CELL}px`;
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const cell = document.createElement("div");
      cell.className = "gridcell";
      cell.style.left = `${x * CELL}px`;
      cell.style.top = `${y * CELL}px`;
      cell.style.width = `${CELL}px`;
      cell.style.height = `${CELL}px`;
      grid.appendChild(cell);
    }
  for (const p of list) {
    const b = BASES[p.item.base];
    const el = document.createElement("div");
    el.className = "griditem";
    el.style.left = `${p.x * CELL}px`;
    el.style.top = `${p.y * CELL}px`;
    el.style.width = `${b.w * CELL}px`;
    el.style.height = `${b.h * CELL}px`;
    el.appendChild(itemIcon(p.item, b.w * CELL, b.h * CELL));
    if ((p.item.qty ?? 1) > 1) {
      const q = document.createElement("span");
      q.className = "qty";
      q.textContent = String(p.item.qty);
      el.appendChild(q);
    }
    el.addEventListener("mouseenter", (e) => { if (!G.heldItem) showItemTooltip(p.item, e.clientX, e.clientY); });
    el.addEventListener("mouseleave", hideTooltip);
    attachLongPressTooltip(el, () => p.item);
    grid.appendChild(el);
  }
  grid.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const r = grid.getBoundingClientRect();
    const cx = Math.floor((e.clientX - r.left) / CELL);
    const cy = Math.floor((e.clientY - r.top) / CELL);
    clickGrid(gridName, list, gw, gh, cx, cy, e.button, e.shiftKey);
  });
  grid.addEventListener("contextmenu", (e) => e.preventDefault());
  return grid;
}

function gridsOf(name: string): { list: Placed[]; gw: number; gh: number } {
  const c = G.char!;
  if (name === "inv") return { list: c.inv, gw: INV_W, gh: INV_H };
  if (name === "stash") return { list: c.stash, gw: STASH_W, gh: STASH_H };
  return { list: c.cube, gw: CUBE_W, gh: CUBE_H };
}

function clickGrid(gridName: string, list: Placed[], gw: number, gh: number, cx: number, cy: number, button: number, shift: boolean) {
  const c = G.char!;
  const under = itemAt(list, cx, cy);

  if (G.heldItem) {
    const held = G.heldItem;
    // socket a gem/rune into the item under the cursor
    if (under && canSocketInto(held, under.item)) {
      const one: Item = { ...held, qty: 1, socketed: [] };
      under.item.socketed.push(one);
      checkRuneword(under.item);
      if ((held.qty ?? 1) > 1) held.qty = (held.qty ?? 1) - 1;
      else G.heldItem = null;
      SFX.socket();
      if (under.item.runeword) G.toast(`Runeword: ${under.item.name}!`, "#b8b8ff");
      afterChange();
      return;
    }
    // stack merge
    if (under && under.item.base === held.base && BASES[held.base].stack) {
      const cap = BASES[held.base].stack!;
      const total = (under.item.qty ?? 1) + (held.qty ?? 1);
      under.item.qty = Math.min(cap, total);
      const rest = total - under.item.qty;
      G.heldItem = rest > 0 ? { ...held, qty: rest } : null;
      afterChange();
      return;
    }
    // place / swap
    const b = BASES[held.base];
    let px = Math.min(Math.max(0, cx - Math.floor(b.w / 2)), gw - b.w);
    let py = Math.min(Math.max(0, cy - Math.floor(b.h / 2)), gh - b.h);
    // find overlapping items
    const overlaps = list.filter((p) => {
      const pb = BASES[p.item.base];
      return px < p.x + pb.w && px + b.w > p.x && py < p.y + pb.h && py + b.h > p.y;
    });
    if (overlaps.length === 0 && canPlace(list, held, px, py, gw, gh)) {
      list.push({ item: held, x: px, y: py });
      G.heldItem = null;
      afterChange();
    } else if (overlaps.length === 1) {
      const sw = overlaps[0];
      list.splice(list.indexOf(sw), 1);
      if (canPlace(list, held, px, py, gw, gh)) {
        list.push({ item: held, x: px, y: py });
        G.heldItem = sw.item;
      } else {
        list.push(sw);
      }
      afterChange();
    }
    return;
  }

  if (!under) return;
  // no held item
  if (shift) {
    // quick-move to counterpart container
    const dest = gridName === "inv"
      ? (openPanels.has("stash") ? "stash" : openPanels.has("cube") ? "cube" : null)
      : "inv";
    if (dest) {
      const d = gridsOf(dest);
      list.splice(list.indexOf(under), 1);
      if (!addToGrid(d.list, under.item, d.gw, d.gh)) {
        list.push(under);
        G.toast("No room!", "#d05050");
      }
      afterChange();
      return;
    }
  }
  if (button === 2) {
    // right-click while the merchant is open: sell
    if (openPanels.has("vendor") && gridName === "inv") {
      const value = itemValue(under.item);
      list.splice(list.indexOf(under), 1);
      c.gold += value;
      G.toast(`Sold ${under.item.name} for ${value} gold`, "#e8c860");
      SFX.gold();
      hideTooltip();
      afterChange();
      return;
    }
    // right-click: equip / use
    const b = BASES[under.item.base];
    if (b.kind === "potion" && gridName === "inv") {
      for (let i = 0; i < 4; i++) {
        const s = c.belt[i];
        if (s && s.base === under.item.base && (s.qty ?? 1) + (under.item.qty ?? 1) <= (b.stack ?? 10)) {
          s.qty = (s.qty ?? 1) + (under.item.qty ?? 1);
          list.splice(list.indexOf(under), 1);
          afterChange();
          return;
        }
      }
      for (let i = 0; i < 4; i++) {
        if (!c.belt[i]) {
          c.belt[i] = under.item;
          list.splice(list.indexOf(under), 1);
          afterChange();
          return;
        }
      }
      G.toast("Belt is full", "#d05050");
      return;
    }
    if (b.slot && gridName === "inv") {
      equipItem(under, list);
      return;
    }
  }
  // pick up
  list.splice(list.indexOf(under), 1);
  G.heldItem = under.item;
  hideTooltip();
  afterChange();
}

function equipItem(under: Placed, list: Placed[]) {
  const c = G.char!;
  const it = under.item;
  const b = BASES[it.base];
  if (!b.slot) return;
  if (c.lvl < b.reqLvl) {
    G.toast(`Requires level ${b.reqLvl}`, "#d05050");
    SFX.error();
    return;
  }
  let slotKey: string = b.slot;
  if (b.slot === "ring") slotKey = !c.equip.ring1 ? "ring1" : !c.equip.ring2 ? "ring2" : "ring1";
  // two-handed handling
  if (b.slot === "weapon" && b.twoHand && c.equip.offhand) {
    if (!addToGrid(c.inv, c.equip.offhand, INV_W, INV_H)) {
      G.toast("No room to unequip shield", "#d05050");
      return;
    }
    delete c.equip.offhand;
  }
  if (b.slot === "offhand") {
    const wep = c.equip.weapon;
    if (wep && baseOf(wep).twoHand) {
      G.toast("Cannot use a shield with a two-handed weapon", "#d05050");
      SFX.error();
      return;
    }
  }
  const prev = c.equip[slotKey];
  list.splice(list.indexOf(under), 1);
  c.equip[slotKey] = it;
  if (prev) {
    if (!addToGrid(c.inv, prev, INV_W, INV_H)) G.heldItem = prev;
  }
  SFX.pickup();
  afterChange();
}

function afterChange() {
  markStatsDirty();
  syncStats(true);
  saveChar(G.char!);
  refreshOpenPanels();
}

// ---------------- inventory panel ----------------
const EQ_SLOTS: { key: string; label: string; col: number; row: number }[] = [
  { key: "helm", label: "helm", col: 2, row: 0 },
  { key: "amulet", label: "amul", col: 3, row: 0 },
  { key: "weapon", label: "weap", col: 1, row: 1 },
  { key: "body", label: "body", col: 2, row: 1 },
  { key: "offhand", label: "shld", col: 3, row: 1 },
  { key: "ring1", label: "ring", col: 1, row: 2 },
  { key: "belt", label: "belt", col: 2, row: 2 },
  { key: "ring2", label: "ring", col: 3, row: 2 },
  { key: "gloves", label: "glov", col: 1, row: 3 },
  { key: "boots", label: "boot", col: 2, row: 3 },
];

function rebuildInv() {
  const c = G.char!;
  const p = $("panel-inv");
  p.innerHTML = `<span class="closex" data-close="inv">✕</span><h3>Inventory</h3>`;
  const eq = document.createElement("div");
  eq.className = "equipgrid";
  eq.style.gridTemplateRows = "repeat(4, 56px)";
  for (const s of EQ_SLOTS) {
    const slot = document.createElement("div");
    slot.className = "eqslot";
    slot.style.gridColumn = String(s.col + 1);
    slot.style.gridRow = String(s.row + 1);
    const it = c.equip[s.key];
    if (it) {
      slot.appendChild(itemIcon(it, 54, 54));
      slot.addEventListener("mouseenter", (e) => { if (!G.heldItem) showItemTooltip(it, e.clientX, e.clientY); });
      slot.addEventListener("mouseleave", hideTooltip);
      attachLongPressTooltip(slot, () => c.equip[s.key]);
    } else {
      const l = document.createElement("span");
      l.className = "lbl";
      l.textContent = s.label;
      slot.appendChild(l);
    }
    slot.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clickEquipSlot(s.key, e.button);
    });
    slot.addEventListener("contextmenu", (e) => e.preventDefault());
    eq.appendChild(slot);
  }
  p.appendChild(eq);
  const goldRow = document.createElement("div");
  goldRow.style.cssText = "text-align:center;color:#e8c860;font-size:13px;margin-bottom:6px";
  goldRow.textContent = `Gold: ${c.gold.toLocaleString()}`;
  p.appendChild(goldRow);
  p.appendChild(buildGrid(c.inv, INV_W, INV_H, "inv"));
  const hint = document.createElement("div");
  hint.style.cssText = "font-size:10px;color:#6d6046;margin-top:6px;max-width:420px";
  hint.textContent = IS_TOUCH
    ? "Tap: pick up / place. Long-press: inspect. Tap with a gem or rune held: socket it."
    : "Right-click: equip / send potion to belt. Shift-click: move to stash/cube when open. Click with a gem or rune held: socket it.";
  p.appendChild(hint);
  bindCloseButtons(p);
}

function clickEquipSlot(key: string, button: number) {
  const c = G.char!;
  const cur = c.equip[key];
  if (G.heldItem) {
    const b = BASES[G.heldItem.base];
    // socket into equipped item
    if (cur && canSocketInto(G.heldItem, cur)) {
      const one: Item = { ...G.heldItem, qty: 1, socketed: [] };
      cur.socketed.push(one);
      checkRuneword(cur);
      if ((G.heldItem.qty ?? 1) > 1) G.heldItem.qty = (G.heldItem.qty ?? 1) - 1;
      else G.heldItem = null;
      SFX.socket();
      if (cur.runeword) G.toast(`Runeword: ${cur.name}!`, "#b8b8ff");
      afterChange();
      return;
    }
    const slotOk =
      (b.slot === "ring" && (key === "ring1" || key === "ring2")) || b.slot === key;
    if (!slotOk) { SFX.error(); return; }
    if (c.lvl < b.reqLvl) { G.toast(`Requires level ${b.reqLvl}`, "#d05050"); SFX.error(); return; }
    if (key === "offhand" && c.equip.weapon && baseOf(c.equip.weapon).twoHand) {
      G.toast("Cannot use a shield with a two-handed weapon", "#d05050");
      return;
    }
    if (key === "weapon" && b.twoHand && c.equip.offhand) {
      if (!addToGrid(c.inv, c.equip.offhand, INV_W, INV_H)) { G.toast("No room to unequip shield", "#d05050"); return; }
      delete c.equip.offhand;
    }
    c.equip[key] = G.heldItem;
    G.heldItem = cur ?? null;
    SFX.pickup();
    afterChange();
    return;
  }
  if (!cur) return;
  if (button === 2) {
    if (addToGrid(c.inv, cur, INV_W, INV_H)) {
      delete c.equip[key];
      afterChange();
    } else G.toast("Inventory full!", "#d05050");
    return;
  }
  delete c.equip[key];
  G.heldItem = cur;
  hideTooltip();
  afterChange();
}

// ---------------- stash ----------------
function rebuildStash() {
  const c = G.char!;
  const p = $("panel-stash");
  p.innerHTML = `<span class="closex" data-close="stash">✕</span><h3>Stash</h3>`;
  p.appendChild(buildGrid(c.stash, STASH_W, STASH_H, "stash"));
  bindCloseButtons(p);
}

// ---------------- cube ----------------
function rebuildCube() {
  const c = G.char!;
  const p = $("panel-cube");
  p.innerHTML = `<span class="closex" data-close="cube">✕</span><h3>The Umbral Cube</h3>`;
  const wrap = document.createElement("div");
  wrap.id = "cube-wrap";
  const left = document.createElement("div");
  left.appendChild(buildGrid(c.cube, CUBE_W, CUBE_H, "cube"));
  const btn = document.createElement("button");
  btn.id = "transmutebtn";
  btn.textContent = "Transmute";
  btn.addEventListener("click", doTransmute);
  left.appendChild(btn);
  wrap.appendChild(left);
  const book = document.createElement("div");
  book.id = "recipebook";
  book.innerHTML = RECIPE_BOOK.map((r) => `<div class="r"><b>${r.name}</b><i>${r.inputs}</i> → <em>${r.output}</em></div>`).join("");
  wrap.appendChild(book);
  p.appendChild(wrap);
  bindCloseButtons(p);
}

function doTransmute() {
  const c = G.char!;
  if (!c.cube.length) { G.toast("The cube is empty.", "#8a7d63"); return; }
  const items = c.cube.map((p) => p.item);
  const result = transmute(items, c.lvl);
  if (!result) {
    G.toast("Nothing happens...", "#8a7d63");
    SFX.error();
    return;
  }
  c.cube = [];
  for (const out of result.out) {
    if (!addToGrid(c.cube, out, CUBE_W, CUBE_H)) {
      if (!addToGrid(c.inv, out, INV_W, INV_H)) {
        G.send({ t: "drop", item: out, x: G.x + 0.5, y: G.y + 0.5 });
      }
    }
  }
  SFX.transmute();
  G.toast(result.msg, "#b8b8ff");
  afterChange();
}

// ---------------- skills ----------------
function rebuildSkills() {
  const c = G.char!;
  const p = $("panel-skills");
  p.innerHTML = `<span class="closex" data-close="skills">✕</span><h3>Skills — ${c.skillPts} point${c.skillPts === 1 ? "" : "s"}</h3>`;
  const tree = document.createElement("div");
  tree.className = "skilltree";
  const skills = Object.values(SKILLS).filter((s) => s.cls === c.cls).sort((a, b) => a.reqLvl - b.reqLvl);
  for (const sk of skills) {
    const lvl = c.skills[sk.id] ?? 0;
    const locked = c.lvl < sk.reqLvl;
    const row = document.createElement("div");
    row.className = "skillrowt" + (locked ? " locked" : "");
    const icon = document.createElement("div");
    icon.className = "skicon";
    icon.appendChild(copySkillIcon(sk.icon, 38));
    row.appendChild(icon);
    const info = document.createElement("div");
    info.className = "skinfo";
    const eff = lvl > 0 ? lvl + (G.derived?.allSkills ?? 0) : 0;
    let numbers = "";
    if (sk.kind !== "passive" && sk.kind !== "blink" && sk.kind !== "buff" && lvl > 0) {
      const base = (sk.base ?? 0) + (sk.perLvl ?? 0) * (eff - 1);
      numbers = sk.wd ? `~${Math.round((G.derived!.minDmg + G.derived!.maxDmg) / 2 * sk.wd + base)} damage` : `~${Math.round(base * (1 + G.derived!.spellPct / 100))} damage`;
      numbers += `, ${Math.round(sk.mana + (sk.manaPerLvl ?? 0) * (eff - 1))} mana`;
    } else if (sk.kind === "passive" && lvl > 0) {
      numbers = STAT_LABEL[sk.passive!.stat](Math.round(sk.passive!.v + sk.passive!.perLvl * (eff - 1)));
    } else if (sk.kind === "buff" && lvl > 0) {
      numbers = STAT_LABEL[sk.buff!.stat](Math.round(sk.buff!.v + sk.buff!.perLvl * (eff - 1))) + ` for ${sk.duration}s`;
    }
    info.innerHTML = `<b>${sk.name}</b> <span style="color:#6d6046;font-size:11px">(lvl ${sk.reqLvl})</span><div class="desc">${sk.desc}</div>${numbers ? `<div class="num">${numbers}</div>` : ""}`;
    row.appendChild(info);
    const lvlEl = document.createElement("div");
    lvlEl.className = "sklvl";
    lvlEl.textContent = String(lvl) + (lvl > 0 && G.derived!.allSkills > 0 ? `+${G.derived!.allSkills}` : "");
    row.appendChild(lvlEl);
    const plus = document.createElement("button");
    plus.className = "skplus";
    plus.textContent = "+";
    plus.disabled = locked || c.skillPts <= 0 || lvl >= 20;
    plus.addEventListener("click", (e) => {
      e.stopPropagation();
      if (c.skillPts <= 0) return;
      c.skillPts--;
      c.skills[sk.id] = (c.skills[sk.id] ?? 0) + 1;
      if (sk.kind !== "passive" && !c.skillAssign.includes(sk.id)) {
        if (c.skillAssign.length < 4) c.skillAssign.push(sk.id);
      }
      SFX.pickup();
      afterChange();
    });
    row.appendChild(plus);
    if (sk.kind !== "passive" && lvl > 0) {
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        // assign to bar
        if (!c.skillAssign.includes(sk.id)) {
          if (c.skillAssign.length >= 4) c.skillAssign.shift();
          c.skillAssign.push(sk.id);
        }
        setSelIdx(c.skillAssign.indexOf(sk.id));
        saveChar(c);
        refreshOpenPanels();
      });
    }
    tree.appendChild(row);
  }
  p.appendChild(tree);
  bindCloseButtons(p);
}

// ---------------- character ----------------
function rebuildChar() {
  const c = G.char!;
  const d = G.derived!;
  const p = $("panel-char");
  p.innerHTML = `<span class="closex" data-close="char">✕</span><h3>${esc(c.name)} — level ${c.lvl} ${c.cls}</h3>`;
  const mk = (label: string, value: string, plusStat?: "str" | "dex" | "vit" | "ene") => {
    const row = document.createElement("div");
    row.className = "statrow";
    row.innerHTML = `<span>${label}</span><span><b>${value}</b></span>`;
    if (plusStat && c.statPts > 0) {
      const btn = document.createElement("button");
      btn.className = "plus";
      btn.textContent = "+";
      btn.addEventListener("click", () => {
        if (c.statPts <= 0) return;
        c[plusStat]++;
        c.statPts--;
        SFX.pickup();
        afterChange();
      });
      row.querySelector("span:last-child")!.appendChild(btn);
    }
    return row;
  };
  const g1 = document.createElement("div");
  g1.className = "statgroup";
  g1.appendChild(mk("Stat points", String(c.statPts)));
  g1.appendChild(mk("Strength", String(c.str), "str"));
  g1.appendChild(mk("Dexterity", String(c.dex), "dex"));
  g1.appendChild(mk("Vitality", String(c.vit), "vit"));
  g1.appendChild(mk("Energy", String(c.ene), "ene"));
  p.appendChild(g1);
  const g2 = document.createElement("div");
  g2.className = "statgroup";
  g2.appendChild(mk("Damage", `${d.minDmg}–${d.maxDmg}`));
  g2.appendChild(mk("Defense", String(d.def)));
  g2.appendChild(mk("Attack speed", `${d.attackRate.toFixed(2)}/s`));
  g2.appendChild(mk("Cast speed", `${d.castRate.toFixed(2)}/s`));
  g2.appendChild(mk("Spell damage", `+${Math.round(d.spellPct)}%`));
  p.appendChild(g2);
  const g3 = document.createElement("div");
  g3.className = "statgroup";
  g3.appendChild(mk("Life", `${Math.ceil(G.life)} / ${d.maxLife}`));
  g3.appendChild(mk("Mana", `${Math.ceil(G.mana)} / ${d.maxMana}`));
  g3.appendChild(mk("Resists (F/C/L/P)", `${d.res.fire}/${d.res.cold}/${d.res.light}/${d.res.pois}%`));
  g3.appendChild(mk("Magic find", `+${d.mf}%`));
  g3.appendChild(mk("Gold find", `+${d.goldPct}%`));
  g3.appendChild(mk("Life steal", `${d.lifesteal}%`));
  p.appendChild(g3);
  const g4 = document.createElement("div");
  g4.appendChild(mk("Experience", `${c.xp.toLocaleString()} / ${xpForLevel(c.lvl + 1).toLocaleString()}`));
  g4.appendChild(mk("Deepest depth", String(c.maxDepth)));
  p.appendChild(g4);
  bindCloseButtons(p);
}

// ---------------- vendor ----------------
const VENDOR_STOCK: { base: string; price: number }[] = [
  { base: "hp1", price: 30 }, { base: "mp1", price: 35 },
  { base: "hp2", price: 90 }, { base: "mp2", price: 100 },
  { base: "hp3", price: 220 }, { base: "mp3", price: 240 },
  { base: "dust", price: 120 }, { base: "shard", price: 500 },
];

function rebuildVendor() {
  const c = G.char!;
  const p = $("panel-vendor");
  p.innerHTML = `<span class="closex" data-close="vendor">✕</span><h3>Marla the Merchant</h3>`;
  const gold = document.createElement("div");
  gold.className = "shopgold";
  gold.textContent = `Your gold: ${c.gold.toLocaleString()}`;
  p.appendChild(gold);
  for (const s of VENDOR_STOCK) {
    const b = BASES[s.base];
    const row = document.createElement("div");
    row.className = "shoprow" + (c.gold < s.price ? " poor" : "");
    const preview = makeItem(s.base);
    row.appendChild(itemIcon(preview, 34, 34));
    const info = document.createElement("div");
    info.className = "shopinfo";
    info.innerHTML = `<b>${esc(b.name)}</b>`;
    row.appendChild(info);
    const price = document.createElement("span");
    price.className = "shopprice";
    price.textContent = `${s.price}g`;
    row.appendChild(price);
    row.addEventListener("mouseenter", (e) => showItemTooltip(preview, e.clientX, e.clientY));
    row.addEventListener("mouseleave", hideTooltip);
    row.addEventListener("click", () => {
      if (c.gold < s.price) { G.toast("Not enough gold.", "#d05050"); SFX.error(); return; }
      const item = makeItem(s.base);
      if (!addToGrid(c.inv, item, INV_W, INV_H)) { G.toast("Inventory full!", "#d05050"); SFX.error(); return; }
      c.gold -= s.price;
      SFX.gold();
      afterChange();
    });
    p.appendChild(row);
  }
  const hint = document.createElement("div");
  hint.className = "shophint";
  hint.textContent = "Right-click items in your inventory to sell them to Marla.";
  p.appendChild(hint);
  bindCloseButtons(p);
}

// ---------------- gambling ----------------
const GAMBLE_SLOTS: { slot: Slot; label: string; spr: string }[] = [
  { slot: "weapon", label: "Weapon", spr: "sword" },
  { slot: "offhand", label: "Shield", spr: "shield" },
  { slot: "helm", label: "Helm", spr: "helm" },
  { slot: "body", label: "Body Armor", spr: "body" },
  { slot: "gloves", label: "Gloves", spr: "gloves" },
  { slot: "boots", label: "Boots", spr: "boots" },
  { slot: "belt", label: "Belt", spr: "belt" },
  { slot: "ring", label: "Ring", spr: "ring" },
  { slot: "amulet", label: "Amulet", spr: "amulet" },
];

function rebuildGamble() {
  const c = G.char!;
  const p = $("panel-gamble");
  p.innerHTML = `<span class="closex" data-close="gamble">✕</span><h3>Zeke the Gambler</h3>`;
  const gold = document.createElement("div");
  gold.className = "shopgold";
  gold.textContent = `Your gold: ${c.gold.toLocaleString()}`;
  p.appendChild(gold);
  const blurb = document.createElement("div");
  blurb.className = "shophint";
  blurb.style.marginBottom = "8px";
  blurb.textContent = "Pay up, pick a slot, and pray. Could be magic... could be legendary.";
  p.appendChild(blurb);
  for (const gs of GAMBLE_SLOTS) {
    const price = gamblePrice(gs.slot, c.lvl);
    const row = document.createElement("div");
    row.className = "shoprow" + (c.gold < price ? " poor" : "");
    const preview = document.createElement("canvas");
    preview.width = 34; preview.height = 34;
    const pg = preview.getContext("2d")!;
    pg.filter = "grayscale(0.6) brightness(0.8)";
    pg.drawImage(getSprite(gs.spr), 1, 1, 32, 32);
    row.appendChild(preview);
    const info = document.createElement("div");
    info.className = "shopinfo";
    info.innerHTML = `<b>${gs.label}</b><span class="mystery">?????</span>`;
    row.appendChild(info);
    const priceEl = document.createElement("span");
    priceEl.className = "shopprice";
    priceEl.textContent = `${price}g`;
    row.appendChild(priceEl);
    row.addEventListener("click", () => {
      if (c.gold < price) { G.toast("Not enough gold.", "#d05050"); SFX.error(); return; }
      const r = mulberry32(((Math.random() * 0xffffffff) ^ Date.now()) >>> 0);
      const item = gambleItem(r, gs.slot, c.lvl);
      if (!addToGrid(c.inv, item, INV_W, INV_H)) { G.toast("Inventory full!", "#d05050"); SFX.error(); return; }
      c.gold -= price;
      if (item.rarity === "unique" || item.rarity === "set") {
        SFX.levelup();
        G.toast(`✦ ${item.name}! ✦`, RARITY_COLOR[item.rarity]);
      } else {
        SFX.gold();
        G.toast(`You won: ${item.name}`, RARITY_COLOR[item.rarity]);
      }
      afterChange();
    });
    p.appendChild(row);
  }
  bindCloseButtons(p);
}

// ---------------- waypoint ----------------
function rebuildWaypoint() {
  const c = G.char!;
  const p = $("panel-wp");
  p.innerHTML = `<span class="closex" data-close="wp">✕</span><h3>Waypoint</h3>`;
  const dest = (label: string, d: number) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", () => {
      togglePanel("wp", false);
      document.dispatchEvent(new CustomEvent("waypoint-travel", { detail: d }));
    });
    p.appendChild(b);
  };
  dest("Emberfall Refuge (Town)", 0);
  const maxD = Math.max(1, c.maxDepth);
  const start = Math.max(1, maxD - 11);
  for (let d = start; d <= maxD; d++) dest(`Depth ${d}${d % 5 === 0 ? " — Gravelord's Vault" : ""}`, d);
  bindCloseButtons(p);
}

function bindCloseButtons(root: HTMLElement) {
  root.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => togglePanel((el as HTMLElement).dataset.close!, false));
  });
}

// ---------------- HUD ----------------
export function refreshHUD() {
  const c = G.char, d = G.derived;
  if (!c || !d) return;
  ($("hpfill") as HTMLElement).style.height = `${Math.max(0, (G.life / d.maxLife) * 100)}%`;
  ($("mpfill") as HTMLElement).style.height = `${Math.max(0, (G.mana / d.maxMana) * 100)}%`;
  $("hptext").textContent = `${Math.ceil(G.life)}`;
  $("mptext").textContent = `${Math.ceil(G.mana)}`;
  const prevXp = xpForLevel(c.lvl);
  const nextXp = xpForLevel(c.lvl + 1);
  ($("xpfill") as HTMLElement).style.width = `${Math.min(100, ((c.xp - prevXp) / (nextXp - prevXp)) * 100)}%`;

  // belt
  const belt = $("beltrow");
  belt.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement("div");
    slot.className = "beltslot";
    const key = document.createElement("span");
    key.className = "slotkey";
    key.textContent = String(i + 1);
    slot.appendChild(key);
    const it = c.belt[i];
    if (it) {
      slot.appendChild(itemIcon(it, 38, 38));
      const q = document.createElement("span");
      q.className = "slotqty";
      q.textContent = String(it.qty ?? 1);
      slot.appendChild(q);
      slot.addEventListener("mouseenter", (e) => showItemTooltip(it, e.clientX, e.clientY));
      slot.addEventListener("mouseleave", hideTooltip);
    }
    slot.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      if (e.button === 0) drinkBelt(i);
      else if (e.button === 2 && c.belt[i]) {
        const it2 = c.belt[i]!;
        if (addToGrid(c.inv, it2, INV_W, INV_H)) {
          c.belt[i] = null;
          afterChange();
        }
      }
    });
    slot.addEventListener("contextmenu", (e) => e.preventDefault());
    belt.appendChild(slot);
  }

  // skill bar
  const bar = $("skillrow");
  bar.innerHTML = "";
  const keys = ["Q", "W", "E", "R"];
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement("div");
    slot.className = "skillslot" + (i === selIdx ? " sel" : "");
    const key = document.createElement("span");
    key.className = "slotkey";
    key.textContent = keys[i];
    slot.appendChild(key);
    const sid = c.skillAssign[i];
    if (sid && (c.skills[sid] ?? 0) > 0) {
      const sk = SKILLS[sid];
      const ic = copySkillIcon(sk.icon, 40);
      slot.appendChild(ic);
      const cdLeft = (G.cooldowns[sid] ?? 0) - G.now;
      if (cdLeft > 0 && sk.cooldown) {
        const ov = document.createElement("div");
        ov.className = "cd-overlay";
        ov.style.height = `${(cdLeft / sk.cooldown) * 100}%`;
        slot.appendChild(ov);
      }
      slot.title = sk.name;
    }
    slot.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      setSelIdx(i);
      refreshHUD();
    });
    bar.appendChild(slot);
  }
  // innate Town Portal slot
  {
    const slot = document.createElement("div");
    slot.className = "skillslot";
    const key = document.createElement("span");
    key.className = "slotkey";
    key.textContent = "T";
    slot.appendChild(key);
    const ic = copySkillIcon("portal", 40);
    slot.appendChild(ic);
    slot.title = "Town Portal — passage to Emberfall Refuge (and back)";
    const cdLeft = (G.cooldowns.townportal ?? 0) - G.now;
    if (cdLeft > 0) {
      const ov = document.createElement("div");
      ov.className = "cd-overlay";
      ov.style.height = `${Math.min(100, (cdLeft / 6) * 100)}%`;
      slot.appendChild(ov);
    }
    slot.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      townPortal();
      refreshHUD();
    });
    bar.appendChild(slot);
  }

  // party frames
  const party = $("party");
  party.innerHTML = "";
  for (const p of G.players.values()) {
    const row = document.createElement("div");
    row.className = "partyrow";
    row.innerHTML = `<span style="color:#9ad0ff">${esc(p.cur.name)}</span> <span style="color:#6d6046">lv${p.cur.lvl} · d${p.cur.depth}</span><div class="php"><div style="width:${Math.max(0, p.cur.hp * 100)}%"></div></div>`;
    party.appendChild(row);
  }

  // boss bar
  let boss: { name: string; frac: number } | null = null;
  for (const m of G.monsters.values()) {
    if (m.cur.boss) { boss = { name: "The Gravelord", frac: m.cur.hp / m.cur.maxHp }; break; }
  }
  const bb = $("bossbar");
  if (boss) {
    bb.classList.remove("hidden");
    ($("bossfill") as HTMLElement).style.width = `${boss.frac * 100}%`;
    $("bossname").textContent = boss.name;
  } else bb.classList.add("hidden");

  touchRefresh();
}

// ---------------- toast ----------------
export function toast(msg: string, color = "#c8a856") {
  const t = document.createElement("div");
  t.className = "toastmsg";
  t.style.color = color;
  t.textContent = msg;
  $("toast").appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

// ---------------- init ----------------
export function initUI() {
  G.toast = toast;
  G.onStateChange = refreshOpenPanels;
  document.querySelectorAll("#panelbtns button").forEach((b) => {
    b.addEventListener("click", () => togglePanel((b as HTMLElement).dataset.panel!));
  });
  $("respawnbtn").addEventListener("click", respawn);
  document.addEventListener("open-stash", () => togglePanel("stash", true));
  document.addEventListener("open-waypoint", () => togglePanel("wp", true));
  document.addEventListener("open-vendor", () => {
    togglePanel("vendor", true);
    if (!IS_TOUCH) togglePanel("inv", true); // side-by-side shopping needs desktop width
  });
  document.addEventListener("open-gamble", () => togglePanel("gamble", true));
}
