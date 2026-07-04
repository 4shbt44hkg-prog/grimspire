import { MONSTERS } from "../shared/gamedata";
import {
  type Character, computeDerived, currentSkill, deleteChar, drinkBelt, G, loadChars,
  newCharacter, saveChar, setDepth, setSelIdx, townPortal, tryCast, update, sendPos, selIdx,
} from "./game";
import { connect } from "./net";
import { render, resize, s2w } from "./render3d";
import { getSprite } from "./sprites";
import { initTouch, showTouchUI, touchTick } from "./touch";
import { anyPanelOpen, closeAllPanels, initUI, refreshHUD, refreshOpenPanels, toast, togglePanel } from "./ui";

const $ = (id: string) => document.getElementById(id)!;
const canvas = $("game") as HTMLCanvasElement;

// ================= MENU =================
let selectedChar: Character | null = null;
let pickedClass: "warlord" | "pyromancer" | null = null;

function drawPortraits() {
  document.querySelectorAll<HTMLCanvasElement>(".classportrait").forEach((c) => {
    const g = c.getContext("2d")!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    const spr = getSprite(c.dataset.cls!);
    g.clearRect(0, 0, 64, 64);
    const s = Math.min(56 / spr.width, 60 / spr.height);
    g.drawImage(spr, (64 - spr.width * s) / 2, (64 - spr.height * s) / 2, spr.width * s, spr.height * s);
  });
}

function rebuildCharList() {
  const chars = loadChars();
  const list = $("charlist");
  list.innerHTML = "";
  const names = Object.keys(chars);
  if (!names.length) {
    list.innerHTML = `<div style="color:#6d6046;font-size:13px;padding:6px">No heroes yet — forge one below.</div>`;
  }
  for (const name of names) {
    const c = chars[name];
    const row = document.createElement("div");
    row.className = "charrow" + (selectedChar?.name === name ? " sel" : "");
    row.innerHTML = `<b style="color:#c8a856">${name}</b><span style="color:#8a7d63;font-size:12px">lv${c.lvl} ${c.cls} · depth ${c.maxDepth}</span>`;
    const del = document.createElement("span");
    del.className = "del";
    del.textContent = "✕";
    del.title = "Delete hero";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`Delete ${name} forever?`)) {
        deleteChar(name);
        if (selectedChar?.name === name) selectedChar = null;
        rebuildCharList();
        updatePlayButtons();
      }
    });
    row.appendChild(del);
    row.addEventListener("click", () => {
      selectedChar = c;
      rebuildCharList();
      updatePlayButtons();
    });
    list.appendChild(row);
  }
}

function updatePlayButtons() {
  $("selectedchar").textContent = selectedChar
    ? `${selectedChar.name} — level ${selectedChar.lvl} ${selectedChar.cls}`
    : "No hero selected";
  ($("newgame") as HTMLButtonElement).disabled = !selectedChar;
  ($("joingame") as HTMLButtonElement).disabled = !selectedChar;
}

function initMenu() {
  drawPortraits();
  rebuildCharList();
  updatePlayButtons();

  document.querySelectorAll(".classcard").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".classcard").forEach((c) => c.classList.remove("sel"));
      card.classList.add("sel");
      pickedClass = (card as HTMLElement).dataset.cls as never;
    });
  });

  $("createchar").addEventListener("click", () => {
    const name = ($("charname") as HTMLInputElement).value.trim();
    if (!name) { menuError("Name your hero first."); return; }
    if (!pickedClass) { menuError("Choose a class."); return; }
    if (loadChars()[name]) { menuError("A hero by that name already exists."); return; }
    const c = newCharacter(name, pickedClass);
    saveChar(c);
    selectedChar = c;
    ($("charname") as HTMLInputElement).value = "";
    rebuildCharList();
    updatePlayButtons();
  });

  $("newgame").addEventListener("click", () => startGame(""));
  $("joingame").addEventListener("click", () => {
    const code = ($("roomcode") as HTMLInputElement).value.trim().toUpperCase();
    if (code.length !== 4) { menuError("Enter the 4-letter game code."); return; }
    startGame(code);
  });
}

function menuError(msg: string) {
  $("menuerror").textContent = msg;
}

async function startGame(roomCode: string) {
  if (!selectedChar) return;
  menuError("");
  try {
    const res = await connect(selectedChar.name, selectedChar.cls, roomCode, selectedChar.lvl);
    G.char = selectedChar;
    G.playerId = res.id;
    G.roomCode = res.room;
    G.seed = res.seed;
    G.derived = computeDerived(G.char, []);
    G.life = G.derived.maxLife;
    G.mana = G.derived.maxMana;
    $("menu").classList.add("hidden");
    $("hud").classList.remove("hidden");
    initUI();
    showTouchUI();
    setDepth(0);
    G.statsDirty = true;
    G.lastStatSync = -10;
    toast(`Welcome to Emberfall Refuge. Game code: ${res.room}`, "#c8a856");
    if (!roomCode) toast("Share the code so friends can join!", "#8a7d63");
    running = true;
  } catch (err) {
    menuError((err as Error).message);
  }
}

// ================= INPUT =================
let mouseX = 0, mouseY = 0;
let leftHeld = false;
let attackHeld = false; // holding LMB on open ground / with shift: keep attacking
const moveKeys = new Set<string>(); // w a s d

function basicSkill(): string {
  return G.char!.cls === "pyromancer" ? "basic_bolt" : "basic";
}

// WASD is screen-relative; map through the isometric camera like the
// touch joystick does (screen-up ≈ world -x/-z along the camera diagonal).
function wasdWorldDir(): [number, number] | null {
  let dx = 0, dy = 0;
  if (moveKeys.has("a")) dx -= 1;
  if (moveKeys.has("d")) dx += 1;
  if (moveKeys.has("w")) dy -= 1;
  if (moveKeys.has("s")) dy += 1;
  if (!dx && !dy) return null;
  const inv = Math.SQRT1_2;
  const wx = (dx + dy) * inv;
  const wy = (dy - dx) * inv;
  const len = Math.hypot(wx, wy) || 1;
  return [wx / len, wy / len];
}

function applyWasd() {
  const dir = wasdWorldDir();
  if (!dir || G.dead) return;
  G.moveTarget = { x: G.x + dir[0] * 2, y: G.y + dir[1] * 2 };
  G.pendingPickup = null;
  G.pendingObj = null;
  pendingAttack = null;
}

function worldMouse(): [number, number] {
  return s2w(mouseX, mouseY);
}

function monsterUnderMouse(): string | null {
  for (let i = G.monRects.length - 1; i >= 0; i--) {
    const r = G.monRects[i];
    if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) return r.id;
  }
  return null;
}

function objectUnderMouse(): string | null {
  for (let i = G.objRects.length - 1; i >= 0; i--) {
    const r = G.objRects[i];
    if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) return r.id;
  }
  return null;
}

canvas.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  G.hoverMonster = monsterUnderMouse();
  G.hoverObj = G.hoverMonster ? null : objectUnderMouse();
  canvas.style.cursor = G.hoverMonster || G.hoverObj ? "pointer" : "crosshair";
});

canvas.addEventListener("mousedown", (e) => {
  if (!running || G.dead) return;
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (e.button === 0) {
    // drop held item
    if (G.heldItem) {
      const [wx, wy] = worldMouse();
      G.send({ t: "drop", item: G.heldItem, x: G.x + Math.max(-1.5, Math.min(1.5, wx - G.x)), y: G.y + Math.max(-1.5, Math.min(1.5, wy - G.y)) });
      G.heldItem = null;
      refreshOpenPanels();
      return;
    }
    // ground item label?
    for (const r of G.labelRects) {
      if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) {
        const g = G.groundItems.get(r.gid);
        if (g) {
          G.moveTarget = { x: g.x, y: g.y };
          G.pendingPickup = r.gid;
        }
        return;
      }
    }
    // object?
    for (const r of G.objRects) {
      if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) {
        const obj = G.map?.objects.find((o) => o.id === r.id);
        if (obj) {
          G.moveTarget = { x: obj.x, y: obj.y };
          G.pendingObj = r.id;
        }
        return;
      }
    }
    // monster? (chases into range unless shift is held)
    const mid = monsterUnderMouse();
    if (mid && !e.shiftKey) {
      attackMonster(mid);
      return;
    }
    // open ground (or shift): swing/fire toward the cursor — WASD moves you
    leftHeld = true;
    attackHeld = true;
    const [wx, wy] = worldMouse();
    const m = mid ? G.monsters.get(mid) : null;
    if (!wasdWorldDir()) G.moveTarget = null;
    tryCast(basicSkill(), m ? m.tx : wx, m ? m.ty : wy, mid ?? undefined);
  } else if (e.button === 2) {
    const [wx, wy] = worldMouse();
    const mid = monsterUnderMouse();
    const m = mid ? G.monsters.get(mid) : null;
    tryCast(currentSkill(), m ? m.tx : wx, m ? m.ty : wy, mid ?? undefined);
  }
});

function attackMonster(mid: string) {
  const m = G.monsters.get(mid);
  if (!m) return;
  const cls = G.char!.cls;
  const dist = Math.hypot(m.tx - G.x, m.ty - G.y);
  if (cls === "pyromancer") {
    tryCast("basic_bolt", m.tx, m.ty, mid);
    G.moveTarget = null;
  } else if (dist <= 2.1 + MONSTERS[m.cur.def].size) {
    tryCast("basic", m.tx, m.ty, mid);
    G.moveTarget = null;
  } else {
    G.moveTarget = { x: m.tx, y: m.ty };
    pendingAttack = mid;
  }
}
let pendingAttack: string | null = null;

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0) {
    leftHeld = false;
    attackHeld = false;
  }
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (!running) return;
  const chat = $("chatinput") as HTMLInputElement;
  if (document.activeElement === chat) {
    if (e.key === "Enter") {
      const v = chat.value.trim();
      if (v) G.send({ t: "chat", msg: v });
      chat.value = "";
      chat.classList.add("hidden");
      chat.blur();
    } else if (e.key === "Escape") {
      chat.classList.add("hidden");
      chat.blur();
    }
    return;
  }
  const k = e.key.toLowerCase();
  if (k === "enter") {
    chat.classList.remove("hidden");
    chat.focus();
    return;
  }
  if (k === "escape") {
    if (G.heldItem) return; // don't lose items accidentally
    closeAllPanels();
    return;
  }
  if (["w", "a", "s", "d"].includes(k)) {
    moveKeys.add(k);
    return;
  }
  if (k === "i") togglePanel("inv");
  else if (k === "k") togglePanel("skills");
  else if (k === "c") togglePanel("char");
  else if (k === "b") togglePanel("cube");
  else if (k === "m") { /* minimap always on */ }
  else if (k >= "1" && k <= "4") drinkBelt(Number(k) - 1);
  else if (["q", "e", "r", "f"].includes(k)) {
    const idx = ["q", "e", "r", "f"].indexOf(k);
    setSelIdx(idx);
    refreshHUD();
    const [wx, wy] = worldMouse();
    const mid = monsterUnderMouse();
    const m = mid ? G.monsters.get(mid) : null;
    tryCast(currentSkill(), m ? m.tx : wx, m ? m.ty : wy, mid ?? undefined);
  } else if (k === "t") {
    townPortal();
  }
});

window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (moveKeys.delete(k) && !wasdWorldDir()) {
    G.moveTarget = null; // released the last movement key: stop
  }
});
window.addEventListener("blur", () => moveKeys.clear());

document.addEventListener("waypoint-travel", ((e: CustomEvent) => {
  const d = e.detail as number;
  setDepth(d, d === 0 ? undefined : undefined);
  toast(d === 0 ? "Emberfall Refuge" : `Depth ${d}`);
}) as EventListener);

// ================= GAME LOOP =================
let running = false;
let lastT = 0;
let hudT = 0;

function loop(t: number) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (!running || !G.char) return;

  // WASD movement (screen-relative, camera-mapped)
  applyWasd();
  // held LMB: keep attacking toward the cursor
  if (leftHeld && attackHeld && !anyPanelOpen()) {
    const [wx, wy] = worldMouse();
    const mid = monsterUnderMouse();
    const m = mid ? G.monsters.get(mid) : null;
    tryCast(basicSkill(), m ? m.tx : wx, m ? m.ty : wy, mid ?? undefined);
  }
  // pending melee attack chase
  if (pendingAttack) {
    const m = G.monsters.get(pendingAttack);
    if (!m) pendingAttack = null;
    else {
      const dist = Math.hypot(m.tx - G.x, m.ty - G.y);
      if (dist <= 2.1 + MONSTERS[m.cur.def].size) {
        tryCast("basic", m.tx, m.ty, pendingAttack);
        pendingAttack = null;
        G.moveTarget = null;
      } else {
        G.moveTarget = { x: m.tx, y: m.ty };
      }
    }
  }

  touchTick();
  update(dt);
  render();

  hudT += dt;
  if (hudT > 0.12) {
    hudT = 0;
    refreshHUD();
  }
}

// Keep simulating while the tab is hidden (rAF stops firing) so the
// character isn't helpless if a player tabs out mid-fight.
setInterval(() => {
  if (!running || !G.char || !document.hidden) return;
  applyWasd();
  update(1 / 30);
}, 1000 / 30);

// ================= BOOT =================
initMenu();
initTouch();
resize();
requestAnimationFrame(loop);

// debug handles (useful in the browser console / automated testing)
(window as unknown as { G: typeof G }).G = G;
(window as unknown as { cast: typeof tryCast }).cast = tryCast;
(window as unknown as { tick: (dt: number) => void }).tick = (dt: number) => {
  if (running && G.char) {
    touchTick();
    applyWasd();
    if (pendingAttack) {
      const m = G.monsters.get(pendingAttack);
      if (!m) pendingAttack = null;
      else {
        const dist = Math.hypot(m.tx - G.x, m.ty - G.y);
        if (dist <= 2.1 + MONSTERS[m.cur.def].size) {
          tryCast("basic", m.tx, m.ty, pendingAttack);
          pendingAttack = null;
          G.moveTarget = null;
        } else G.moveTarget = { x: m.tx, y: m.ty };
      }
    }
    update(dt);
  }
};
