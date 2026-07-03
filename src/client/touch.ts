// Mobile touch controls: floating virtual joystick (left thumb), skill and
// potion buttons (right thumb), pinch zoom. Desktop input is untouched —
// this module is inert unless IS_TOUCH.

import { BASES, SKILLS } from "../shared/gamedata";
import { drinkBelt, G, IS_TOUCH, townPortal, tryCast } from "./game";
import { zoomBy } from "./render3d";
import { copySkillIcon } from "./sprites";

const state = {
  joyActive: false,
  joyDX: 0,          // screen-space joystick vector, normalized
  joyDY: 0,
  aimX: 1,           // last world-space facing (for casting with no target)
  aimY: 0,
  attackHeld: false,
};

let built = false;
const $ = (id: string) => document.getElementById(id)!;

// screen joystick → world direction (camera sits on the +x/+z diagonal)
function joyToWorld(dx: number, dy: number): [number, number] {
  const inv = Math.SQRT1_2;
  return [(dx + dy) * inv, (dy - dx) * inv];
}

function nearestMonster(maxDist: number): { x: number; y: number; id: string; d: number } | null {
  let best: { x: number; y: number; id: string; d: number } | null = null;
  for (const m of G.monsters.values()) {
    const d = Math.hypot(m.tx - G.x, m.ty - G.y);
    if (d < maxDist && (!best || d < best.d)) best = { x: m.tx, y: m.ty, id: m.cur.id, d };
  }
  return best;
}

function castAtBest(skillId: string) {
  const t = nearestMonster(9);
  if (t) tryCast(skillId, t.x, t.y, t.id);
  else tryCast(skillId, G.x + state.aimX * 3, G.y + state.aimY * 3);
}

function basicSkill(): string {
  return G.char?.cls === "pyromancer" ? "basic_bolt" : "basic";
}

// Called every frame from the main loop.
export function touchTick() {
  if (!IS_TOUCH || !G.char || G.dead) return;
  if (state.joyActive && (state.joyDX || state.joyDY)) {
    const [wx, wy] = joyToWorld(state.joyDX, state.joyDY);
    const len = Math.hypot(wx, wy) || 1;
    state.aimX = wx / len;
    state.aimY = wy / len;
    G.moveTarget = { x: G.x + wx * 2, y: G.y + wy * 2 };
    G.pendingPickup = null;
    G.pendingObj = null;
  } else if (state.joyActive) {
    G.moveTarget = null;
  }
  if (state.attackHeld) {
    const t = nearestMonster(9);
    const melee = G.char.cls !== "pyromancer";
    if (t && melee && t.d > 2.1) {
      G.moveTarget = { x: t.x, y: t.y }; // close the gap, then swing
    } else if (t) {
      tryCast(basicSkill(), t.x, t.y, t.id);
    } else {
      tryCast(basicSkill(), G.x + state.aimX * 3, G.y + state.aimY * 3);
    }
  }
}

// Rebuild button icons / cooldowns — called from refreshHUD (~8x/s).
export function touchRefresh() {
  if (!IS_TOUCH || !built || !G.char) return;
  const c = G.char;
  for (let i = 0; i < 4; i++) {
    const btn = $(`tb-s${i}`);
    const sid = c.skillAssign[i];
    const known = sid && (c.skills[sid] ?? 0) > 0;
    const iconKey = known ? SKILLS[sid].icon : "";
    if (btn.dataset.icon !== iconKey) {
      btn.dataset.icon = iconKey;
      btn.innerHTML = "";
      if (known) btn.appendChild(copySkillIcon(SKILLS[sid].icon, 40));
    }
    btn.style.opacity = known ? "1" : "0.35";
    // cooldown sweep
    let ov = btn.querySelector<HTMLElement>(".cd-overlay");
    const sk = known ? SKILLS[sid] : null;
    const cdLeft = sk?.cooldown ? (G.cooldowns[sid] ?? 0) - G.now : 0;
    if (cdLeft > 0 && sk?.cooldown) {
      if (!ov) {
        ov = document.createElement("div");
        ov.className = "cd-overlay";
        btn.appendChild(ov);
      }
      ov.style.height = `${Math.min(100, (cdLeft / sk.cooldown) * 100)}%`;
    } else ov?.remove();
  }
  // potion counts
  const count = (prefix: string) =>
    c.belt.reduce((n, it) => n + (it && it.base.startsWith(prefix) ? (it.qty ?? 1) : 0), 0);
  $("tb-hp-n").textContent = String(count("hp"));
  $("tb-mp-n").textContent = String(count("mp"));
  // town portal cooldown
  const tpBtn = $("tb-tp");
  let tov = tpBtn.querySelector<HTMLElement>(".cd-overlay");
  const tpLeft = (G.cooldowns.townportal ?? 0) - G.now;
  if (tpLeft > 0) {
    if (!tov) {
      tov = document.createElement("div");
      tov.className = "cd-overlay";
      tpBtn.appendChild(tov);
    }
    tov.style.height = `${Math.min(100, (tpLeft / 6) * 100)}%`;
  } else tov?.remove();
}

export function showTouchUI() {
  if (IS_TOUCH && built) $("touchui").classList.remove("hidden");
}

export function initTouch() {
  if (!IS_TOUCH || built) return;
  built = true;
  document.body.classList.add("touch");

  const ui = $("touchui");
  ui.innerHTML = `
    <div id="joyzone"><div id="joybase"><div id="joystick"></div></div></div>
    <div id="touchbtns">
      <div class="tbtn tbig" id="tb-attack"></div>
      <div class="tbtn" id="tb-s0"></div>
      <div class="tbtn" id="tb-s1"></div>
      <div class="tbtn" id="tb-s2"></div>
      <div class="tbtn" id="tb-s3"></div>
    </div>
    <div id="utilbtns">
      <div class="tbtn tutil" id="tb-hp"><span>❤</span><b id="tb-hp-n">0</b></div>
      <div class="tbtn tutil" id="tb-mp"><span>✦</span><b id="tb-mp-n">0</b></div>
      <div class="tbtn tutil" id="tb-tp"></div>
    </div>`;
  ui.classList.add("hidden");

  // attack button: sword icon
  $("tb-attack").appendChild(copySkillIcon("basic", 52));
  $("tb-tp").appendChild(copySkillIcon("portal", 34));

  // ---- joystick (floating: appears where the thumb lands) ----
  const zone = $("joyzone");
  const base = $("joybase");
  const stick = $("joystick");
  let joyId = -1;
  let baseX = 0, baseY = 0;
  const JOY_R = 44;

  zone.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyId = t.identifier;
    baseX = t.clientX;
    baseY = t.clientY;
    base.style.display = "block";
    base.style.left = `${baseX - 55}px`;
    base.style.top = `${baseY - 55}px`;
    stick.style.transform = "translate(0px, 0px)";
    state.joyActive = true;
    state.joyDX = 0;
    state.joyDY = 0;
  }, { passive: false });

  zone.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== joyId) continue;
      let dx = t.clientX - baseX;
      let dy = t.clientY - baseY;
      const len = Math.hypot(dx, dy);
      if (len > JOY_R) {
        dx = (dx / len) * JOY_R;
        dy = (dy / len) * JOY_R;
      }
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = 8;
      if (len < dead) {
        state.joyDX = 0;
        state.joyDY = 0;
      } else {
        state.joyDX = dx / JOY_R;
        state.joyDY = dy / JOY_R;
      }
    }
  }, { passive: false });

  const joyEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== joyId) continue;
      joyId = -1;
      state.joyActive = false;
      state.joyDX = 0;
      state.joyDY = 0;
      G.moveTarget = null;
      base.style.display = "none";
    }
  };
  zone.addEventListener("touchend", joyEnd);
  zone.addEventListener("touchcancel", joyEnd);

  // ---- buttons ----
  const hold = (el: HTMLElement, down: () => void, up?: () => void) => {
    el.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false });
    if (up) {
      el.addEventListener("touchend", (e) => { e.preventDefault(); up(); }, { passive: false });
      el.addEventListener("touchcancel", () => up());
    }
  };
  hold($("tb-attack"), () => { state.attackHeld = true; }, () => { state.attackHeld = false; });
  for (let i = 0; i < 4; i++) {
    hold($(`tb-s${i}`), () => {
      const sid = G.char?.skillAssign[i];
      if (sid && (G.char!.skills[sid] ?? 0) > 0) castAtBest(sid);
    });
  }
  hold($("tb-hp"), () => {
    const i = G.char?.belt.findIndex((b) => b && BASES[b.base].potion?.hp) ?? -1;
    if (i >= 0) drinkBelt(i);
  });
  hold($("tb-mp"), () => {
    const i = G.char?.belt.findIndex((b) => b && BASES[b.base].potion?.mp) ?? -1;
    if (i >= 0) drinkBelt(i);
  });
  hold($("tb-tp"), () => townPortal());

  // ---- pinch zoom on the game canvas ----
  const canvas = $("game");
  let pinchDist = 0;
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && pinchDist > 0) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      zoomBy(d / pinchDist);
      pinchDist = d;
    }
  }, { passive: false });
  canvas.addEventListener("touchend", () => { pinchDist = 0; });
}
