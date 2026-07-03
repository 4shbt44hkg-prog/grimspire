// Low-poly 3D models for every entity and object, built from primitives.
// Templates are constructed once and cloned per instance (shared geometry
// and materials). World scale: 1 unit = 1 tile; characters ~0.9 tall.

import * as THREE from "three";

const matCache = new Map<string, THREE.MeshLambertMaterial>();
export function mat(color: number | string, emissive = 0): THREE.MeshLambertMaterial {
  const key = `${color}|${emissive}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: emissive ? 1 : 0 });
    matCache.set(key, m);
  }
  return m;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function geo<T extends THREE.BufferGeometry>(key: string, build: () => T): T {
  let g = geoCache.get(key);
  if (!g) {
    g = build();
    geoCache.set(key, g);
  }
  return g as T;
}

function box(p: THREE.Object3D, w: number, h: number, d: number, color: number | string, x: number, y: number, z: number, ry = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), mat(color));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  p.add(m);
  return m;
}

function sph(p: THREE.Object3D, r: number, color: number | string, x: number, y: number, z: number, sy = 1): THREE.Mesh {
  const m = new THREE.Mesh(geo(`s${r}`, () => new THREE.SphereGeometry(r, 12, 10)), mat(color));
  m.position.set(x, y, z);
  m.scale.y = sy;
  p.add(m);
  return m;
}

function cyl(p: THREE.Object3D, rt: number, rb: number, h: number, color: number | string, x: number, y: number, z: number, seg = 10): THREE.Mesh {
  const m = new THREE.Mesh(geo(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat(color));
  m.position.set(x, y, z);
  p.add(m);
  return m;
}

function cone(p: THREE.Object3D, r: number, h: number, color: number | string, x: number, y: number, z: number, rz = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo(`k${r}|${h}`, () => new THREE.ConeGeometry(r, h, 8)), mat(color));
  m.position.set(x, y, z);
  m.rotation.z = rz;
  p.add(m);
  return m;
}

// ---------- glow sprites (canvas radial textures) ----------
const texCache = new Map<string, THREE.Texture>();
export function glowTexture(inner: string, outer: string): THREE.Texture {
  const key = `${inner}|${outer}`;
  let t = texCache.get(key);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, inner);
    gr.addColorStop(0.45, outer);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c);
    texCache.set(key, t);
  }
  return t;
}

export function glowSprite(inner: string, outer: string, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(inner, outer),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  }));
  s.scale.set(size, size, 1);
  return s;
}

// Blob shadow shared by all entities.
const shadowMat = new THREE.MeshBasicMaterial({
  map: glowTexture("rgba(0,0,0,0.5)", "rgba(0,0,0,0.28)"),
  transparent: true,
  depthWrite: false,
  color: 0x000000,
});
export function blobShadow(size: number): THREE.Mesh {
  const m = new THREE.Mesh(geo("shadowplane", () => new THREE.PlaneGeometry(1, 1)), shadowMat);
  m.name = "blob";
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.scale.set(size, size, 1);
  return m;
}

// ---------- humanoid base ----------
interface HumanoidOpts {
  skin: number;
  cloth: number;
  clothDark: number;
  scale?: number;
  hunched?: boolean;
}

function humanoid(o: HumanoidOpts): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  // legs
  box(body, 0.09, 0.28, 0.09, o.clothDark, -0.08, 0.14, 0);
  box(body, 0.09, 0.28, 0.09, o.clothDark, 0.08, 0.14, 0);
  // torso
  box(body, 0.3, 0.34, 0.18, o.cloth, 0, 0.45, 0);
  // arms
  box(body, 0.07, 0.3, 0.08, o.cloth, -0.2, 0.46, 0);
  box(body, 0.07, 0.3, 0.08, o.cloth, 0.2, 0.46, 0);
  // head
  sph(body, 0.13, o.skin, 0, 0.74, 0);
  if (o.hunched) {
    body.rotation.x = 0.28;
    body.userData.baseTilt = 0.28;
    body.position.z = 0.05;
  }
  g.add(body);
  g.add(blobShadow(0.62 * (o.scale ?? 1)));
  if (o.scale && o.scale !== 1) body.scale.setScalar(o.scale);
  return g;
}

function bodyOf(g: THREE.Group): THREE.Group {
  return g.getObjectByName("body") as THREE.Group;
}

// ---------- templates ----------
const templates = new Map<string, THREE.Group>();

function template(kind: string): THREE.Group {
  let t = templates.get(kind);
  if (!t) {
    t = build(kind);
    templates.set(kind, t);
  }
  return t;
}

export function spawnModel(kind: string): THREE.Group {
  return template(kind).clone(true);
}

function build(kind: string): THREE.Group {
  switch (kind) {
    case "warlord": {
      const g = humanoid({ skin: 0xd9a066, cloth: 0x868d99, clothDark: 0x40444c });
      const b = bodyOf(g);
      // helm + plume
      sph(b, 0.135, 0x9aa2b0, 0, 0.77, 0, 0.9);
      box(b, 0.05, 0.1, 0.16, 0x7c1a1a, 0, 0.9, 0);
      // pauldrons
      sph(b, 0.09, 0xb9bec8, -0.2, 0.6, 0);
      sph(b, 0.09, 0xb9bec8, 0.2, 0.6, 0);
      // axe in right hand
      const axe = new THREE.Group();
      axe.name = "weapon";
      cyl(axe, 0.02, 0.02, 0.5, 0x6b4a26, 0, 0, 0, 6);
      box(axe, 0.16, 0.14, 0.03, 0xd7dde6, 0.07, 0.18, 0);
      axe.position.set(0.26, 0.42, 0.06);
      axe.rotation.z = -0.15;
      b.add(axe);
      // cape
      box(b, 0.28, 0.4, 0.03, 0x7c1a1a, 0, 0.44, -0.12);
      return g;
    }
    case "pyromancer": {
      const g = new THREE.Group();
      const b = new THREE.Group();
      b.name = "body";
      // robe (cone)
      cone(b, 0.24, 0.62, 0x8e2020, 0, 0.31, 0);
      box(b, 0.3, 0.06, 0.2, 0xc8a856, 0, 0.4, 0); // sash
      // arms
      box(b, 0.07, 0.26, 0.08, 0xa62828, -0.19, 0.48, 0.02);
      box(b, 0.07, 0.26, 0.08, 0xa62828, 0.19, 0.48, 0.02);
      // hooded head
      sph(b, 0.13, 0xc03434, 0, 0.74, 0);
      sph(b, 0.1, 0x241512, 0, 0.72, 0.05);
      // staff with ember orb
      const staff = new THREE.Group();
      staff.name = "weapon";
      cyl(staff, 0.018, 0.018, 0.7, 0x5f3f1e, 0, 0, 0, 6);
      const orb = sph(staff, 0.05, 0xffb050, 0, 0.38, 0);
      orb.material = new THREE.MeshLambertMaterial({ color: 0xffb050, emissive: 0xff6a10, emissiveIntensity: 0.9 });
      staff.add(glowSprite("rgba(255,200,110,0.9)", "rgba(255,110,20,0.4)", 0.34).translateY(0.38));
      staff.position.set(-0.24, 0.35, 0.05);
      b.add(staff);
      g.add(b);
      g.add(blobShadow(0.62));
      return g;
    }
    case "zombie": {
      const g = humanoid({ skin: 0x7a9660, cloth: 0x5a7a40, clothDark: 0x33481f, hunched: true });
      const b = bodyOf(g);
      // arms stretched forward
      const arms = b.children.filter((c) => Math.abs(c.position.x) > 0.15 && c.position.y > 0.3);
      for (const a of arms) {
        a.position.z = 0.14;
        a.rotation.x = -1.2;
      }
      return g;
    }
    case "skeleton": {
      const g = new THREE.Group();
      const b = new THREE.Group();
      b.name = "body";
      const bone = 0xd9d2ba;
      box(b, 0.06, 0.28, 0.06, bone, -0.07, 0.14, 0);
      box(b, 0.06, 0.28, 0.06, bone, 0.07, 0.14, 0);
      // ribcage: stacked thin boxes
      box(b, 0.24, 0.05, 0.14, bone, 0, 0.52, 0);
      box(b, 0.22, 0.05, 0.13, bone, 0, 0.44, 0);
      box(b, 0.2, 0.05, 0.12, bone, 0, 0.36, 0);
      cyl(b, 0.02, 0.02, 0.3, bone, 0, 0.45, 0, 6);
      box(b, 0.18, 0.08, 0.1, bone, 0, 0.3, 0); // pelvis
      box(b, 0.05, 0.28, 0.05, bone, -0.17, 0.46, 0);
      box(b, 0.05, 0.28, 0.05, bone, 0.17, 0.46, 0);
      sph(b, 0.11, 0xefe8d2, 0, 0.72, 0);
      g.add(b);
      g.add(blobShadow(0.55));
      return g;
    }
    case "archer": {
      const g = build("skeleton");
      const b = bodyOf(g);
      const bow = new THREE.Mesh(
        geo("bow", () => new THREE.TorusGeometry(0.18, 0.015, 6, 12, Math.PI)),
        mat(0x8a5a2b),
      );
      bow.position.set(0.24, 0.5, 0.05);
      bow.rotation.z = -Math.PI / 2;
      b.add(bow);
      return g;
    }
    case "imp": {
      const g = new THREE.Group();
      const b = new THREE.Group();
      b.name = "body";
      box(b, 0.08, 0.2, 0.08, 0x6e2414, -0.07, 0.1, 0);
      box(b, 0.08, 0.2, 0.08, 0x6e2414, 0.07, 0.1, 0);
      sph(b, 0.16, 0xb04028, 0, 0.32, 0, 1.15);
      sph(b, 0.14, 0xd05838, 0, 0.6, 0);
      cone(b, 0.035, 0.12, 0xe8d8b8, -0.09, 0.74, 0, 0.5);
      cone(b, 0.035, 0.12, 0xe8d8b8, 0.09, 0.74, 0, -0.5);
      // ember hands
      const emberL = glowSprite("rgba(255,210,120,0.9)", "rgba(255,110,20,0.4)", 0.22);
      emberL.position.set(-0.2, 0.32, 0.08);
      b.add(emberL);
      g.add(b);
      g.add(blobShadow(0.5));
      return g;
    }
    case "bat": {
      const g = new THREE.Group();
      const b = new THREE.Group();
      b.name = "body";
      sph(b, 0.11, 0x5d3580, 0, 0.62, 0, 1.15);
      cone(b, 0.03, 0.08, 0x7a4aa0, -0.05, 0.74, 0);
      cone(b, 0.03, 0.08, 0x7a4aa0, 0.05, 0.74, 0);
      const wingGeo = geo("wing", () => new THREE.PlaneGeometry(0.34, 0.2));
      const wingMat = new THREE.MeshLambertMaterial({ color: 0x8a5ab0, side: THREE.DoubleSide });
      const wl = new THREE.Mesh(wingGeo, wingMat);
      wl.name = "wingL";
      wl.position.set(-0.24, 0.64, 0);
      const wr = new THREE.Mesh(wingGeo, wingMat);
      wr.name = "wingR";
      wr.position.set(0.24, 0.64, 0);
      b.add(wl, wr);
      g.add(b);
      g.add(blobShadow(0.4));
      return g;
    }
    case "brute": {
      const g = new THREE.Group();
      const b = new THREE.Group();
      b.name = "body";
      box(b, 0.16, 0.34, 0.16, 0x3f2d18, -0.14, 0.17, 0);
      box(b, 0.16, 0.34, 0.16, 0x3f2d18, 0.14, 0.17, 0);
      sph(b, 0.34, 0x77552c, 0, 0.62, 0, 1.05);
      sph(b, 0.2, 0xa8845a, 0, 0.52, 0.16, 0.9); // belly
      // massive arms
      box(b, 0.14, 0.44, 0.15, 0x8d693a, -0.4, 0.55, 0);
      box(b, 0.14, 0.44, 0.15, 0x8d693a, 0.4, 0.55, 0);
      sph(b, 0.11, 0xa8845a, -0.4, 0.3, 0);
      sph(b, 0.11, 0xa8845a, 0.4, 0.3, 0);
      sph(b, 0.14, 0x96703e, 0, 0.98, 0.05);
      cone(b, 0.03, 0.1, 0xe8dcc0, -0.07, 0.95, 0.14, 0.4);
      cone(b, 0.03, 0.1, 0xe8dcc0, 0.07, 0.95, 0.14, -0.4);
      g.add(b);
      g.add(blobShadow(1.0));
      return g;
    }
    case "boss": {
      const g = new THREE.Group();
      const b = new THREE.Group();
      b.name = "body";
      cone(b, 0.42, 1.1, 0x3c1a54, 0, 0.55, 0);
      box(b, 0.5, 0.08, 0.3, 0x7a3ca6, 0, 0.85, 0);
      sph(b, 0.14, 0x7a3ca6, -0.34, 0.9, 0);
      sph(b, 0.14, 0x7a3ca6, 0.34, 0.9, 0);
      sph(b, 0.17, 0xefe8d2, 0, 1.22, 0); // skull
      // glowing eyes
      const eyeL = glowSprite("rgba(220,110,255,1)", "rgba(160,50,220,0.5)", 0.12);
      eyeL.position.set(-0.06, 1.24, 0.13);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.06;
      b.add(eyeL, eyeR);
      // crown of horns
      cone(b, 0.035, 0.16, 0x22102e, -0.12, 1.38, 0, 0.4);
      cone(b, 0.035, 0.16, 0x22102e, 0.12, 1.38, 0, -0.4);
      cone(b, 0.04, 0.2, 0x7a3ca6, 0, 1.44, 0);
      // floating orbs
      const orb1 = glowSprite("rgba(232,176,255,0.95)", "rgba(160,64,216,0.5)", 0.34);
      orb1.name = "orb1";
      orb1.position.set(-0.6, 0.9, 0);
      const orb2 = orb1.clone();
      orb2.name = "orb2";
      orb2.position.set(0.6, 0.9, 0);
      b.add(orb1, orb2);
      const light = new THREE.PointLight(0xa040d8, 1.4, 6, 1.8);
      light.position.y = 1.1;
      b.add(light);
      g.add(b);
      g.add(blobShadow(1.15));
      return g;
    }
    // ---------------- objects ----------------
    case "torch": {
      const g = new THREE.Group();
      cyl(g, 0.03, 0.04, 0.9, 0x5d3f1e, 0, 0.45, 0, 6);
      const flame = glowSprite("rgba(255,225,150,1)", "rgba(255,120,30,0.55)", 0.55);
      flame.name = "flame";
      flame.position.y = 1.0;
      g.add(flame);
      const light = new THREE.PointLight(0xff9a3c, 1.3, 7, 1.6);
      light.name = "torchlight";
      light.position.y = 1.1;
      g.add(light);
      return g;
    }
    case "chest": {
      const g = new THREE.Group();
      box(g, 0.62, 0.3, 0.42, 0x6d4a24, 0, 0.15, 0);
      box(g, 0.64, 0.14, 0.44, 0x8a5f30, 0, 0.36, 0);
      box(g, 0.1, 0.46, 0.46, 0x3c3c44, -0.18, 0.22, 0);
      box(g, 0.1, 0.46, 0.46, 0x3c3c44, 0.18, 0.22, 0);
      box(g, 0.12, 0.12, 0.05, 0xc8a856, 0, 0.28, 0.22);
      g.add(blobShadow(0.85));
      return g;
    }
    case "stash": {
      const g = new THREE.Group();
      box(g, 0.85, 0.5, 0.55, 0x38230e, 0, 0.25, 0);
      box(g, 0.87, 0.16, 0.57, 0x6d4a24, 0, 0.56, 0);
      box(g, 0.12, 0.68, 0.59, 0x41414b, -0.26, 0.3, 0);
      box(g, 0.12, 0.68, 0.59, 0x41414b, 0.26, 0.3, 0);
      box(g, 0.16, 0.18, 0.06, 0xc8a856, 0, 0.34, 0.28);
      g.add(blobShadow(1.0));
      return g;
    }
    case "well": {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(geo("wellring", () => new THREE.TorusGeometry(0.42, 0.12, 8, 14)), mat(0x6d675c));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.22;
      g.add(ring);
      const water = new THREE.Mesh(geo("wellwater", () => new THREE.CircleGeometry(0.36, 14)),
        new THREE.MeshLambertMaterial({ color: 0x2a58a8, emissive: 0x102448, emissiveIntensity: 0.8 }));
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.18;
      g.add(water);
      cyl(g, 0.04, 0.04, 0.7, 0x6d4a24, -0.4, 0.45, 0, 6);
      cyl(g, 0.04, 0.04, 0.7, 0x6d4a24, 0.4, 0.45, 0, 6);
      box(g, 0.96, 0.07, 0.2, 0x6d4a24, 0, 0.82, 0);
      g.add(blobShadow(1.0));
      return g;
    }
    case "waypoint": {
      const g = new THREE.Group();
      cyl(g, 0.55, 0.62, 0.1, 0x55504a, 0, 0.05, 0, 14);
      const disc = new THREE.Mesh(geo("wpdisc", () => new THREE.CircleGeometry(0.42, 16)),
        new THREE.MeshLambertMaterial({ color: 0x5ac8d8, emissive: 0x2a8a9a, emissiveIntensity: 1.2 }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.11;
      g.add(disc);
      const glow = glowSprite("rgba(120,220,235,0.7)", "rgba(90,200,216,0.25)", 1.4);
      glow.position.y = 0.35;
      g.add(glow);
      const light = new THREE.PointLight(0x5ac8d8, 0.9, 5, 1.8);
      light.position.y = 0.6;
      g.add(light);
      return g;
    }
    case "shrine": {
      const g = new THREE.Group();
      cyl(g, 0.16, 0.3, 0.55, 0x6d675c, 0, 0.28, 0, 8);
      const crystal = new THREE.Mesh(geo("shrinecrystal", () => new THREE.OctahedronGeometry(0.2)),
        new THREE.MeshLambertMaterial({ color: 0x5ac8d8, emissive: 0x2a7a88, emissiveIntensity: 1.1 }));
      crystal.name = "crystal";
      crystal.position.y = 0.95;
      g.add(crystal);
      const glow = glowSprite("rgba(120,220,235,0.65)", "rgba(90,200,216,0.25)", 0.9);
      glow.name = "shrineglow";
      glow.position.y = 0.95;
      g.add(glow);
      g.add(blobShadow(0.6));
      return g;
    }
    case "vendor": {
      const g = humanoid({ skin: 0xd9a066, cloth: 0x63477a, clothDark: 0x412f52 });
      const b = bodyOf(g);
      sph(b, 0.14, 0xe0b45c, 0, 0.78, 0, 0.8); // headwrap
      const counter = new THREE.Group();
      box(counter, 1.0, 0.09, 0.4, 0x96703c, 0, 0.5, 0);
      box(counter, 0.92, 0.5, 0.32, 0x5d3f1e, 0, 0.25, 0);
      // little wares
      cyl(counter, 0.045, 0.055, 0.12, 0xc03434, -0.3, 0.6, 0.02, 8);
      cyl(counter, 0.045, 0.055, 0.12, 0x3a48c0, -0.12, 0.6, -0.04, 8);
      cyl(counter, 0.07, 0.08, 0.06, 0xd8ab4a, 0.25, 0.57, 0);
      counter.position.set(0, 0, 0.42);
      g.add(counter);
      g.rotation.y = Math.PI / 4;
      return g;
    }
    case "gambler": {
      const g = humanoid({ skin: 0xd9a066, cloth: 0x2a3d26, clothDark: 0x182116 });
      const b = bodyOf(g);
      // wide-brim hat
      cyl(b, 0.19, 0.19, 0.03, 0x1e1810, 0, 0.84, 0, 12);
      cyl(b, 0.1, 0.11, 0.1, 0x2a2318, 0, 0.9, 0, 10);
      // dice held up
      const armR = b.children.find((c) => c.position.x > 0.15 && c.position.y > 0.3);
      if (armR) armR.rotation.x = -1.4;
      box(b, 0.06, 0.06, 0.06, 0xf6f2e6, 0.2, 0.72, 0.14, 0.4);
      box(b, 0.06, 0.06, 0.06, 0xf6f2e6, 0.28, 0.76, 0.1, -0.3);
      g.rotation.y = Math.PI / 4;
      return g;
    }
    case "stairs_down": return portalModel(0x8a3cd0, 0xc890ff, "rgba(200,150,255,0.85)", "rgba(130,60,210,0.4)");
    case "stairs_up": return portalModel(0x2a9e5c, 0x8ae8b0, "rgba(140,230,180,0.85)", "rgba(40,160,90,0.4)");
    case "sentinel": {
      const g = new THREE.Group();
      cyl(g, 0.09, 0.14, 0.55, 0x55504a, 0, 0.28, 0, 8);
      box(g, 0.2, 0.08, 0.2, 0x6d675c, 0, 0.58, 0);
      const flame = glowSprite("rgba(255,210,120,0.95)", "rgba(255,110,20,0.5)", 0.55);
      flame.name = "flame";
      flame.position.y = 0.85;
      g.add(flame);
      const orb = new THREE.Mesh(
        geo("sentorb", () => new THREE.SphereGeometry(0.09, 10, 8)),
        new THREE.MeshLambertMaterial({ color: 0xffb050, emissive: 0xff6a10, emissiveIntensity: 1 }),
      );
      orb.position.y = 0.85;
      g.add(orb);
      const light = new THREE.PointLight(0xff9a3c, 0.9, 5, 1.8);
      light.position.y = 0.9;
      g.add(light);
      g.add(blobShadow(0.4));
      return g;
    }
    default: {
      const g = new THREE.Group();
      sph(g, 0.2, 0xff00ff, 0, 0.3, 0);
      return g;
    }
  }
}

// Upright swirling rift portal (faces the camera diagonal).
function portalModel(rimColor: number, coreColor: number, glowInner: string, glowOuter: string): THREE.Group {
  const g = new THREE.Group();
  // stone base
  cyl(g, 0.6, 0.7, 0.12, 0x55504a, 0, 0.06, 0, 12);
  // standing ring
  const ring = new THREE.Mesh(
    geo(`portalring${rimColor}`, () => new THREE.TorusGeometry(0.55, 0.07, 8, 22)),
    new THREE.MeshLambertMaterial({ color: rimColor, emissive: rimColor, emissiveIntensity: 0.5 }),
  );
  ring.position.y = 0.75;
  ring.name = "ring";
  g.add(ring);
  // swirling core
  const core = new THREE.Mesh(
    geo(`portalcore${coreColor}`, () => new THREE.CircleGeometry(0.48, 20)),
    new THREE.MeshBasicMaterial({ color: coreColor, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  core.position.y = 0.75;
  core.name = "core";
  g.add(core);
  const glow = glowSprite(glowInner, glowOuter, 1.7);
  glow.position.y = 0.8;
  g.add(glow);
  const light = new THREE.PointLight(rimColor, 1.1, 6, 1.8);
  light.position.y = 0.9;
  g.add(light);
  // face the camera diagonal so the ring reads as a doorway
  g.rotation.y = Math.PI / 4;
  return g;
}
