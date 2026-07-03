// All art is generated in code — smooth vector-style sprites drawn with
// canvas paths, gradients and soft shading (no external assets).

type Ctx = CanvasRenderingContext2D;

function make(w: number, h: number, draw: (g: Ctx, w: number, h: number) => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.lineJoin = "round";
  g.lineCap = "round";
  draw(g, w, h);
  return c;
}

function lg(g: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

function rg(g: Ctx, x: number, y: number, r: number, stops: [number, string][]) {
  const gr = g.createRadialGradient(x, y, 0.5, x, y, r);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

function ell(g: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, stroke?: string, lw = 1.4) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}

function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string, lw = 1.4) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}

function poly(g: Ctx, pts: [number, number][], fill: string | CanvasGradient, stroke?: string, lw = 1.4) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}

const OUT = "rgba(10,6,4,0.6)"; // soft dark outline

// ---------- humanoid helpers ----------
function legs(g: Ctx, cx: number, y: number, w: number, h: number, color: string, dark: string) {
  rr(g, cx - w - 1.5, y, w, h, w / 2, lg(g, 0, y, 0, y + h, [[0, color], [1, dark]]), OUT);
  rr(g, cx + 1.5, y, w, h, w / 2, lg(g, 0, y, 0, y + h, [[0, color], [1, dark]]), OUT);
}

// ============================ ENTITIES ============================
const DEFS: Record<string, () => HTMLCanvasElement> = {
  warlord: () => make(36, 46, (g) => {
    const cx = 18;
    // cape
    poly(g, [[cx - 8, 16], [cx + 8, 16], [cx + 10, 36], [cx - 10, 36]], lg(g, 0, 16, 0, 36, [[0, "#7c1a1a"], [1, "#4a0e0e"]]), OUT);
    legs(g, cx, 32, 4.5, 11, "#565b64", "#2e3138");
    // torso armor
    rr(g, cx - 8.5, 15, 17, 19, 5, lg(g, cx - 8, 15, cx + 8, 34, [[0, "#b9bec8"], [0.5, "#868d99"], [1, "#4c515b"]]), OUT);
    g.strokeStyle = "rgba(255,255,255,0.25)";
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx - 5, 19); g.lineTo(cx - 5, 30); g.stroke();
    // belt
    rr(g, cx - 8.5, 29, 17, 3.6, 1.5, "#3f2c14");
    rr(g, cx - 2, 29, 4, 3.6, 1, "#c8a856");
    // pauldrons
    ell(g, cx - 9.5, 17.5, 4.6, 3.6, lg(g, cx - 14, 14, cx - 5, 21, [[0, "#c6ccd6"], [1, "#5a606b"]]), OUT);
    ell(g, cx + 9.5, 17.5, 4.6, 3.6, lg(g, cx + 5, 14, cx + 14, 21, [[0, "#c6ccd6"], [1, "#5a606b"]]), OUT);
    // head + helm
    ell(g, cx, 9.5, 5.4, 5.8, "#d9a066");
    g.beginPath();
    g.arc(cx, 9, 6, Math.PI * 0.95, Math.PI * 2.05);
    g.lineTo(cx + 6, 11.5); g.lineTo(cx - 6, 11.5);
    g.closePath();
    g.fillStyle = lg(g, cx - 6, 3, cx + 6, 12, [[0, "#c6ccd6"], [1, "#6a707b"]]);
    g.fill();
    g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = "#1c1710";
    g.fillRect(cx - 4, 9.2, 8, 1.8); // visor
    // axe at right hand
    g.strokeStyle = "#6b4a26"; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(cx + 12, 14); g.lineTo(cx + 13.5, 34); g.stroke();
    poly(g, [[cx + 8.5, 13], [cx + 16, 11], [cx + 17, 19], [cx + 10, 19.5]], lg(g, cx + 8, 11, cx + 17, 19, [[0, "#d7dde6"], [1, "#79808c"]]), OUT);
  }),

  pyromancer: () => make(36, 46, (g) => {
    const cx = 18;
    // staff behind
    g.strokeStyle = "#5f3f1e"; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(cx - 12, 10); g.lineTo(cx - 13.5, 38); g.stroke();
    const orb = rg(g, cx - 12, 7, 6, [[0, "#ffe9a8"], [0.45, "#ff9a3c"], [1, "rgba(255,110,20,0)"]]);
    ell(g, cx - 12, 7, 6, 6, orb);
    ell(g, cx - 12, 7, 2.6, 2.6, "#ffd27a", OUT, 1);
    // robe
    poly(g, [[cx - 6, 15], [cx + 6, 15], [cx + 11, 42], [cx - 11, 42]],
      lg(g, 0, 15, 0, 42, [[0, "#c03434"], [0.6, "#8e2020"], [1, "#5c1212"]]), OUT);
    // sash
    poly(g, [[cx - 7.5, 27], [cx + 7.5, 25.5], [cx + 8, 29], [cx - 7, 30.5]], "#c8a856", OUT, 1);
    // arms folded sleeves
    ell(g, cx - 6.5, 20, 3.4, 5, "#a62828", OUT, 1.2);
    ell(g, cx + 6.5, 20, 3.4, 5, "#a62828", OUT, 1.2);
    // hood + shadowed face
    g.beginPath();
    g.arc(cx, 9.5, 6.8, Math.PI * 0.85, Math.PI * 2.15);
    g.quadraticCurveTo(cx + 7, 15.5, cx, 15.8);
    g.quadraticCurveTo(cx - 7, 15.5, cx - 6.8, 11);
    g.closePath();
    g.fillStyle = lg(g, cx - 7, 3, cx + 7, 16, [[0, "#c03434"], [1, "#6e1616"]]);
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke();
    ell(g, cx, 11, 4.2, 3.6, "#241512");
    g.fillStyle = "#ffb050";
    ell(g, cx - 1.8, 10.8, 1, 1.1, "#ffb050");
    ell(g, cx + 1.8, 10.8, 1, 1.1, "#ffb050");
  }),

  zombie: () => make(36, 44, (g) => {
    const cx = 18;
    legs(g, cx, 31, 4.2, 11, "#4a6b33", "#2c401d");
    // torn torso
    poly(g, [[cx - 8, 14], [cx + 7, 15], [cx + 9, 31], [cx + 2, 29], [cx - 3, 32], [cx - 9, 30]],
      lg(g, 0, 14, 0, 32, [[0, "#5a7a40"], [1, "#33481f"]]), OUT);
    // wounds
    ell(g, cx + 3, 21, 2.2, 1.6, "#3d2020");
    ell(g, cx - 4, 26, 1.7, 1.3, "#3d2020");
    // hanging arms
    rr(g, cx - 12, 15, 4.4, 14, 2.2, "#5a7a40", OUT, 1.2);
    rr(g, cx + 8, 16, 4.4, 15, 2.2, "#516e38", OUT, 1.2);
    ell(g, cx - 9.8, 30, 2.6, 2.2, "#6d8a52");
    ell(g, cx + 10.2, 32, 2.6, 2.2, "#6d8a52");
    // hunched head
    ell(g, cx + 1, 9.5, 6, 5.6, lg(g, cx - 5, 4, cx + 7, 15, [[0, "#7a9660"], [1, "#4a6234"]]), OUT);
    ell(g, cx - 1.2, 8.8, 1.2, 1.4, "#d8d43a");
    ell(g, cx + 3.4, 9.2, 1.2, 1.4, "#d8d43a");
    g.strokeStyle = "#2c401d"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(cx - 1, 12.5); g.lineTo(cx + 4, 12.8); g.stroke();
  }),

  skeleton: () => make(34, 44, (g) => {
    const cx = 17;
    const bone = lg(g, 0, 0, 0, 44, [[0, "#efe8d2"], [1, "#b5ab8c"]]);
    // legs
    g.strokeStyle = "#d9d2ba"; g.lineWidth = 3.4;
    g.beginPath(); g.moveTo(cx - 4, 28); g.lineTo(cx - 5, 41); g.stroke();
    g.beginPath(); g.moveTo(cx + 4, 28); g.lineTo(cx + 5, 41); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 4.6; g.globalCompositeOperation = "destination-over";
    g.beginPath(); g.moveTo(cx - 4, 28); g.lineTo(cx - 5, 41); g.stroke();
    g.beginPath(); g.moveTo(cx + 4, 28); g.lineTo(cx + 5, 41); g.stroke();
    g.globalCompositeOperation = "source-over";
    // pelvis
    ell(g, cx, 27, 5.2, 3, bone, OUT, 1.2);
    // spine + ribcage
    g.strokeStyle = "#e5ddc4"; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(cx, 15); g.lineTo(cx, 26); g.stroke();
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = "#e5ddc4"; g.lineWidth = 1.8;
      g.beginPath(); g.arc(cx, 17.5 + i * 3.2, 5.5 - i * 0.7, 0.15, Math.PI - 0.15); g.stroke();
    }
    // arms
    g.strokeStyle = "#ddd5bc"; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(cx - 6, 16); g.lineTo(cx - 9, 24); g.lineTo(cx - 8, 30); g.stroke();
    g.beginPath(); g.moveTo(cx + 6, 16); g.lineTo(cx + 9, 24); g.lineTo(cx + 8, 30); g.stroke();
    // shoulders
    ell(g, cx - 6, 15.5, 2.4, 2, bone, OUT, 1);
    ell(g, cx + 6, 15.5, 2.4, 2, bone, OUT, 1);
    // skull
    ell(g, cx, 9, 5.6, 5.2, bone, OUT, 1.3);
    rr(g, cx - 3.4, 12, 6.8, 3.4, 1.4, bone, OUT, 1);
    g.fillStyle = "#191410";
    ell(g, cx - 2.2, 8.6, 1.5, 1.8, "#191410");
    ell(g, cx + 2.2, 8.6, 1.5, 1.8, "#191410");
    g.fillRect(cx - 0.6, 11, 1.2, 1.6);
  }),

  archer: () => make(40, 44, (g) => {
    // reuse skeleton body, then add bow
    g.drawImage(DEFS.skeleton(), 0, 0);
    g.strokeStyle = "#8a5a2b"; g.lineWidth = 2.2;
    g.beginPath(); g.arc(29, 20, 9, -Math.PI * 0.42, Math.PI * 0.42); g.stroke();
    g.strokeStyle = "#d8d2c0"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(29 + 9 * Math.cos(-Math.PI * 0.42), 20 + 9 * Math.sin(-Math.PI * 0.42));
    g.lineTo(29 + 9 * Math.cos(Math.PI * 0.42), 20 + 9 * Math.sin(Math.PI * 0.42)); g.stroke();
  }),

  imp: () => make(32, 38, (g) => {
    const cx = 16;
    // tail
    g.strokeStyle = "#a03020"; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(cx + 6, 28); g.quadraticCurveTo(cx + 15, 30, cx + 13, 21); g.stroke();
    // legs
    legs(g, cx, 27, 3.6, 9, "#b04028", "#6e2414");
    // body
    ell(g, cx, 21, 7.5, 8, lg(g, cx - 7, 13, cx + 7, 29, [[0, "#d05838"], [1, "#8e2c16"]]), OUT);
    ell(g, cx, 23, 4.4, 5, "#e8a060");
    // arms with ember glow
    ell(g, cx - 8.5, 22, 2.6, 4.4, "#b04028", OUT, 1.1);
    ell(g, cx + 8.5, 22, 2.6, 4.4, "#b04028", OUT, 1.1);
    ell(g, cx - 9, 27, 3.4, 3.4, rg(g, cx - 9, 27, 3.6, [[0, "#ffd27a"], [0.6, "#ff8030"], [1, "rgba(255,110,20,0)"]]));
    // big head + horns
    poly(g, [[cx - 6, 6], [cx - 10, 0.5], [cx - 3.6, 3.4]], "#e8d8b8", OUT, 1.1);
    poly(g, [[cx + 6, 6], [cx + 10, 0.5], [cx + 3.6, 3.4]], "#e8d8b8", OUT, 1.1);
    ell(g, cx, 9, 7.6, 6.4, lg(g, cx - 7, 3, cx + 7, 15, [[0, "#e06840"], [1, "#9e3418"]]), OUT);
    ell(g, cx - 2.8, 8.4, 1.5, 1.7, "#ffe060");
    ell(g, cx + 2.8, 8.4, 1.5, 1.7, "#ffe060");
    g.strokeStyle = "#5c1808"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(cx - 2.4, 12.4); g.lineTo(cx + 2.4, 12.4); g.stroke();
  }),

  bat: () => make(36, 24, (g) => {
    const cx = 18, cy = 12;
    const wing = (dir: number) => {
      g.beginPath();
      g.moveTo(cx + dir * 3, cy);
      g.quadraticCurveTo(cx + dir * 10, cy - 9, cx + dir * 17, cy - 5);
      g.quadraticCurveTo(cx + dir * 13, cy - 1, cx + dir * 14, cy + 3);
      g.quadraticCurveTo(cx + dir * 9, cy + 1, cx + dir * 8, cy + 5);
      g.quadraticCurveTo(cx + dir * 5, cy + 2, cx + dir * 3, cy + 3);
      g.closePath();
      g.fillStyle = lg(g, cx, cy - 8, cx, cy + 6, [[0, "#8a5ab0"], [1, "#4d2a66"]]);
      g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    };
    wing(-1); wing(1);
    ell(g, cx, cy + 1, 4.4, 5, lg(g, cx - 4, cy - 4, cx + 4, cy + 6, [[0, "#7a4aa0"], [1, "#3d2154"]]), OUT, 1.2);
    poly(g, [[cx - 3, cy - 3], [cx - 4.6, cy - 8], [cx - 1.4, cy - 4.6]], "#5d3580", OUT, 1);
    poly(g, [[cx + 3, cy - 3], [cx + 4.6, cy - 8], [cx + 1.4, cy - 4.6]], "#5d3580", OUT, 1);
    ell(g, cx - 1.6, cy - 0.5, 0.9, 1, "#ff5050");
    ell(g, cx + 1.6, cy - 0.5, 0.9, 1, "#ff5050");
  }),

  brute: () => make(52, 54, (g) => {
    const cx = 26;
    legs(g, cx, 38, 6.5, 14, "#6e5230", "#3f2d18");
    // loincloth
    poly(g, [[cx - 8, 36], [cx + 8, 36], [cx + 6, 45], [cx - 6, 45]], "#4a3520", OUT, 1.2);
    // massive torso
    ell(g, cx, 26, 15, 13.5, lg(g, cx - 14, 13, cx + 14, 39, [[0, "#96703e"], [0.55, "#77552c"], [1, "#4d3418"]]), OUT, 1.6);
    ell(g, cx, 30, 8.5, 8, "#a8845a");
    // scars
    g.strokeStyle = "#5c3a1c"; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(cx - 8, 20); g.lineTo(cx - 3, 25); g.stroke();
    // huge arms
    ell(g, cx - 16, 26, 5.4, 9.5, lg(g, cx - 21, 17, cx - 11, 35, [[0, "#8d693a"], [1, "#553a1c"]]), OUT, 1.4);
    ell(g, cx + 16, 26, 5.4, 9.5, lg(g, cx + 11, 17, cx + 21, 35, [[0, "#8d693a"], [1, "#553a1c"]]), OUT, 1.4);
    ell(g, cx - 17, 35, 4.4, 3.8, "#a8845a", OUT, 1.2);
    ell(g, cx + 17, 35, 4.4, 3.8, "#a8845a", OUT, 1.2);
    // small head
    ell(g, cx, 11.5, 6.4, 5.8, lg(g, cx - 6, 6, cx + 6, 17, [[0, "#96703e"], [1, "#5d3f1e"]]), OUT, 1.3);
    ell(g, cx - 2.4, 10.6, 1.2, 1.4, "#e04830");
    ell(g, cx + 2.4, 10.6, 1.2, 1.4, "#e04830");
    // tusks
    poly(g, [[cx - 3.4, 14.5], [cx - 4.4, 10.8], [cx - 2, 13.6]], "#e8dcc0", OUT, 0.9);
    poly(g, [[cx + 3.4, 14.5], [cx + 4.4, 10.8], [cx + 2, 13.6]], "#e8dcc0", OUT, 0.9);
  }),

  boss: () => make(60, 62, (g) => {
    const cx = 30;
    // aura
    ell(g, cx, 34, 26, 24, rg(g, cx, 34, 27, [[0, "rgba(150,60,190,0.28)"], [1, "rgba(150,60,190,0)"]]));
    // robes
    poly(g, [[cx - 11, 20], [cx + 11, 20], [cx + 19, 58], [cx - 19, 58]],
      lg(g, 0, 20, 0, 58, [[0, "#5d2a80"], [0.55, "#3c1a54"], [1, "#22102e"]]), OUT, 1.7);
    // robe glow trim
    g.strokeStyle = "rgba(200,120,255,0.55)"; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cx - 11, 21); g.quadraticCurveTo(cx, 27, cx + 11, 21); g.stroke();
    // shoulders
    ell(g, cx - 12, 22, 6.4, 5, lg(g, cx - 18, 17, cx - 6, 27, [[0, "#7a3ca6"], [1, "#3c1a54"]]), OUT, 1.4);
    ell(g, cx + 12, 22, 6.4, 5, lg(g, cx + 6, 17, cx + 18, 27, [[0, "#7a3ca6"], [1, "#3c1a54"]]), OUT, 1.4);
    // floating orbs
    for (const [ox, oy] of [[-20, 34], [20, 34]] as [number, number][]) {
      ell(g, cx + ox, oy, 4.6, 4.6, rg(g, cx + ox, oy, 5, [[0, "#e8b0ff"], [0.5, "#a040d8"], [1, "rgba(140,40,200,0)"]]));
    }
    // skull head
    ell(g, cx, 12, 7.6, 7, lg(g, cx - 7, 5, cx + 7, 19, [[0, "#efe8d2"], [1, "#a89e80"]]), OUT, 1.4);
    rr(g, cx - 4.4, 16, 8.8, 4, 1.8, "#d9d2ba", OUT, 1);
    ell(g, cx - 3, 11.5, 2, 2.4, "#12071a");
    ell(g, cx + 3, 11.5, 2, 2.4, "#12071a");
    ell(g, cx - 3, 11.5, 1, 1.2, "#d060ff");
    ell(g, cx + 3, 11.5, 1, 1.2, "#d060ff");
    // crown of horns
    poly(g, [[cx - 7, 7], [cx - 11, -0.5], [cx - 4.4, 4.4]], "#3c1a54", OUT, 1.1);
    poly(g, [[cx + 7, 7], [cx + 11, -0.5], [cx + 4.4, 4.4]], "#3c1a54", OUT, 1.1);
    poly(g, [[cx - 2.4, 4.4], [cx, -2.5], [cx + 2.4, 4.4]], "#7a3ca6", OUT, 1.1);
  }),

  // ============================ OBJECTS ============================
  torch: () => make(22, 42, (g) => {
    rr(g, 9, 14, 4, 24, 2, lg(g, 9, 14, 13, 38, [[0, "#7a5228"], [1, "#3f2a12"]]), OUT, 1.2);
    rr(g, 7, 13, 8, 4, 1.5, "#4c4c54", OUT, 1);
    ell(g, 11, 8, 8, 9.5, rg(g, 11, 9, 10, [[0, "rgba(255,220,140,0.9)"], [0.45, "rgba(255,140,40,0.55)"], [1, "rgba(255,110,20,0)"]]));
    g.beginPath();
    g.moveTo(11, 0.5);
    g.quadraticCurveTo(16, 6, 13.4, 11);
    g.quadraticCurveTo(11.6, 13.4, 8.6, 11);
    g.quadraticCurveTo(6, 6, 11, 0.5);
    g.closePath();
    g.fillStyle = lg(g, 11, 0, 11, 13, [[0, "#ffe9a8"], [0.55, "#ff9a3c"], [1, "#e05510"]]);
    g.fill();
    ell(g, 11, 9, 1.8, 2.6, "#fff3cf");
  }),

  chest: () => make(42, 34, (g) => {
    rr(g, 3, 14, 36, 17, 3, lg(g, 3, 14, 3, 31, [[0, "#8a5a2b"], [1, "#4c2f13"]]), OUT, 1.5);
    g.beginPath();
    g.moveTo(3, 16); g.quadraticCurveTo(21, 2, 39, 16); g.lineTo(39, 19); g.lineTo(3, 19);
    g.closePath();
    g.fillStyle = lg(g, 3, 4, 3, 19, [[0, "#a06c36"], [1, "#5d3a19"]]);
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke();
    for (const x of [10, 32]) {
      rr(g, x - 2, 7.5 + (x === 10 ? 2.5 : 2.5), 4, 23 - (x === 10 ? 2.5 : 2.5), 1.4, "#3c3c44", OUT, 0.9);
    }
    rr(g, 17.5, 14, 7, 8, 2, "#c8a856", OUT, 1.1);
    ell(g, 21, 17.5, 1.4, 2, "#5c4210");
  }),

  shrine: () => make(38, 48, (g) => {
    // pedestal
    poly(g, [[8, 44], [30, 44], [26, 30], [12, 30]], lg(g, 0, 30, 0, 44, [[0, "#8a8478"], [1, "#4c473e"]]), OUT, 1.4);
    rr(g, 6, 43, 26, 4, 1.6, "#5c574c", OUT, 1.2);
    rr(g, 12.5, 28.5, 13, 3.4, 1.4, "#6d675c", OUT, 1.1);
    // glow
    ell(g, 19, 15, 12, 13, rg(g, 19, 15, 13, [[0, "rgba(120,220,235,0.5)"], [1, "rgba(90,200,216,0)"]]));
    // floating crystal
    poly(g, [[19, 3], [26, 15], [19, 27], [12, 15]],
      lg(g, 12, 3, 26, 27, [[0, "#bdf2fa"], [0.5, "#5ac8d8"], [1, "#1f7a88"]]), OUT, 1.3);
    g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(19, 3); g.lineTo(19, 27); g.stroke();
  }),

  stash: () => make(46, 38, (g) => {
    rr(g, 3, 8, 40, 27, 3.5, lg(g, 3, 8, 3, 35, [[0, "#6d4a24"], [1, "#38230e"]]), OUT, 1.6);
    rr(g, 3, 8, 40, 8, 3.5, lg(g, 3, 8, 3, 16, [[0, "#8a5f30"], [1, "#5d3d1c"]]), OUT, 1.2);
    for (const x of [11, 35]) rr(g, x - 2.2, 6, 4.4, 30, 1.6, "#41414b", OUT, 1);
    rr(g, 19, 16, 8, 10, 1.8, "#c8a856", OUT, 1.2);
    ell(g, 23, 20.5, 1.5, 2.2, "#503a0c");
    g.strokeStyle = "rgba(255,230,150,0.25)"; g.lineWidth = 1;
    g.strokeRect(6.5, 11, 33, 21);
  }),

  well: () => make(46, 38, (g) => {
    ell(g, 23, 24, 19, 11, lg(g, 4, 13, 42, 35, [[0, "#8a8478"], [1, "#55504a"]]), OUT, 1.6);
    ell(g, 23, 22, 14.5, 7.5, "#3a3630");
    ell(g, 23, 22, 13, 6.6, lg(g, 10, 16, 36, 28, [[0, "#3a68b0"], [0.6, "#1d3a70"], [1, "#0e2148"]]));
    ell(g, 18, 20, 4.4, 1.8, "rgba(160,210,255,0.35)");
    g.strokeStyle = "#6d675c"; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(8, 22); g.lineTo(8, 8); g.stroke();
    g.beginPath(); g.moveTo(38, 22); g.lineTo(38, 8); g.stroke();
    rr(g, 5, 4, 36, 5, 2.4, "#6d4a24", OUT, 1.2);
  }),

  waypoint: () => make(48, 32, (g) => {
    ell(g, 24, 18, 21, 11.5, rg(g, 24, 18, 21, [[0, "rgba(90,200,216,0.45)"], [1, "rgba(90,200,216,0)"]]));
    ell(g, 24, 18, 17, 9, lg(g, 7, 9, 41, 27, [[0, "#7c766a"], [1, "#45403a"]]), OUT, 1.5);
    ell(g, 24, 18, 12, 6.2, "#2b2826");
    ell(g, 24, 18, 8.5, 4.4, rg(g, 24, 18, 9, [[0, "#bdf2fa"], [0.6, "#5ac8d8"], [1, "#17505a"]]));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ell(g, 24 + Math.cos(a) * 14.5, 18 + Math.sin(a) * 7.4, 1.5, 1, "#8adfec");
    }
  }),

  vendor: () => make(52, 50, (g) => {
    const cx = 26;
    // figure behind the counter
    poly(g, [[cx - 7, 12], [cx + 7, 12], [cx + 10, 34], [cx - 10, 34]],
      lg(g, 0, 12, 0, 34, [[0, "#8a6a9e"], [0.6, "#63477a"], [1, "#412f52"]]), OUT, 1.3);
    ell(g, cx - 8, 17, 3, 4.6, "#7a5a90", OUT, 1.1);
    ell(g, cx + 8, 17, 3, 4.6, "#7a5a90", OUT, 1.1);
    // head + headscarf
    ell(g, cx, 7.5, 5.4, 5.6, "#d9a066");
    g.beginPath();
    g.arc(cx, 6.6, 6, Math.PI * 0.9, Math.PI * 2.1);
    g.quadraticCurveTo(cx + 6.6, 10.5, cx + 3, 10.5);
    g.lineTo(cx - 3, 10.5);
    g.quadraticCurveTo(cx - 6.6, 10.5, cx - 6, 6.6);
    g.closePath();
    g.fillStyle = lg(g, cx - 6, 1, cx + 6, 11, [[0, "#e0b45c"], [1, "#96702a"]]);
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    ell(g, cx - 2, 8.2, 0.9, 1.1, "#3a2414");
    ell(g, cx + 2, 8.2, 0.9, 1.1, "#3a2414");
    // wooden counter in front
    rr(g, 2, 30, 48, 6, 2, lg(g, 2, 30, 2, 36, [[0, "#96703c"], [1, "#5d3f1e"]]), OUT, 1.3);
    rr(g, 4, 36, 44, 10, 2, lg(g, 4, 36, 4, 46, [[0, "#6d4a24"], [1, "#3c250e"]]), OUT, 1.3);
    // wares on the counter: two potions and a coin stack
    ell(g, 12, 27.5, 3, 4, lg(g, 9, 24, 15, 31, [[0, "#e05555"], [1, "#7c1212"]]), OUT, 1);
    rr(g, 10.8, 22.5, 2.4, 2.6, 1, "#a5794a", OUT, 0.8);
    ell(g, 20, 27.5, 3, 4, lg(g, 17, 24, 23, 31, [[0, "#5560e0"], [1, "#1a2280"]]), OUT, 1);
    rr(g, 18.8, 22.5, 2.4, 2.6, 1, "#a5794a", OUT, 0.8);
    ell(g, 38, 28.5, 4.6, 2.4, lg(g, 33, 26, 43, 31, [[0, "#ffe08a"], [1, "#96702a"]]), OUT, 1);
    ell(g, 38, 26.4, 4.2, 2.2, lg(g, 34, 24, 42, 29, [[0, "#ffe9a8"], [1, "#a8823a"]]), OUT, 1);
  }),

  gambler: () => make(44, 50, (g) => {
    const cx = 22;
    legs(g, cx, 36, 4.4, 11, "#2e3a2a", "#182116");
    // long coat
    poly(g, [[cx - 8, 15], [cx + 8, 15], [cx + 11, 38], [cx + 4, 36], [cx - 4, 36], [cx - 11, 38]],
      lg(g, 0, 15, 0, 38, [[0, "#3d5438"], [0.6, "#2a3d26"], [1, "#182415"]]), OUT, 1.3);
    // gold trim + coin chain
    g.strokeStyle = "#c8a856"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(cx - 5, 16); g.lineTo(cx - 4, 34); g.stroke();
    // arms — one raised, shaking dice
    ell(g, cx - 9.5, 20, 3, 5.2, "#33482e", OUT, 1.1);
    ell(g, cx + 10, 16.5, 3, 5, "#33482e", OUT, 1.1);
    ell(g, cx + 11, 12.5, 2.6, 2.2, "#d9a066", OUT, 1);
    // dice above the open hand
    const die = (x: number, y: number, rot: number) => {
      g.save();
      g.translate(x, y); g.rotate(rot);
      rr(g, -3, -3, 6, 6, 1.4, lg(g, -3, -3, 3, 3, [[0, "#f6f2e6"], [1, "#c2bca8"]]), OUT, 1);
      g.fillStyle = "#22201a";
      ell(g, 0, 0, 0.8, 0.8, "#22201a");
      ell(g, -1.6, -1.6, 0.7, 0.7, "#22201a");
      ell(g, 1.6, 1.6, 0.7, 0.7, "#22201a");
      g.restore();
    };
    die(cx + 8.5, 6.5, 0.4);
    die(cx + 14.5, 8.5, -0.3);
    // head with wide-brim hat
    ell(g, cx, 11.5, 5, 5.2, "#d9a066");
    ell(g, cx - 1.6, 12, 0.9, 1, "#2c1c10");
    ell(g, cx + 2, 12, 0.9, 1, "#2c1c10");
    ell(g, cx, 8, 8.4, 2.6, lg(g, cx - 8, 6, cx + 8, 10, [[0, "#3a3126"], [1, "#1e1810"]]), OUT, 1.2);
    g.beginPath();
    g.arc(cx, 8, 5, Math.PI, Math.PI * 2);
    g.closePath();
    g.fillStyle = "#2a2318"; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.1; g.stroke();
    g.strokeStyle = "#c8a856"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx - 4.6, 6.8); g.lineTo(cx + 4.6, 6.8); g.stroke();
  }),

  // ============================ ITEMS ============================
  sword: () => make(32, 32, (g) => {
    poly(g, [[24.5, 3], [28.5, 7], [12, 23.5], [8.5, 20]],
      lg(g, 8, 20, 28, 6, [[0, "#8b93a2"], [0.5, "#e6ebf2"], [1, "#9aa2b0"]]), OUT, 1.2);
    g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(26, 6); g.lineTo(11, 21); g.stroke();
    g.strokeStyle = "#c8a856"; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(6.5, 17.5); g.lineTo(13.5, 24.5); g.stroke();
    g.strokeStyle = "#6b4a26"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(9.5, 21.5); g.lineTo(5, 26); g.stroke();
    ell(g, 4, 27.5, 2.2, 2.2, "#c8a856", OUT, 1);
  }),

  axe: () => make(32, 32, (g) => {
    g.strokeStyle = "#6b4a26"; g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(20, 6); g.lineTo(9, 27); g.stroke();
    g.beginPath();
    g.moveTo(17, 4);
    g.quadraticCurveTo(29, 4, 27.5, 16);
    g.quadraticCurveTo(23, 11, 16.5, 11.5);
    g.closePath();
    g.fillStyle = lg(g, 16, 4, 28, 16, [[0, "#dfe5ee"], [1, "#7d8592"]]);
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
  }),

  mace: () => make(32, 32, (g) => {
    g.strokeStyle = "#6b4a26"; g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(19, 12); g.lineTo(10, 28); g.stroke();
    ell(g, 21, 9, 7, 7, rg(g, 19, 7, 9, [[0, "#c9cfd9"], [1, "#5f6570"]]), OUT, 1.2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      poly(g, [[21 + Math.cos(a) * 6, 9 + Math.sin(a) * 6], [21 + Math.cos(a + 0.35) * 10.5, 9 + Math.sin(a + 0.35) * 10.5], [21 + Math.cos(a + 0.7) * 6, 9 + Math.sin(a + 0.7) * 6]], "#9aa2b0", OUT, 0.8);
    }
  }),

  staff: () => make(32, 32, (g) => {
    g.strokeStyle = "#5f3f1e"; g.lineWidth = 2.8;
    g.beginPath(); g.moveTo(22, 8); g.quadraticCurveTo(16, 16, 9, 28); g.stroke();
    ell(g, 23, 7, 6.4, 6.4, rg(g, 23, 7, 7, [[0, "rgba(122,216,255,0.85)"], [1, "rgba(60,140,200,0)"]]));
    poly(g, [[23, 2], [27, 7], [23, 12], [19, 7]], lg(g, 19, 2, 27, 12, [[0, "#bdf2fa"], [1, "#2a7a88"]]), OUT, 1.1);
  }),

  shield: () => make(32, 32, (g) => {
    g.beginPath();
    g.moveTo(16, 3);
    g.quadraticCurveTo(27, 4.5, 27, 12);
    g.quadraticCurveTo(27, 22, 16, 29);
    g.quadraticCurveTo(5, 22, 5, 12);
    g.quadraticCurveTo(5, 4.5, 16, 3);
    g.closePath();
    g.fillStyle = lg(g, 5, 3, 27, 29, [[0, "#a8afbc"], [0.55, "#6d7480"], [1, "#434852"]]);
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke();
    g.strokeStyle = "#c8a856"; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(16, 6); g.lineTo(16, 25.5); g.moveTo(7.5, 13); g.lineTo(24.5, 13); g.stroke();
    ell(g, 16, 13, 3, 3, "#c8a856", OUT, 1);
  }),

  body: () => make(32, 32, (g) => {
    g.beginPath();
    g.moveTo(9, 5);
    g.lineTo(13, 3.5); g.quadraticCurveTo(16, 6, 19, 3.5); g.lineTo(23, 5);
    g.quadraticCurveTo(28, 8, 26.5, 13);
    g.lineTo(24, 27); g.quadraticCurveTo(16, 30.5, 8, 27);
    g.lineTo(5.5, 13);
    g.quadraticCurveTo(4, 8, 9, 5);
    g.closePath();
    g.fillStyle = lg(g, 5, 3, 27, 30, [[0, "#b0b7c4"], [0.5, "#79808c"], [1, "#4a4f59"]]);
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.3)"; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(16, 7); g.lineTo(16, 26); g.stroke();
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.beginPath(); g.moveTo(9, 14); g.quadraticCurveTo(16, 17, 23, 14); g.stroke();
  }),

  helm: () => make(32, 32, (g) => {
    g.beginPath();
    g.moveTo(6, 17);
    g.quadraticCurveTo(6, 5, 16, 5);
    g.quadraticCurveTo(26, 5, 26, 17);
    g.lineTo(26, 24); g.lineTo(21, 24); g.lineTo(21, 17.5);
    g.lineTo(11, 17.5); g.lineTo(11, 24); g.lineTo(6, 24);
    g.closePath();
    g.fillStyle = lg(g, 6, 5, 26, 24, [[0, "#c3c9d4"], [0.55, "#7f8692"], [1, "#4c515b"]]);
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke();
    g.strokeStyle = "#c8a856"; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(16, 5); g.lineTo(16, 11); g.stroke();
    g.fillStyle = "#191410";
    g.fillRect(9, 13.5, 14, 2.4);
  }),

  gloves: () => make(32, 32, (g) => {
    rr(g, 9, 4, 14, 12, 4, lg(g, 9, 4, 23, 16, [[0, "#8a6a3c"], [1, "#54401f"]]), OUT, 1.3);
    for (let i = 0; i < 4; i++) rr(g, 9.6 + i * 3.4, 14, 2.8, 9 + (i === 1 || i === 2 ? 2.5 : 0), 1.4, "#6d5227", OUT, 0.9);
    rr(g, 5, 12, 5, 7, 2.2, "#6d5227", OUT, 1);
    rr(g, 8.5, 3, 15, 4, 1.6, "#43484f", OUT, 1);
  }),

  boots: () => make(32, 32, (g) => {
    g.beginPath();
    g.moveTo(10, 5); g.lineTo(18, 5); g.lineTo(18.5, 17);
    g.quadraticCurveTo(26, 18, 27, 24);
    g.quadraticCurveTo(27, 27, 23, 27);
    g.lineTo(10.5, 27);
    g.closePath();
    g.fillStyle = lg(g, 10, 5, 26, 27, [[0, "#7d5c2f"], [1, "#443113"]]);
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.3; g.stroke();
    rr(g, 9, 25, 19, 3.6, 1.6, "#2e2210", OUT, 1);
    rr(g, 9.4, 4, 9.6, 3.6, 1.4, "#93703c", OUT, 1);
  }),

  belt: () => make(32, 32, (g) => {
    rr(g, 3, 12, 26, 8, 3.4, lg(g, 3, 12, 3, 20, [[0, "#7d5c2f"], [1, "#4a3416"]]), OUT, 1.3);
    rr(g, 12.5, 10.5, 7.5, 11, 2, "#c8a856", OUT, 1.2);
    rr(g, 15, 13, 2.6, 6, 1, "#4a3416");
    for (const x of [7, 25]) ell(g, x, 16, 1.1, 1.1, "#2c1e0a");
  }),

  ring: () => make(32, 32, (g) => {
    g.beginPath();
    g.ellipse(16, 18, 8, 8, 0, 0, Math.PI * 2);
    g.ellipse(16, 18, 4.6, 4.6, 0, 0, Math.PI * 2);
    g.fillStyle = lg(g, 8, 10, 24, 26, [[0, "#f2dd9a"], [0.5, "#c8a856"], [1, "#8a6d2a"]]);
    g.fill("evenodd");
    g.strokeStyle = OUT; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(16, 18, 8, 8, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(16, 18, 4.6, 4.6, 0, 0, Math.PI * 2); g.stroke();
    poly(g, [[16, 4.5], [20, 8.5], [16, 12.5], [12, 8.5]], lg(g, 12, 4, 20, 13, [[0, "#ff9a9a"], [1, "#a01c1c"]]), OUT, 1.1);
  }),

  amulet: () => make(32, 32, (g) => {
    g.strokeStyle = "#c8a856"; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(8, 3); g.quadraticCurveTo(16, 12, 24, 3); g.stroke();
    g.strokeStyle = OUT; g.lineWidth = 0.7;
    ell(g, 16, 19, 6.5, 8, lg(g, 10, 11, 22, 27, [[0, "#7ad8e8"], [0.5, "#2a8a9a"], [1, "#124a54"]]), OUT, 1.2);
    ell(g, 14, 16, 2, 2.6, "rgba(255,255,255,0.45)");
    rr(g, 13.6, 9.5, 4.8, 3.4, 1.4, "#c8a856", OUT, 1);
  }),

  rune: () => make(32, 32, (g) => {
    g.beginPath();
    g.moveTo(16, 4); g.lineTo(25, 9); g.lineTo(26, 21); g.lineTo(16, 28); g.lineTo(6, 21); g.lineTo(7, 9);
    g.closePath();
    g.fillStyle = lg(g, 6, 4, 26, 28, [[0, "#8a8478"], [0.55, "#5d574c"], [1, "#38342c"]]);
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke();
    g.strokeStyle = "#ffab48"; g.lineWidth = 2;
    g.shadowColor = "#ff8820"; g.shadowBlur = 5;
    g.beginPath();
    g.moveTo(12, 21.5); g.lineTo(16, 9); g.lineTo(20, 21.5); g.moveTo(13.4, 17); g.lineTo(18.6, 17);
    g.stroke();
    g.shadowBlur = 0;
  }),

  dust: () => make(32, 32, (g) => {
    ell(g, 16, 23, 10, 4.6, lg(g, 6, 18, 26, 28, [[0, "#cfd2e2"], [1, "#8085a5"]]), OUT, 1.2);
    ell(g, 12, 20.5, 4.4, 2.6, "#e2e4f0");
    for (const [x, y, r] of [[10, 13, 1.4], [17, 9, 1.8], [23, 14, 1.2], [14, 15.5, 1]] as [number, number, number][]) {
      ell(g, x, y, r, r, rg(g, x, y, r * 2.4, [[0, "#ffffff"], [0.5, "#b8bede"], [1, "rgba(160,170,220,0)"]]));
    }
  }),

  shard: () => make(32, 32, (g) => {
    ell(g, 16, 16, 11, 12, rg(g, 16, 16, 12, [[0, "rgba(122,216,255,0.4)"], [1, "rgba(90,180,230,0)"]]));
    poly(g, [[16, 3], [23, 12], [19.5, 27], [12.5, 27], [9, 12]],
      lg(g, 9, 3, 23, 27, [[0, "#dff6ff"], [0.45, "#6ec8ea"], [1, "#1f6a8a"]]), OUT, 1.2);
    g.strokeStyle = "rgba(255,255,255,0.65)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(16, 3); g.lineTo(14.5, 27); g.stroke();
  }),

  soulember: () => make(32, 32, (g) => {
    ell(g, 16, 17, 12, 12, rg(g, 16, 17, 12.5, [[0, "rgba(255,150,60,0.5)"], [1, "rgba(255,120,40,0)"]]));
    g.beginPath();
    g.moveTo(16, 4);
    g.quadraticCurveTo(23.5, 11, 22, 19);
    g.quadraticCurveTo(20.5, 26.5, 16, 27);
    g.quadraticCurveTo(11.5, 26.5, 10, 19);
    g.quadraticCurveTo(8.5, 11, 16, 4);
    g.closePath();
    g.fillStyle = lg(g, 16, 4, 16, 27, [[0, "#ffd27a"], [0.45, "#ff8030"], [1, "#a02808"]]);
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.2; g.stroke();
    ell(g, 16, 18, 3.4, 4.6, rg(g, 16, 18, 5, [[0, "#e8b0ff"], [1, "#8030b0"]]));
  }),

  hpot: () => potion("#e05555", "#7c1212"),
  mpot: () => potion("#5560e0", "#1a2280"),

  gold: () => make(32, 32, (g) => {
    const coin = (x: number, y: number) => {
      ell(g, x, y, 5.6, 3.4, lg(g, x - 5, y - 3, x + 5, y + 3, [[0, "#ffe08a"], [0.5, "#d8ab4a"], [1, "#96702a"]]), OUT, 1.1);
      ell(g, x, y - 0.6, 3.4, 1.8, "rgba(255,240,190,0.55)");
    };
    coin(11, 24); coin(21, 24); coin(16, 20.5);
    coin(12, 16); coin(20, 15.5); coin(16, 11);
  }),
};

function potion(liquid: string, dark: string): HTMLCanvasElement {
  return make(32, 32, (g) => {
    // flask
    g.beginPath();
    g.moveTo(13, 6); g.lineTo(13, 11);
    g.quadraticCurveTo(6, 15, 6.5, 21.5);
    g.quadraticCurveTo(7, 28.5, 16, 28.5);
    g.quadraticCurveTo(25, 28.5, 25.5, 21.5);
    g.quadraticCurveTo(26, 15, 19, 11);
    g.lineTo(19, 6);
    g.closePath();
    g.fillStyle = "rgba(200,220,235,0.28)";
    g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.4; g.stroke();
    // liquid
    g.save();
    g.beginPath();
    g.moveTo(13, 14); g.quadraticCurveTo(7.5, 16.5, 7.8, 21.5);
    g.quadraticCurveTo(8.2, 27.2, 16, 27.2);
    g.quadraticCurveTo(23.8, 27.2, 24.2, 21.5);
    g.quadraticCurveTo(24.5, 16.5, 19, 14);
    g.closePath();
    g.clip();
    g.fillStyle = lg(g, 8, 14, 24, 28, [[0, liquid], [1, dark]]);
    g.fillRect(6, 13, 20, 16);
    ell(g, 12.5, 18.5, 2.6, 1.6, "rgba(255,255,255,0.35)");
    g.restore();
    // cork
    rr(g, 12.4, 3, 7.2, 4.6, 1.6, lg(g, 12, 3, 12, 8, [[0, "#a5794a"], [1, "#5d3f1e"]]), OUT, 1.1);
  });
}

// gems: one faceted diamond, tinted per type
const GEM_TINTS: Record<string, [string, string, string]> = {
  gem_ruby: ["#ffb0b0", "#d02828", "#701010"],
  gem_sapphire: ["#a8c0ff", "#2848d0", "#101c70"],
  gem_topaz: ["#fff0a8", "#e0b428", "#8a6a10"],
  gem_emerald: ["#b0ffc8", "#28a848", "#0e5c24"],
  gem_skull: ["#f2ecd8", "#b8ae90", "#5c5340"],
};

function gemSprite(key: string): HTMLCanvasElement {
  const [hi, mid, lo] = GEM_TINTS[key];
  return make(32, 32, (g) => {
    if (key === "gem_skull") {
      // skull gem gets an actual tiny skull
      ell(g, 16, 14, 8.4, 8, lg(g, 8, 6, 24, 22, [[0, hi], [1, lo]]), OUT, 1.3);
      rr(g, 11.5, 19.5, 9, 5, 2, mid, OUT, 1);
      ell(g, 12.8, 13, 2.4, 3, "#191410");
      ell(g, 19.2, 13, 2.4, 3, "#191410");
      g.fillStyle = "#191410";
      g.fillRect(15.2, 16.5, 1.6, 2.6);
      for (let i = 0; i < 3; i++) g.fillRect(12.8 + i * 2.6, 21, 1.4, 2.6);
      return;
    }
    ell(g, 16, 17, 11, 11, rg(g, 16, 17, 11.5, [[0, mid + "55"], [1, mid + "00"]]));
    poly(g, [[16, 5], [26, 13], [16, 28], [6, 13]], lg(g, 6, 5, 26, 28, [[0, hi], [0.45, mid], [1, lo]]), OUT, 1.3);
    poly(g, [[16, 5], [21, 13], [16, 11.5], [11, 13]], "rgba(255,255,255,0.4)");
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(6, 13); g.lineTo(26, 13); g.moveTo(16, 5); g.lineTo(16, 28); g.stroke();
  });
}

const cache = new Map<string, HTMLCanvasElement>();

export function getSprite(key: string): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  if (key.startsWith("gem_") && GEM_TINTS[key]) c = gemSprite(key);
  else c = (DEFS[key] ?? DEFS.dust)();
  cache.set(key, c);
  return c;
}

// Skill icons: procedural symbols on a dark plate.
const iconCache = new Map<string, HTMLCanvasElement>();
export function getSkillIcon(id: string): HTMLCanvasElement {
  let c = iconCache.get(id);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = 32; c.height = 32;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 32, 32);
  bg.addColorStop(0, "#1c1610");
  bg.addColorStop(1, "#0c0906");
  g.fillStyle = bg;
  g.fillRect(0, 0, 32, 32);
  const cx = 16, cy = 16;
  const sym: Record<string, () => void> = {
    basic: () => { g.strokeStyle = "#c8c8c8"; g.lineWidth = 3; g.beginPath(); g.moveTo(8, 24); g.lineTo(24, 8); g.stroke(); },
    bash: () => { g.fillStyle = "#c87830"; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill(); g.strokeStyle = "#ffdda0"; g.lineWidth = 2; g.stroke(); },
    cleave: () => { g.strokeStyle = "#d0d0d0"; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy + 6, 12, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); },
    sweep: () => {
      g.strokeStyle = "#d0d0d0"; g.lineWidth = 2.6;
      g.beginPath(); g.arc(cx, cy, 10, 0.3, Math.PI * 1.75); g.stroke();
      g.fillStyle = "#d0d0d0";
      g.beginPath(); g.moveTo(cx + 10.5, cy + 6); g.lineTo(cx + 5, cy + 3); g.lineTo(cx + 9, cy - 1); g.closePath(); g.fill();
      g.fillStyle = "#c87830"; g.beginPath(); g.arc(cx, cy, 3.4, 0, 7); g.fill();
    },
    slam: () => { g.fillStyle = "#b08040"; for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; g.fillRect(cx + Math.cos(a) * 8 - 2, cy + Math.sin(a) * 8 - 2, 4, 4); } },
    warcry: () => { g.strokeStyle = "#e8c860"; g.lineWidth = 2; for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(cx, cy, i * 4.4, -0.6, 0.6); g.stroke(); g.beginPath(); g.arc(cx, cy, i * 4.4, Math.PI - 0.6, Math.PI + 0.6); g.stroke(); } },
    ironskin: () => { g.fillStyle = "#9ba0a8"; g.beginPath(); g.moveTo(16, 5); g.lineTo(26, 10); g.lineTo(24, 22); g.lineTo(16, 28); g.lineTo(8, 22); g.lineTo(6, 10); g.closePath(); g.fill(); },
    frenzy: () => { g.strokeStyle = "#e05555"; g.lineWidth = 3; g.beginPath(); g.moveTo(6, 20); g.lineTo(14, 12); g.lineTo(12, 22); g.lineTo(26, 8); g.stroke(); },
    firebolt: () => { g.fillStyle = "#ff9a3c"; g.beginPath(); g.arc(cx + 4, cy - 4, 6, 0, 7); g.fill(); g.fillStyle = "#c85a10"; g.beginPath(); g.moveTo(6, 26); g.lineTo(16, 12); g.lineTo(12, 22); g.closePath(); g.fill(); },
    fireball: () => { const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 11); gr.addColorStop(0, "#ffe9a8"); gr.addColorStop(0.5, "#ff9a3c"); gr.addColorStop(1, "#902808"); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 11, 0, 7); g.fill(); },
    frostnova: () => { g.strokeStyle = "#7ad8ff"; g.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12); g.stroke(); } },
    firenova: () => {
      g.strokeStyle = "#ff9a3c"; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.stroke();
      g.strokeStyle = "#ffd27a"; g.lineWidth = 1.6;
      g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.stroke();
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; g.fillStyle = "#ff7020"; g.beginPath(); g.arc(cx + Math.cos(a) * 12.5, cy + Math.sin(a) * 12.5, 1.6, 0, 7); g.fill(); }
    },
    teleport: () => { g.strokeStyle = "#b080ff"; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, 6, 11, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(cx, cy, 11, 6, 0, 0, 7); g.stroke(); },
    whirlwind: () => {
      g.strokeStyle = "#d0d0d0"; g.lineWidth = 2.4;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(cx, cy, 4 + i * 4, i * 1.2, i * 1.2 + Math.PI * 1.35);
        g.stroke();
      }
    },
    chain: () => {
      g.strokeStyle = "#ffe97a"; g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(5, 8); g.lineTo(12, 13); g.lineTo(9, 17); g.lineTo(19, 20); g.lineTo(16, 24); g.lineTo(27, 26);
      g.stroke();
      g.fillStyle = "#fff8c0";
      for (const [x, y] of [[5, 8], [12, 13], [19, 20], [27, 26]]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
    },
    sentinel: () => {
      g.fillStyle = "#6d675c"; g.fillRect(13, 14, 6, 14);
      g.fillStyle = "#55504a"; g.fillRect(11, 26, 10, 3);
      const gr = g.createRadialGradient(16, 9, 1, 16, 9, 8);
      gr.addColorStop(0, "#ffe9a8"); gr.addColorStop(0.5, "#ff9a3c"); gr.addColorStop(1, "rgba(200,90,16,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(16, 9, 8, 0, 7); g.fill();
    },
    meteor: () => { g.fillStyle = "#ff7020"; g.beginPath(); g.arc(20, 20, 7, 0, 7); g.fill(); g.strokeStyle = "#ffb060"; g.lineWidth = 3; g.beginPath(); g.moveTo(4, 4); g.lineTo(15, 15); g.stroke(); },
    warmth: () => { const gr = g.createRadialGradient(cx, cy, 1, cx, cy, 10); gr.addColorStop(0, "#ffd080"); gr.addColorStop(1, "#402008"); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 10, 0, 7); g.fill(); },
    portal: () => { g.strokeStyle = "#4a90d0"; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, 7, 11, 0, 0, 7); g.stroke(); },
  };
  (sym[id] ?? sym.basic)();
  g.strokeStyle = "#4a3b22";
  g.strokeRect(0.5, 0.5, 31, 31);
  iconCache.set(id, c);
  return c;
}

// Fresh canvas copy of a skill icon (a canvas element can only live in one
// place in the DOM, and cloneNode() drops the bitmap).
export function copySkillIcon(id: string, size = 32): HTMLCanvasElement {
  const src = getSkillIcon(id);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0, size, size);
  return c;
}
