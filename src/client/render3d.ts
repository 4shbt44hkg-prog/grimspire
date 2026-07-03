// 3D world renderer (Three.js) with a 2D overlay canvas for labels, bars,
// damage numbers and the minimap. The overlay keeps every screen-space hit
// rect (G.labelRects / objRects / monRects) working exactly as before.

import * as THREE from "three";
import { MONSTERS } from "../shared/gamedata";
import { RARITY_COLOR } from "../shared/items";
import { T_FLOOR, T_WALL, type GameMap } from "../shared/types";
import { G, IS_TOUCH, type FX } from "./game";
import { blobShadow, glowSprite, spawnModel } from "./models3d";

const CAM_OFFSET = new THREE.Vector3(9, 11, 9);
const VIEW_H = 13.5; // world units visible vertically

// Outdoor biomes (0-3 rotate by zone) + town (4).
interface Biome {
  floor: string[];
  ambient: number;
  ambInt: number;
  clear: number;
  sun: number;
  sunInt: number;
  kind: "moor" | "wastes" | "tundra" | "wood" | "town";
}
const THEMES: Biome[] = [
  { floor: ["#3d4a34", "#37432e", "#44523a"], ambient: 0x5a6455, ambInt: 0.9, clear: 0x0a0e12, sun: 0x9ab0d8, sunInt: 0.55, kind: "moor" },
  { floor: ["#4c3a30", "#463327", "#54423a"], ambient: 0x6a5040, ambInt: 0.9, clear: 0x120806, sun: 0xd8925a, sunInt: 0.55, kind: "wastes" },
  { floor: ["#576274", "#4f5a6c", "#606c80"], ambient: 0x60708a, ambInt: 0.95, clear: 0x0a0e16, sun: 0xb0c8ea, sunInt: 0.65, kind: "tundra" },
  { floor: ["#2e3a28", "#293423", "#333f2d"], ambient: 0x4a5a44, ambInt: 0.85, clear: 0x070a06, sun: 0x8ab080, sunInt: 0.5, kind: "wood" },
  { floor: ["#3a3524", "#34301f", "#403a29"], ambient: 0x8a7d68, ambInt: 1.25, clear: 0x0c0a06, sun: 0xe0b888, sunInt: 0.7, kind: "town" },
];

// ---------------- setup ----------------
const overlay = document.getElementById("game") as HTMLCanvasElement;
const octx = overlay.getContext("2d")!;
let W = 0, H = 0, DPR = 1;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.domElement.id = "game3d";
renderer.domElement.style.cssText = "position:fixed;inset:0;z-index:0;";
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.insertBefore(renderer.domElement, overlay);
overlay.style.zIndex = "1";
overlay.style.background = "transparent";

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 80);
const ambient = new THREE.AmbientLight(0x6a5f52, 0.6);
const hemi = new THREE.HemisphereLight(0x4a4438, 0x1a140e, 0.75);
const playerLight = new THREE.PointLight(0xffb070, 1.4, 10, 1.5);
// The moon/sun: one shadow-casting directional light that follows the player.
const SUN_DIR = new THREE.Vector3(-0.55, 1, 0.35).normalize();
const sun = new THREE.DirectionalLight(0x9ab0d8, 0.55);
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 70;
sun.shadow.bias = -0.0015;
scene.add(ambient, hemi, playerLight, sun, sun.target);

// mouse-wheel zoom
overlay.addEventListener("wheel", (e) => {
  e.preventDefault();
  zoomBy(e.deltaY < 0 ? 1.1 : 0.9);
}, { passive: false });

// programmatic zoom (pinch gesture on touch devices)
export function zoomBy(f: number) {
  camera.zoom = Math.max(0.6, Math.min(1.9, camera.zoom * f));
  camera.updateProjectionMatrix();
}

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const ndc = new THREE.Vector2();

export function resize() {
  DPR = Math.min(IS_TOUCH ? 1.5 : 2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  overlay.width = W * DPR;
  overlay.height = H * DPR;
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H);
  const aspect = W / H;
  camera.top = VIEW_H / 2;
  camera.bottom = -VIEW_H / 2;
  camera.left = (-VIEW_H * aspect) / 2;
  camera.right = (VIEW_H * aspect) / 2;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---------------- projections ----------------
export function w2s(x: number, y: number, h = 0): [number, number] {
  tmpV.set(x, h, y).project(camera);
  return [((tmpV.x + 1) / 2) * W, ((1 - tmpV.y) / 2) * H];
}

export function s2w(sx: number, sy: number): [number, number] {
  ndc.set((sx / W) * 2 - 1, -((sy / H) * 2) + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.ray.intersectPlane(groundPlane, tmpV2);
  return hit ? [hit.x, hit.z] : [G.x, G.y];
}

let pxuX = 42, pxuY = 30; // px per world unit (ground X / vertical height)
function computePxu() {
  const a = w2s(G.camX, G.camY);
  const b = w2s(G.camX + 1, G.camY);
  const c = w2s(G.camX, G.camY, 1);
  pxuX = Math.max(8, Math.hypot(b[0] - a[0], b[1] - a[1]));
  pxuY = Math.max(8, Math.hypot(c[0] - a[0], c[1] - a[1]));
}

// ---------------- map build ----------------
let depthGroup: THREE.Group | null = null;
let builtDepth = -999;
let torchLights: THREE.PointLight[] = [];
let objModels = new Map<string, THREE.Group>();
let miniCanvas: HTMLCanvasElement | null = null;

const OBJ_H: Record<string, number> = {
  stash: 0.85, well: 0.95, waypoint: 0.45, shrine: 1.35, vendor: 1.15, gambler: 1.15,
  chest: 0.6, stairs_down: 1.4, stairs_up: 1.4,
};

function buildDepth(map: GameMap, depth: number) {
  builtDepth = depth;
  if (depthGroup) {
    scene.remove(depthGroup);
    depthGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        if (m instanceof THREE.InstancedMesh) m.dispose();
      }
    });
  }
  clearDynamic();
  depthGroup = new THREE.Group();
  torchLights = [];
  objModels = new Map();
  const theme = THEMES[map.theme];
  ambient.color.set(theme.ambient);
  ambient.intensity = theme.ambInt;
  renderer.setClearColor(theme.clear);
  sun.color.set(theme.sun);
  sun.intensity = theme.sunInt;

  // ---- terrain: ground under every non-void tile ----
  let nGround = 0;
  for (let i = 0; i < map.w * map.h; i++) if (map.tiles[i] !== 0) nGround++;
  const floorGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const floorMesh = new THREE.InstancedMesh(floorGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), nGround);
  floorMesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let fi = 0;
  const obstacleTiles: { x: number; y: number; v: number }[] = [];
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const t = map.tiles[y * map.w + x];
      if (t === 0) continue;
      const v = map.variant[y * map.w + x];
      dummy.position.set(x + 0.5, 0, y + 0.5);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      floorMesh.setMatrixAt(fi, dummy.matrix);
      col.set(theme.floor[v % 3]).multiplyScalar((t === T_WALL ? 0.78 : 0.92) + (v % 7) * 0.03);
      floorMesh.setColorAt(fi, col);
      fi++;
      if (t === T_WALL) obstacleTiles.push({ x, y, v });
    }
  floorMesh.instanceMatrix.needsUpdate = true;
  if (floorMesh.instanceColor) floorMesh.instanceColor.needsUpdate = true;
  depthGroup.add(floorMesh);

  buildObstacles(obstacleTiles, theme);

  // objects
  for (const o of map.objects) {
    const model = spawn(o.type);
    model.position.set(o.x, 0, o.y);
    depthGroup.add(model);
    objModels.set(o.id, model);
    model.traverse((c) => {
      if ((c as THREE.PointLight).isLight && c.name === "torchlight") torchLights.push(c as THREE.PointLight);
    });
  }
  // keep light counts sane on torch-heavy maps
  for (let i = 10; i < torchLights.length; i++) torchLights[i].intensity = 0;

  scene.add(depthGroup);

  // minimap prerender (2D)
  miniCanvas = document.createElement("canvas");
  miniCanvas.width = 180;
  miniCanvas.height = 180;
  const mg = miniCanvas.getContext("2d")!;
  mg.fillStyle = "rgba(0,0,0,0.65)";
  mg.fillRect(0, 0, 180, 180);
  const sc = 176 / Math.max(map.w, map.h);
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      if (map.tiles[y * map.w + x] === T_FLOOR) {
        mg.fillStyle = "#4a4438";
        mg.fillRect(2 + x * sc, 2 + y * sc, Math.ceil(sc), Math.ceil(sc));
      }
    }
  for (const o of map.objects) {
    if (o.type === "stairs_down") { mg.fillStyle = "#e05555"; mg.fillRect(o.x * sc - 1, o.y * sc - 1, 4, 4); }
    if (o.type === "stairs_up") { mg.fillStyle = "#7ad87a"; mg.fillRect(o.x * sc - 1, o.y * sc - 1, 4, 4); }
    if (o.type === "waypoint") { mg.fillStyle = "#5ac8d8"; mg.fillRect(o.x * sc - 1, o.y * sc - 1, 4, 4); }
  }
}

// ---------------- outdoor obstacles (trees / rocks) with occluder fade ----------------
interface TreeInfo { x: number; z: number; s: number; rot: number }
let treeTrunks: THREE.InstancedMesh | null = null;
let treeCanopy: THREE.InstancedMesh | null = null;
let treeInfo: TreeInfo[] = [];
let treeScale = new Float32Array(0);
let treeTrunkH = 1, treeCanopyY = 1;
let rocksMesh: THREE.InstancedMesh | null = null;
const fadeDummy = new THREE.Object3D();

function writeTree(i: number, k: number) {
  const info = treeInfo[i];
  fadeDummy.position.set(info.x, (treeTrunkH * info.s * k) / 2, info.z);
  fadeDummy.rotation.set(0, info.rot, 0);
  fadeDummy.scale.set(info.s, info.s * Math.max(0.05, k), info.s);
  fadeDummy.updateMatrix();
  treeTrunks!.setMatrixAt(i, fadeDummy.matrix);
  if (treeCanopy) {
    const ck = Math.max(0.1, k);
    fadeDummy.position.set(info.x, treeCanopyY * info.s * k + 0.15, info.z);
    fadeDummy.scale.set(info.s * ck, info.s * ck, info.s * ck);
    fadeDummy.updateMatrix();
    treeCanopy.setMatrixAt(i, fadeDummy.matrix);
  }
}

function buildObstacles(tiles: { x: number; y: number; v: number }[], theme: Biome) {
  treeTrunks = treeCanopy = rocksMesh = null;
  treeInfo = [];
  const kind = theme.kind;
  const rockRatio = kind === "wastes" ? 0.7 : kind === "moor" ? 0.4 : kind === "tundra" ? 0.35 : 0.12;
  const trees: typeof tiles = [], rocks: typeof tiles = [];
  for (const t of tiles) ((t.v % 100) / 100 < rockRatio ? rocks : trees).push(t);
  const col = new THREE.Color();

  if (rocks.length) {
    const rockGeo = new THREE.DodecahedronGeometry(0.36);
    const rockColor = kind === "wastes" ? "#6a5044" : kind === "tundra" ? "#a8b8cc" : "#6d675c";
    rocksMesh = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), rocks.length);
    rocksMesh.castShadow = true;
    rocksMesh.receiveShadow = true;
    rocks.forEach((t, i) => {
      fadeDummy.position.set(t.x + 0.5 + ((t.v % 5) - 2) * 0.06, 0.18, t.y + 0.5 + ((t.v % 7) - 3) * 0.05);
      fadeDummy.rotation.set(0, (t.v % 31) * 0.2, 0);
      const s = 0.8 + (t.v % 9) * 0.09;
      fadeDummy.scale.set(s, s * (0.55 + (t.v % 4) * 0.1), s);
      fadeDummy.updateMatrix();
      rocksMesh!.setMatrixAt(i, fadeDummy.matrix);
      col.set(rockColor).multiplyScalar(0.85 + (t.v % 6) * 0.05);
      rocksMesh!.setColorAt(i, col);
    });
    depthGroup!.add(rocksMesh);
  }

  if (trees.length) {
    const tall = kind === "wood" || kind === "town";
    treeTrunkH = kind === "moor" ? 1.3 : kind === "wastes" ? 1.05 : tall ? 1.5 : 0.9;
    const trunkGeo = new THREE.CylinderGeometry(0.07, 0.13, treeTrunkH, 6);
    const trunkColor = kind === "tundra" ? "#4a3c30" : kind === "moor" ? "#3d3830" : kind === "wastes" ? "#443228" : "#4a3a24";
    treeTrunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), trees.length);
    treeTrunks.castShadow = true;
    let canopyGeo: THREE.BufferGeometry | null = null;
    let canopyColor = "#2e4a26";
    if (kind === "tundra") {
      canopyGeo = new THREE.ConeGeometry(0.5, 1.4, 7);
      canopyColor = "#2c4a3c";
      treeCanopyY = treeTrunkH * 0.5 + 0.55;
    } else if (tall) {
      canopyGeo = new THREE.SphereGeometry(0.55, 8, 6);
      canopyColor = kind === "town" ? "#3d5a2c" : "#26381e";
      treeCanopyY = treeTrunkH * 0.5 + 0.8;
    }
    if (canopyGeo) {
      treeCanopy = new THREE.InstancedMesh(canopyGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), trees.length);
      treeCanopy.castShadow = true;
    }
    treeScale = new Float32Array(trees.length).fill(1);
    trees.forEach((t, i) => {
      treeInfo.push({
        x: t.x + 0.5 + ((t.v % 5) - 2) * 0.07,
        z: t.y + 0.5 + ((t.v % 7) - 3) * 0.06,
        s: 0.85 + (t.v % 8) * 0.08,
        rot: (t.v % 13) * 0.5,
      });
      writeTree(i, 1);
      col.set(trunkColor).multiplyScalar(0.85 + (t.v % 5) * 0.06);
      treeTrunks!.setColorAt(i, col);
      if (treeCanopy) {
        col.set(canopyColor).multiplyScalar(0.8 + (t.v % 6) * 0.07);
        treeCanopy.setColorAt(i, col);
      }
    });
    treeTrunks.instanceMatrix.needsUpdate = true;
    depthGroup!.add(treeTrunks);
    if (treeCanopy) {
      treeCanopy.instanceMatrix.needsUpdate = true;
      depthGroup!.add(treeCanopy);
    }
  }
}

// Trees between the camera and the player shrink out of the way.
function fadeOccluders(dt: number) {
  if (!treeTrunks || !treeInfo.length) return;
  let changed = false;
  for (let i = 0; i < treeInfo.length; i++) {
    const info = treeInfo[i];
    const dx = info.x - G.x, dz = info.z - G.y;
    const occ = dx > -0.8 && dz > -0.8 && dx + dz < 5.5 && Math.abs(dx - dz) < 2.6;
    const target = occ ? 0.1 : 1;
    const cur = treeScale[i];
    if (Math.abs(cur - target) > 0.012) {
      treeScale[i] = cur + (target - cur) * Math.min(1, dt * 9);
      writeTree(i, treeScale[i]);
      changed = true;
    }
  }
  if (changed) {
    treeTrunks.instanceMatrix.needsUpdate = true;
    if (treeCanopy) treeCanopy.instanceMatrix.needsUpdate = true;
  }
}

// spawnModel + real shadows (and no blob shadow, the sun handles grounding)
function spawn(kind: string): THREE.Group {
  const g = spawnModel(kind);
  g.traverse((o) => {
    if (o.name === "blob") o.visible = false;
    else if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

// ---------------- dynamic entities ----------------
const monModels = new Map<string, THREE.Group>();
const playerModels = new Map<string, THREE.Group>();
const projModels = new Map<string, THREE.Group>();
const itemModels = new Map<string, THREE.Group>();
const sentModels = new Map<string, THREE.Group>();
const fxModels = new Map<FX, THREE.Object3D>();
let selfModel: THREE.Group | null = null;

function clearDynamic() {
  for (const m of monModels.values()) scene.remove(m);
  for (const m of playerModels.values()) scene.remove(m);
  for (const m of projModels.values()) scene.remove(m);
  for (const m of itemModels.values()) scene.remove(m);
  for (const m of sentModels.values()) scene.remove(m);
  for (const m of fxModels.values()) scene.remove(m);
  monModels.clear();
  playerModels.clear();
  projModels.clear();
  itemModels.clear();
  sentModels.clear();
  fxModels.clear();
  if (selfModel) {
    scene.remove(selfModel);
    selfModel = null;
  }
}

function lerp(from: number, to: number, snapAt: number): number {
  const k = Math.max(0, Math.min(1, (G.now - snapAt) / 0.134));
  return from + (to - from) * k;
}

const PROJ_COLORS: Record<string, [string, string]> = {
  fire: ["rgba(255,221,136,1)", "rgba(255,106,0,0.5)"],
  cold: ["rgba(208,240,255,1)", "rgba(58,144,216,0.5)"],
  light: ["rgba(255,255,192,1)", "rgba(232,192,32,0.5)"],
  pois: ["rgba(192,255,192,1)", "rgba(58,158,58,0.5)"],
  phys: ["rgba(232,232,248,1)", "rgba(136,136,176,0.5)"],
};

function faceRot(dir: number): number {
  return dir > 0 ? (Math.PI * 3) / 4 : -Math.PI / 4;
}

function animateBody(g: THREE.Group, walking: boolean, dead: boolean, castT: number, phase: number) {
  const body = g.getObjectByName("body");
  if (!body) return;
  const t = G.now;
  body.position.y = walking ? Math.abs(Math.sin(t * 9 + phase)) * 0.06 : 0;
  body.rotation.z = walking ? Math.sin(t * 9 + phase) * 0.06 : 0;
  body.rotation.x = castT > 0 ? 0.3 : (body.userData.baseTilt ?? 0);
  if (dead) {
    g.rotation.z = Math.PI / 2;
    g.position.y = 0.1;
  } else {
    g.rotation.z = 0;
  }
}

function syncEntities() {
  const t = G.now;

  // monsters
  for (const [id, m] of G.monsters) {
    let g = monModels.get(id);
    if (!g) {
      const def = MONSTERS[m.cur.def];
      g = spawn(def.spr);
      if (m.cur.rare || m.cur.boss || m.cur.champ) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(def.size + 0.15, def.size + 0.24, 20),
          new THREE.MeshBasicMaterial({
            color: m.cur.boss ? 0xc83cc8 : m.cur.rare ? 0x6488ff : 0xc8aa50,
            transparent: true, opacity: 0.55, depthWrite: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.04;
        g.add(ring);
      }
      if (m.cur.rare) g.getObjectByName("body")?.scale.multiplyScalar(1.18);
      scene.add(g);
      monModels.set(id, g);
    }
    const ix = lerp(m.px, m.tx, m.snapAt);
    const iy = lerp(m.py, m.ty, m.snapAt);
    g.position.set(ix, 0, iy);
    g.rotation.y = faceRot(m.cur.dir);
    animateBody(g, m.cur.anim === "walk", false, 0, ix * 7);
    // bats fly and flap
    const wl = g.getObjectByName("wingL");
    const wr = g.getObjectByName("wingR");
    if (wl && wr) {
      const flap = Math.sin(t * 14 + ix * 5) * 0.7;
      wl.rotation.z = flap;
      wr.rotation.z = -flap;
    }
    // boss orbs orbit
    const orb1 = g.getObjectByName("orb1");
    const orb2 = g.getObjectByName("orb2");
    if (orb1 && orb2) {
      orb1.position.set(Math.cos(t * 1.6) * 0.65, 0.9 + Math.sin(t * 2.2) * 0.1, Math.sin(t * 1.6) * 0.65);
      orb2.position.set(-Math.cos(t * 1.6) * 0.65, 0.9 - Math.sin(t * 2.2) * 0.1, -Math.sin(t * 1.6) * 0.65);
    }
  }
  for (const [id, g] of monModels) {
    if (!G.monsters.has(id)) {
      scene.remove(g);
      monModels.delete(id);
    }
  }

  // other players
  for (const [id, p] of G.players) {
    if (p.cur.depth !== G.depth) {
      const ex = playerModels.get(id);
      if (ex) { scene.remove(ex); playerModels.delete(id); }
      continue;
    }
    let g = playerModels.get(id);
    if (!g) {
      g = spawn(p.cur.cls);
      scene.add(g);
      playerModels.set(id, g);
    }
    const ix = lerp(p.px, p.tx, p.snapAt);
    const iy = lerp(p.py, p.ty, p.snapAt);
    g.position.set(ix, 0, iy);
    if (p.cur.anim === "spin") g.rotation.y = t * 16;
    else g.rotation.y = faceRot(p.cur.dir);
    animateBody(g, p.cur.anim === "walk", !!p.cur.dead, 0, 3);
  }
  for (const [id, g] of playerModels) {
    if (!G.players.has(id)) {
      scene.remove(g);
      playerModels.delete(id);
    }
  }

  // self
  if (!selfModel) {
    selfModel = spawn(G.char!.cls);
    scene.add(selfModel);
  }
  selfModel.position.set(G.x, 0, G.y);
  if (G.anim === "spin") selfModel.rotation.y = t * 16;
  else selfModel.rotation.y = faceRot(G.dir);
  animateBody(selfModel, G.anim === "walk", G.dead, G.castAnimT, 0);

  // projectiles
  for (const [id, pr] of G.projs) {
    let g = projModels.get(id);
    if (!g) {
      g = new THREE.Group();
      const [inner, outer] = PROJ_COLORS[pr.cur.element] ?? PROJ_COLORS.phys;
      g.add(glowSprite(inner, outer, 0.55));
      scene.add(g);
      projModels.set(id, g);
    }
    g.position.set(lerp(pr.px, pr.tx, pr.snapAt), 0.55, lerp(pr.py, pr.ty, pr.snapAt));
  }
  for (const [id, g] of projModels) {
    if (!G.projs.has(id)) {
      scene.remove(g);
      projModels.delete(id);
    }
  }

  // ground items
  for (const [gid, gi] of G.groundItems) {
    let g = itemModels.get(gid);
    if (!g) {
      g = new THREE.Group();
      const color = gi.item.base === "gold" ? "#e8c860" : RARITY_COLOR[gi.item.rarity];
      const octa = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.14),
        new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 }),
      );
      octa.name = "spin";
      octa.position.y = 0.28;
      g.add(octa);
      if (gi.item.rarity === "unique" || gi.item.rarity === "set") {
        const glow = glowSprite(color === "#00c400" ? "rgba(80,255,80,0.8)" : "rgba(255,210,100,0.8)", "rgba(200,150,40,0.3)", 0.9);
        glow.position.y = 0.3;
        g.add(glow);
      }
      g.add(blobShadow(0.3));
      g.position.set(gi.x, 0, gi.y);
      scene.add(g);
      itemModels.set(gid, g);
    }
    const spin = g.getObjectByName("spin");
    if (spin) spin.rotation.y = t * 2.2;
  }
  for (const [gid, g] of itemModels) {
    if (!G.groundItems.has(gid)) {
      scene.remove(g);
      itemModels.delete(gid);
    }
  }

  // flame sentinels
  for (const [id, s] of G.sentinels) {
    let g = sentModels.get(id);
    if (!g) {
      g = spawn("sentinel");
      g.position.set(s.x, 0, s.y);
      scene.add(g);
      sentModels.set(id, g);
    }
    const flame = g.getObjectByName("flame") as THREE.Sprite | null;
    if (flame) flame.scale.setScalar(0.5 + Math.sin(t * 8 + s.x) * 0.08);
  }
  for (const [id, g] of sentModels) {
    if (!G.sentinels.has(id)) {
      scene.remove(g);
      sentModels.delete(id);
    }
  }

  // animated objects: shrine crystals, portal cores
  if (G.map) {
    for (const o of G.map.objects) {
      const model = objModels.get(o.id);
      if (!model) continue;
      if (o.type === "shrine") {
        const used = G.usedObjects.has(o.id);
        const crystal = model.getObjectByName("crystal");
        const glow = model.getObjectByName("shrineglow");
        if (crystal) {
          crystal.visible = !used;
          crystal.rotation.y = t * 1.4;
          crystal.position.y = 0.95 + Math.sin(t * 2.4) * 0.06;
        }
        if (glow) glow.visible = !used;
      } else if (o.type === "stairs_down" || o.type === "stairs_up") {
        const core = model.getObjectByName("core");
        if (core) core.rotation.z = t * 1.8;
        const ring = model.getObjectByName("ring");
        if (ring) ring.rotation.z = -t * 0.5;
      }
    }
  }

  // torch flicker
  const rt = performance.now() / 1000;
  for (let i = 0; i < Math.min(10, torchLights.length); i++) {
    torchLights[i].intensity = 1.15 + Math.sin(rt * 9 + i * 2.1) * 0.22;
  }

  playerLight.position.set(G.x, 1.4, G.y);
}

// ---------------- FX ----------------
const NOVA_COLORS: Record<string, number> = { cold: 0x78d2ff, fire: 0xff9a3c, phys: 0xd8d8d8, light: 0xffe97a, pois: 0x7ad87a };

function ringMesh(color: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1, 26),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.07;
  return m;
}

function syncFx() {
  const live = new Set(G.fx);
  for (const f of G.fx) {
    let obj = fxModels.get(f);
    if (!obj) {
      const created = createFx(f);
      if (!created) continue;
      obj = created;
      obj.position.set(f.x, 0, f.y);
      scene.add(obj);
      fxModels.set(f, obj);
    }
    updateFx(f, obj, (G.now - f.t) / f.dur);
  }
  for (const [f, obj] of fxModels) {
    if (!live.has(f)) {
      scene.remove(obj);
      fxModels.delete(f);
    }
  }
}

function createFx(f: FX): THREE.Object3D | null {
  switch (f.type) {
    case "nova": return ringMesh(NOVA_COLORS[f.ele ?? "fire"] ?? 0xff9a3c);
    case "warcry": return ringMesh(0xe8a03c);
    case "levelup": {
      const g = new THREE.Group();
      g.add(ringMesh(0xe8c860));
      const pillar = glowSprite("rgba(255,230,150,0.9)", "rgba(200,150,40,0.3)", 1.6);
      pillar.name = "pillar";
      pillar.position.y = 0.8;
      g.add(pillar);
      return g;
    }
    case "boom": {
      const s = glowSprite("rgba(255,230,160,1)", "rgba(255,120,30,0.55)", 1);
      s.position.y = 0.4;
      return s;
    }
    case "meteorwarn": {
      const g = new THREE.Group();
      const ring = ringMesh(0xff5028);
      ring.name = "ring";
      g.add(ring);
      const rock = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0x903010, emissive: 0xff6a10, emissiveIntensity: 0.9 }),
      );
      rock.name = "rock";
      g.add(rock);
      const trail = glowSprite("rgba(255,180,90,0.9)", "rgba(255,110,20,0.4)", 0.9);
      trail.name = "trail";
      g.add(trail);
      return g;
    }
    case "teleport": {
      const s = glowSprite("rgba(190,140,255,0.95)", "rgba(120,60,220,0.4)", 1.2);
      s.position.y = 0.6;
      return s;
    }
    case "death": {
      const g = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 0.07, 0.07),
          new THREE.MeshBasicMaterial({ color: 0xa02828, transparent: true }),
        );
        p.name = `p${i}`;
        g.add(p);
      }
      return g;
    }
    case "dropflash": {
      const s = glowSprite("rgba(255,240,180,0.9)", "rgba(255,200,90,0.35)", 0.6);
      s.position.y = 0.3;
      return s;
    }
    default: return null; // swing is drawn on the overlay
  }
}

function updateFx(f: FX, obj: THREE.Object3D, age: number) {
  age = Math.max(0, Math.min(1, age));
  if (f.type === "nova" || f.type === "warcry") {
    const r = (f.r ?? 3) * (f.type === "warcry" ? age * 0.8 : age);
    obj.scale.set(Math.max(0.05, r), 1, Math.max(0.05, r));
    ((obj as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - age);
  } else if (f.type === "levelup") {
    const ring = obj.children[0] as THREE.Mesh;
    ring.scale.set(2.4 * age + 0.1, 1, 2.4 * age + 0.1);
    (ring.material as THREE.MeshBasicMaterial).opacity = 1 - age;
    const pillar = obj.getObjectByName("pillar") as THREE.Sprite;
    if (pillar) pillar.material.opacity = 1 - age;
  } else if (f.type === "boom") {
    const s = obj as THREE.Sprite;
    const size = (f.r ?? 1.5) * 2 * (0.4 + age * 0.8);
    s.scale.set(size, size, 1);
    s.material.opacity = 1 - age;
  } else if (f.type === "meteorwarn") {
    const ring = obj.getObjectByName("ring") as THREE.Mesh;
    if (ring) {
      const rr = (f.r ?? 2.6) * (1 - age * 0.25);
      ring.scale.set(rr, 1, rr);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(G.now * 12) * 0.25;
    }
    const rock = obj.getObjectByName("rock");
    const trail = obj.getObjectByName("trail");
    const fall = (1 - age);
    if (rock) rock.position.set(fall * 2.4, fall * 7 + 0.2, -fall * 1.2);
    if (trail) trail.position.set(fall * 2.4, fall * 7 + 0.55, -fall * 1.2);
  } else if (f.type === "teleport") {
    const s = obj as THREE.Sprite;
    s.material.opacity = 1 - age;
    s.scale.set(1.2, 1.2 + age * 1.6, 1);
  } else if (f.type === "death") {
    for (let i = 0; i < 6; i++) {
      const p = obj.getObjectByName(`p${i}`);
      if (!p) continue;
      const a = (i / 6) * Math.PI * 2;
      p.position.set(Math.cos(a) * age * 0.7, 0.4 + age * 0.5 - age * age * 1.1, Math.sin(a) * age * 0.7);
      ((p as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - age;
    }
  } else if (f.type === "dropflash") {
    const s = obj as THREE.Sprite;
    s.scale.setScalar(0.4 + age * 0.7);
    s.material.opacity = 0.8 * (1 - age);
  }
}

// ---------------- overlay ----------------
const OBJ_LABELS: Record<string, [string, string]> = {
  stash: ["Stash", "Store your treasures"],
  well: ["Healing Well", "Restores life and mana"],
  waypoint: ["Waypoint", "Travel to town or any zone you've visited"],
  vendor: ["Marla the Merchant", "Buy and sell goods"],
  gambler: ["Zeke the Gambler", "Gamble gold for unknown items"],
  stairs_down: ["Rift Portal", "Step through to the next zone"],
  stairs_up: ["Return Portal", "Back the way you came"],
  chest: ["Treasure Chest", "Crack it open"],
  shrine: ["Mysterious Shrine", "Touch it for a blessing"],
};

function drawOverlay() {
  const map = G.map!;
  octx.setTransform(DPR, 0, 0, DPR, 0, 0);
  octx.clearRect(0, 0, W, H);

  G.labelRects = [];
  G.objRects = [];
  G.monRects = [];

  // ---- object rects + labels ----
  interface OL { x: number; y: number; name: string; hint?: string }
  const labels: OL[] = [];
  for (const o of map.objects) {
    if (o.type === "torch") continue;
    const [sx, sy] = w2s(o.x, o.y);
    if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) continue;
    const hWorld = OBJ_H[o.type] ?? 0.8;
    const rw = 1.35 * pxuX;
    const rh = (hWorld + 0.35) * pxuY;
    G.objRects.push({ id: o.id, x: sx - rw / 2, y: sy - rh, w: rw, h: rh, type: o.type });
    const lbl = OBJ_LABELS[o.type];
    if (lbl) {
      const hover = G.hoverObj === o.id;
      if (hover || G.depth === 0) {
        labels.push({
          x: sx, y: sy - rh - 6,
          name: lbl[0],
          hint: hover ? (G.usedObjects.has(o.id) ? "(already used)" : lbl[1]) : undefined,
        });
      }
    }
  }
  for (const l of labels) {
    octx.textAlign = "center";
    octx.font = "13px Georgia";
    const nameW = octx.measureText(l.name).width;
    octx.font = "11px Georgia";
    const hintW = l.hint ? octx.measureText(l.hint).width : 0;
    const bw = Math.max(nameW, hintW) + 14;
    const bh = l.hint ? 33 : 19;
    const by = l.y - bh;
    octx.fillStyle = "rgba(5,4,3,0.82)";
    octx.fillRect(l.x - bw / 2, by, bw, bh);
    octx.strokeStyle = "rgba(74,59,34,0.9)";
    octx.lineWidth = 1;
    octx.strokeRect(l.x - bw / 2 + 0.5, by + 0.5, bw - 1, bh - 1);
    octx.font = "13px Georgia";
    octx.fillStyle = "#c8a856";
    octx.fillText(l.name, l.x, by + 14);
    if (l.hint) {
      octx.font = "11px Georgia";
      octx.fillStyle = "#8a7d63";
      octx.fillText(l.hint, l.x, by + 27);
    }
  }

  // ---- ground item labels ----
  for (const g of G.groundItems.values()) {
    const [sx, sy] = w2s(g.x, g.y);
    if (sx < -80 || sx > W + 80 || sy < -60 || sy > H + 60) continue;
    const color = g.item.base === "gold" ? "#e8c860" : RARITY_COLOR[g.item.rarity];
    const label = g.item.base === "gold" ? `${g.item.qty} gold` : g.item.name + ((g.item.qty ?? 1) > 1 ? ` (${g.item.qty})` : "");
    octx.font = "12px Georgia";
    const tw = octx.measureText(label).width;
    const lx = sx - tw / 2 - 4;
    const ly = sy - 0.55 * pxuY - 24;
    octx.fillStyle = "rgba(0,0,0,0.72)";
    octx.fillRect(lx, ly, tw + 8, 16);
    octx.fillStyle = color;
    octx.textAlign = "left";
    octx.fillText(label, lx + 4, ly + 12);
    G.labelRects.push({ gid: g.gid, x: lx, y: ly, w: tw + 8, h: 16 });
  }

  // ---- monsters: rects, hp bars, hover names ----
  for (const m of G.monsters.values()) {
    const def = MONSTERS[m.cur.def];
    const ix = lerp(m.px, m.tx, m.snapAt);
    const iy = lerp(m.py, m.ty, m.snapAt);
    const [sx, sy] = w2s(ix, iy);
    if (sx < -60 || sx > W + 60 || sy < -80 || sy > H + 80) continue;
    const hW = def.size * 2.6 * pxuX;
    const hH = Math.max(0.7, def.size * 2.3) * pxuY;
    G.monRects.push({ id: m.cur.id, x: sx - hW / 2, y: sy - hH, w: hW, h: hH });
    if (m.cur.hp < m.cur.maxHp) {
      octx.fillStyle = "#200404";
      octx.fillRect(sx - 16, sy - hH - 6, 32, 4);
      octx.fillStyle = "#c03434";
      octx.fillRect(sx - 16, sy - hH - 6, 32 * (m.cur.hp / m.cur.maxHp), 4);
    }
    if (G.hoverMonster === m.cur.id) {
      octx.font = "bold 12px Georgia";
      octx.textAlign = "center";
      octx.fillStyle = m.cur.rare ? "#8ab0ff" : m.cur.boss ? "#d880d8" : "#d8cdb4";
      const nm = (m.cur.rare || m.cur.champ ? m.cur.affixes.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(" ") + " " : "") + def.name;
      octx.fillText(nm, sx, sy - hH - 12);
    }
  }

  // ---- player names ----
  for (const p of G.players.values()) {
    if (p.cur.depth !== G.depth) continue;
    const [sx, sy] = w2s(lerp(p.px, p.tx, p.snapAt), lerp(p.py, p.ty, p.snapAt));
    octx.font = "11px Georgia";
    octx.textAlign = "center";
    octx.fillStyle = "#9ad0ff";
    octx.fillText(p.cur.name, sx, sy - 0.95 * pxuY - 6);
  }
  {
    const [sx, sy] = w2s(G.x, G.y);
    octx.font = "11px Georgia";
    octx.textAlign = "center";
    octx.fillStyle = "#c8a856";
    octx.fillText(G.char!.name, sx, sy - 0.95 * pxuY - 6);
  }

  // ---- damage numbers ----
  for (const n of G.dmgNums) {
    const age = G.now - n.t;
    const [sx, sy] = w2s(n.x, n.y);
    octx.font = "bold 15px Georgia";
    octx.textAlign = "center";
    octx.globalAlpha = 1 - age;
    octx.fillStyle = "#000";
    octx.fillText(n.amt, sx + 1, sy - 0.9 * pxuY - age * 34 + 1);
    octx.fillStyle = n.color;
    octx.fillText(n.amt, sx, sy - 0.9 * pxuY - age * 34);
    octx.globalAlpha = 1;
  }

  // ---- swing fx (2D arc reads better than 3D here) ----
  for (const f of G.fx) {
    if (f.type !== "swing") continue;
    const age = (G.now - f.t) / f.dur;
    const [sx, sy] = w2s(f.x, f.y);
    octx.strokeStyle = `rgba(240,240,220,${0.8 * (1 - age)})`;
    octx.lineWidth = 3;
    octx.beginPath();
    const a = f.ang ?? 0;
    octx.ellipse(sx, sy - 0.45 * pxuY, 0.55 * pxuX, 0.34 * pxuY, 0, a - 0.9 + age * 1.2, a + 0.1 + age * 1.2);
    octx.stroke();
  }

  // ---- move target marker ----
  if (G.moveTarget) {
    const [sx, sy] = w2s(G.moveTarget.x, G.moveTarget.y);
    octx.strokeStyle = "rgba(200,168,86,0.6)";
    octx.lineWidth = 1.5;
    const pulse = 6 + Math.sin(G.now * 8) * 2;
    octx.beginPath();
    octx.ellipse(sx, sy, pulse * 1.6, pulse * 0.9, 0, 0, Math.PI * 2);
    octx.stroke();
  }

  // ---- vignette: gentle everywhere outdoors, softest in town ----
  const [px, py] = w2s(G.x, G.y);
  const town = G.depth === 0;
  const lightR = town ? Math.max(W, H) * 1.4 : 700;
  const grad = octx.createRadialGradient(px, py - 20, lightR * 0.34, px, py - 20, lightR);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.75, town ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.24)");
  grad.addColorStop(1, town ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.62)");
  octx.fillStyle = grad;
  octx.fillRect(0, 0, W, H);

  if (G.derived && G.life / G.derived.maxLife < 0.3 && !G.dead) {
    const a = 0.25 + Math.sin(G.now * 6) * 0.1;
    const vg = octx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.7);
    vg.addColorStop(0, "rgba(120,0,0,0)");
    vg.addColorStop(1, `rgba(120,0,0,${a})`);
    octx.fillStyle = vg;
    octx.fillRect(0, 0, W, H);
  }

  renderMinimap();
}

function renderMinimap() {
  const mini = document.getElementById("minimap") as HTMLCanvasElement;
  const mg = mini.getContext("2d")!;
  mg.clearRect(0, 0, 180, 180);
  if (miniCanvas) mg.drawImage(miniCanvas, 0, 0);
  if (!G.map) return;
  const sc = 176 / Math.max(G.map.w, G.map.h);
  mg.fillStyle = "#ffe97a";
  mg.fillRect(2 + G.x * sc - 2, 2 + G.y * sc - 2, 4, 4);
  for (const p of G.players.values()) {
    if (p.cur.depth !== G.depth) continue;
    mg.fillStyle = "#7ad87a";
    mg.fillRect(2 + p.tx * sc - 1.5, 2 + p.ty * sc - 1.5, 3, 3);
  }
  for (const m of G.monsters.values()) {
    mg.fillStyle = m.cur.boss ? "#d880d8" : "#c03434";
    mg.fillRect(2 + m.tx * sc - 1, 2 + m.ty * sc - 1, 2.5, 2.5);
  }
}

// ---------------- frame ----------------
let lastNow = 0;
export function render() {
  if (!G.map || !G.char) {
    renderer.render(scene, camera);
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);
    octx.clearRect(0, 0, W, H);
    return;
  }
  if (builtDepth !== G.depth) buildDepth(G.map, G.depth);

  const dt = Math.min(0.1, Math.max(0.001, G.now - lastNow));
  lastNow = G.now;

  syncEntities();
  syncFx();
  fadeOccluders(dt);

  // sun follows the player so the shadow window stays centered
  sun.position.set(G.x, 0, G.y).addScaledVector(SUN_DIR, 28);
  sun.target.position.set(G.x, 0, G.y);

  // camera follow + shake
  const shx = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 0.5 : 0;
  const shz = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 0.5 : 0;
  tmpV.set(G.camX + shx, 0, G.camY + shz);
  camera.position.copy(tmpV).add(CAM_OFFSET);
  camera.lookAt(tmpV);
  camera.updateMatrixWorld();

  renderer.render(scene, camera);
  computePxu();
  drawOverlay();
}
