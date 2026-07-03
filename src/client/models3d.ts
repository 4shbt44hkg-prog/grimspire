// Low-poly 3D models with an articulated limb rig. Limbs are groups that
// pivot at the hip/shoulder so the renderer can drive real walk cycles.
// Templates are built once and cloned per instance (shared geo/materials).
// World scale: 1 unit = 1 tile; characters ~0.9 tall.

import * as THREE from "three";

const matCache = new Map<string, THREE.MeshLambertMaterial>();
export function mat(color: number | string): THREE.MeshLambertMaterial {
  const key = `${color}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
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

// ---------- glow sprites ----------
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

// ---------- rig helpers ----------
// A limb is a group pivoting at its attachment point; contents hang below.
function limb(name: string, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
}

interface HumanoidOpts {
  skin: number;
  cloth: number;
  clothDark: number;
  hunched?: boolean;
  armsForward?: boolean;
}

// Standard biped: legs pivot at the hip (y=0.42), arms at the shoulder (y=0.62).
function humanoid(o: HumanoidOpts): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  body.userData.rig = "biped";

  const legL = limb("legL", -0.08, 0.42, 0);
  box(legL, 0.09, 0.3, 0.09, o.clothDark, 0, -0.15, 0);
  const legR = limb("legR", 0.08, 0.42, 0);
  box(legR, 0.09, 0.3, 0.09, o.clothDark, 0, -0.15, 0);
  body.add(legL, legR);

  box(body, 0.3, 0.34, 0.18, o.cloth, 0, 0.45, 0);

  const armL = limb("armL", -0.2, 0.62, 0);
  box(armL, 0.07, 0.3, 0.08, o.cloth, 0, -0.16, 0);
  const armR = limb("armR", 0.2, 0.62, 0);
  box(armR, 0.07, 0.3, 0.08, o.cloth, 0, -0.16, 0);
  body.add(armL, armR);

  sph(body, 0.13, o.skin, 0, 0.74, 0);

  if (o.hunched) {
    body.rotation.x = 0.28;
    body.userData.baseTilt = 0.28;
    body.position.z = 0.05;
  }
  if (o.armsForward) {
    armL.rotation.x = -1.2;
    armR.rotation.x = -1.2;
    armL.userData.baseX = -1.2;
    armR.userData.baseX = -1.2;
  }
  g.add(body);
  g.add(blobShadow(0.62));
  return g;
}

// Robed caster: no visible legs, swaying robe, swinging arms.
function robed(robe: number, robeDark: number, skin: number, hoodColor?: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  body.userData.rig = "arms";
  const robeMesh = cone(body, 0.24, 0.62, robe, 0, 0.31, 0);
  robeMesh.name = "robe";
  box(body, 0.3, 0.06, 0.2, robeDark, 0, 0.4, 0);
  const armL = limb("armL", -0.19, 0.6, 0.02);
  box(armL, 0.07, 0.26, 0.08, robeDark, 0, -0.14, 0);
  const armR = limb("armR", 0.19, 0.6, 0.02);
  box(armR, 0.07, 0.26, 0.08, robeDark, 0, -0.14, 0);
  body.add(armL, armR);
  sph(body, 0.13, hoodColor ?? robe, 0, 0.74, 0);
  sph(body, 0.1, skin, 0, 0.72, 0.05);
  g.add(body);
  g.add(blobShadow(0.62));
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
      sph(b, 0.135, 0x9aa2b0, 0, 0.77, 0, 0.9);
      box(b, 0.05, 0.1, 0.16, 0x7c1a1a, 0, 0.9, 0);
      sph(b, 0.09, 0xb9bec8, -0.2, 0.63, 0);
      sph(b, 0.09, 0xb9bec8, 0.2, 0.63, 0);
      // axe carried in the right hand (swings with the arm)
      const armR = b.getObjectByName("armR")!;
      const axe = new THREE.Group();
      cyl(axe, 0.02, 0.02, 0.5, 0x6b4a26, 0, 0, 0, 6);
      box(axe, 0.16, 0.14, 0.03, 0xd7dde6, 0.07, 0.18, 0);
      axe.position.set(0.06, -0.24, 0.06);
      axe.rotation.z = -0.15;
      armR.add(axe);
      box(b, 0.28, 0.4, 0.03, 0x7c1a1a, 0, 0.44, -0.13); // cape
      return g;
    }
    case "pyromancer": {
      const g = robed(0xc03434, 0x8e2020, 0x241512);
      const b = bodyOf(g);
      box(b, 0.3, 0.05, 0.2, 0xc8a856, 0, 0.42, 0); // gold sash
      // eyes glowing under the hood
      const eye = glowSprite("rgba(255,176,80,1)", "rgba(255,110,20,0.4)", 0.09);
      eye.position.set(-0.035, 0.73, 0.11);
      const eye2 = eye.clone();
      eye2.position.x = 0.035;
      b.add(eye, eye2);
      // staff with ember orb in the left hand
      const armL = b.getObjectByName("armL")!;
      const staff = new THREE.Group();
      cyl(staff, 0.018, 0.018, 0.7, 0x5f3f1e, 0, 0, 0, 6);
      const orb = sph(staff, 0.05, 0xffb050, 0, 0.38, 0);
      orb.material = new THREE.MeshLambertMaterial({ color: 0xffb050, emissive: 0xff6a10, emissiveIntensity: 0.9 });
      const orbGlow = glowSprite("rgba(255,200,110,0.9)", "rgba(255,110,20,0.4)", 0.34);
      orbGlow.position.y = 0.38;
      staff.add(orbGlow);
      staff.position.set(-0.05, -0.24, 0.05);
      armL.add(staff);
      return g;
    }
    case "zombie": {
      const g = humanoid({ skin: 0x7a9660, cloth: 0x5a7a40, clothDark: 0x33481f, hunched: true, armsForward: true });
      const b = bodyOf(g);
      sph(b, 0.035, 0xd8d43a, -0.045, 0.76, 0.1);
      sph(b, 0.035, 0xd8d43a, 0.05, 0.76, 0.1);
      sph(b, 0.05, 0x3d2020, 0.08, 0.5, 0.1); // wound
      return g;
    }
    case "skeleton": case "archer": {
      const g = new THREE.Group();
      const body = new THREE.Group();
      body.name = "body";
      body.userData.rig = "biped";
      const bone = 0xd9d2ba;
      const legL = limb("legL", -0.07, 0.42, 0);
      box(legL, 0.06, 0.3, 0.06, bone, 0, -0.15, 0);
      const legR = limb("legR", 0.07, 0.42, 0);
      box(legR, 0.06, 0.3, 0.06, bone, 0, -0.15, 0);
      body.add(legL, legR);
      box(body, 0.24, 0.05, 0.14, bone, 0, 0.56, 0);
      box(body, 0.22, 0.05, 0.13, bone, 0, 0.48, 0);
      box(body, 0.2, 0.05, 0.12, bone, 0, 0.4, 0);
      cyl(body, 0.02, 0.02, 0.28, bone, 0, 0.48, 0, 6);
      box(body, 0.18, 0.08, 0.1, bone, 0, 0.34, 0);
      const armL = limb("armL", -0.17, 0.6, 0);
      box(armL, 0.05, 0.28, 0.05, bone, 0, -0.15, 0);
      const armR = limb("armR", 0.17, 0.6, 0);
      box(armR, 0.05, 0.28, 0.05, bone, 0, -0.15, 0);
      body.add(armL, armR);
      sph(body, 0.11, 0xefe8d2, 0, 0.74, 0);
      sph(body, 0.02, 0x191410, -0.04, 0.76, 0.09);
      sph(body, 0.02, 0x191410, 0.04, 0.76, 0.09);
      if (kind === "archer") {
        const bow = new THREE.Mesh(
          geo("bow", () => new THREE.TorusGeometry(0.18, 0.015, 6, 12, Math.PI)),
          mat(0x8a5a2b),
        );
        bow.position.set(0.02, -0.22, 0.06);
        bow.rotation.z = -Math.PI / 2;
        armR.add(bow);
      }
      g.add(body);
      g.add(blobShadow(0.55));
      return g;
    }
    case "imp": {
      const g = new THREE.Group();
      const b = new THREE.Group();
      b.name = "body";
      b.userData.rig = "biped";
      const legL = limb("legL", -0.07, 0.22, 0);
      box(legL, 0.08, 0.2, 0.08, 0x6e2414, 0, -0.1, 0);
      const legR = limb("legR", 0.07, 0.22, 0);
      box(legR, 0.08, 0.2, 0.08, 0x6e2414, 0, -0.1, 0);
      b.add(legL, legR);
      sph(b, 0.16, 0xb04028, 0, 0.34, 0, 1.15);
      const armL = limb("armL", -0.16, 0.4, 0);
      sph(armL, 0.06, 0xb04028, 0, -0.1, 0.02, 1.6);
      const emberL = glowSprite("rgba(255,210,120,0.9)", "rgba(255,110,20,0.4)", 0.2);
      emberL.position.set(0, -0.2, 0.04);
      armL.add(emberL);
      const armR = limb("armR", 0.16, 0.4, 0);
      sph(armR, 0.06, 0xb04028, 0, -0.1, 0.02, 1.6);
      b.add(armL, armR);
      cone(b, 0.035, 0.12, 0xe8d8b8, -0.09, 0.72, 0, 0.5);
      cone(b, 0.035, 0.12, 0xe8d8b8, 0.09, 0.72, 0, -0.5);
      sph(b, 0.14, 0xd05838, 0, 0.58, 0);
      sph(b, 0.025, 0xffe060, -0.05, 0.6, 0.11);
      sph(b, 0.025, 0xffe060, 0.05, 0.6, 0.11);
      g.add(b);
      g.add(blobShadow(0.5));
      return g;
    }
    case "bat": {
      const g = new THREE.Group();
      const b = new THREE.Group();
      b.name = "body";
      b.userData.rig = "none";
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
      sph(b, 0.02, 0xff5050, -0.035, 0.64, 0.1);
      sph(b, 0.02, 0xff5050, 0.035, 0.64, 0.1);
      g.add(b);
      g.add(blobShadow(0.4));
      return g;
    }
    case "brute": {
      const g = new THREE.Group();
      const b = new THREE.Group();
      b.name = "body";
      b.userData.rig = "biped";
      const legL = limb("legL", -0.14, 0.36, 0);
      box(legL, 0.16, 0.34, 0.16, 0x3f2d18, 0, -0.17, 0);
      const legR = limb("legR", 0.14, 0.36, 0);
      box(legR, 0.16, 0.34, 0.16, 0x3f2d18, 0, -0.17, 0);
      b.add(legL, legR);
      sph(b, 0.34, 0x77552c, 0, 0.64, 0, 1.05);
      sph(b, 0.2, 0xa8845a, 0, 0.54, 0.16, 0.9);
      const armL = limb("armL", -0.4, 0.78, 0);
      box(armL, 0.14, 0.44, 0.15, 0x8d693a, 0, -0.22, 0);
      sph(armL, 0.11, 0xa8845a, 0, -0.46, 0);
      const armR = limb("armR", 0.4, 0.78, 0);
      box(armR, 0.14, 0.44, 0.15, 0x8d693a, 0, -0.22, 0);
      sph(armR, 0.11, 0xa8845a, 0, -0.46, 0);
      b.add(armL, armR);
      sph(b, 0.14, 0x96703e, 0, 1.0, 0.05);
      sph(b, 0.025, 0xe04830, -0.05, 1.02, 0.16);
      sph(b, 0.025, 0xe04830, 0.05, 1.02, 0.16);
      cone(b, 0.03, 0.1, 0xe8dcc0, -0.07, 0.97, 0.16, 0.4);
      cone(b, 0.03, 0.1, 0xe8dcc0, 0.07, 0.97, 0.16, -0.4);
      g.add(b);
      g.add(blobShadow(1.0));
      return g;
    }
    case "boss": {
      const g = new THREE.Group();
      const b = new THREE.Group();
      b.name = "body";
      b.userData.rig = "float";
      cone(b, 0.42, 1.1, 0x3c1a54, 0, 0.55, 0);
      box(b, 0.5, 0.08, 0.3, 0x7a3ca6, 0, 0.85, 0);
      sph(b, 0.14, 0x7a3ca6, -0.34, 0.9, 0);
      sph(b, 0.14, 0x7a3ca6, 0.34, 0.9, 0);
      sph(b, 0.17, 0xefe8d2, 0, 1.22, 0);
      const eyeL = glowSprite("rgba(220,110,255,1)", "rgba(160,50,220,0.5)", 0.12);
      eyeL.position.set(-0.06, 1.24, 0.13);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.06;
      b.add(eyeL, eyeR);
      cone(b, 0.035, 0.16, 0x22102e, -0.12, 1.38, 0, 0.4);
      cone(b, 0.035, 0.16, 0x22102e, 0.12, 1.38, 0, -0.4);
      cone(b, 0.04, 0.2, 0x7a3ca6, 0, 1.44, 0);
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
    // ---- biome signature enemies ----
    case "witch": {
      const g = robed(0x4a5a30, 0x33401f, 0x2a2416, 0x3d4a28);
      const b = bodyOf(g);
      // glowing green eyes + gnarled staff with venom orb
      const eye = glowSprite("rgba(160,255,120,1)", "rgba(60,180,40,0.4)", 0.08);
      eye.position.set(-0.035, 0.73, 0.11);
      const eye2 = eye.clone();
      eye2.position.x = 0.035;
      b.add(eye, eye2);
      const armR = b.getObjectByName("armR")!;
      const staff = new THREE.Group();
      cyl(staff, 0.016, 0.022, 0.66, 0x3d2c14, 0, 0, 0, 5);
      const orb = sph(staff, 0.05, 0x7ad87a, 0, 0.36, 0);
      orb.material = new THREE.MeshLambertMaterial({ color: 0x7ad87a, emissive: 0x2a8a2a, emissiveIntensity: 0.9 });
      const orbGlow = glowSprite("rgba(150,255,150,0.9)", "rgba(40,160,40,0.4)", 0.3);
      orbGlow.position.y = 0.36;
      staff.add(orbGlow);
      staff.position.set(0.05, -0.22, 0.05);
      armR.add(staff);
      return g;
    }
    case "rime": {
      const g = robed(0x5a7a9e, 0x3d5570, 0x101c28, 0x4a688a);
      const b = bodyOf(g);
      const eye = glowSprite("rgba(170,230,255,1)", "rgba(80,160,230,0.4)", 0.08);
      eye.position.set(-0.035, 0.73, 0.11);
      const eye2 = eye.clone();
      eye2.position.x = 0.035;
      b.add(eye, eye2);
      // ice crystals hovering over the shoulders
      const crystal = new THREE.Mesh(
        geo("rimecrys", () => new THREE.OctahedronGeometry(0.07)),
        new THREE.MeshLambertMaterial({ color: 0xbdf2fa, emissive: 0x2a7a88, emissiveIntensity: 0.8 }),
      );
      crystal.position.set(-0.26, 0.85, 0);
      const c2 = crystal.clone();
      c2.position.set(0.26, 0.8, 0);
      b.add(crystal, c2);
      return g;
    }
    case "hound": {
      const g = new THREE.Group();
      const b = new THREE.Group();
      b.name = "body";
      b.userData.rig = "quad";
      // charcoal body with ember cracks, built long along +Z
      box(b, 0.26, 0.24, 0.58, 0x2e2320, 0, 0.42, 0);
      sph(b, 0.05, 0xff7020, 0.1, 0.5, 0.1);
      sph(b, 0.04, 0xff7020, -0.09, 0.44, -0.14);
      const mk = (nm: string, x: number, z: number) => {
        const l = limb(nm, x, 0.34, z);
        box(l, 0.08, 0.3, 0.08, 0x241a16, 0, -0.15, 0);
        b.add(l);
      };
      mk("qlegFL", -0.11, 0.2);
      mk("qlegFR", 0.11, 0.2);
      mk("qlegBL", -0.11, -0.2);
      mk("qlegBR", 0.11, -0.2);
      // head with burning eyes and jaw
      sph(b, 0.13, 0x352824, 0, 0.52, 0.36);
      box(b, 0.12, 0.07, 0.14, 0x241a16, 0, 0.44, 0.44);
      const eye = glowSprite("rgba(255,180,60,1)", "rgba(255,90,10,0.5)", 0.11);
      eye.position.set(-0.06, 0.56, 0.46);
      const eye2 = eye.clone();
      eye2.position.x = 0.06;
      b.add(eye, eye2);
      cone(b, 0.04, 0.12, 0x241a16, -0.07, 0.64, 0.32, 0.3);
      cone(b, 0.04, 0.12, 0x241a16, 0.07, 0.64, 0.32, -0.3);
      // ember tail
      const tail = glowSprite("rgba(255,150,50,0.8)", "rgba(255,90,10,0.35)", 0.26);
      tail.position.set(0, 0.5, -0.34);
      b.add(tail);
      g.add(b);
      g.add(blobShadow(0.7));
      return g;
    }
    case "fungal": case "spawnling": {
      const small = kind === "spawnling";
      const s = small ? 0.55 : 1;
      const g = new THREE.Group();
      const b = new THREE.Group();
      b.name = "body";
      b.userData.rig = "blob";
      sph(b, 0.28 * s, 0x6a5a38, 0, 0.3 * s, 0, 1.1);
      // cap
      const cap = sph(b, 0.3 * s, 0x8a6a9e, 0, 0.56 * s, 0, 0.55);
      cap.material = mat(0x8a6a9e);
      sph(b, 0.05 * s, 0xc8b0d8, -0.12 * s, 0.62 * s, 0.12 * s);
      sph(b, 0.04 * s, 0xc8b0d8, 0.14 * s, 0.6 * s, -0.06 * s);
      // glowing spores
      const spore = glowSprite("rgba(200,170,255,0.9)", "rgba(120,80,180,0.4)", 0.16 * s);
      spore.position.set(0.1 * s, 0.42 * s, 0.2 * s);
      b.add(spore);
      // eyes
      sph(b, 0.03 * s, 0xd8ff90, -0.08 * s, 0.34 * s, 0.24 * s);
      sph(b, 0.03 * s, 0xd8ff90, 0.08 * s, 0.34 * s, 0.24 * s);
      // stubby tendril feet
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        cone(b, 0.05 * s, 0.14 * s, 0x54462c, Math.cos(a) * 0.2 * s, 0.07 * s, Math.sin(a) * 0.2 * s, 0.5);
      }
      g.add(b);
      g.add(blobShadow(small ? 0.35 : 0.62));
      return g;
    }
    // ---- objects ----
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
      sph(b, 0.14, 0xe0b45c, 0, 0.78, 0, 0.8);
      const counter = new THREE.Group();
      box(counter, 1.0, 0.09, 0.4, 0x96703c, 0, 0.5, 0);
      box(counter, 0.92, 0.5, 0.32, 0x5d3f1e, 0, 0.25, 0);
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
      cyl(b, 0.19, 0.19, 0.03, 0x1e1810, 0, 0.84, 0, 12);
      cyl(b, 0.1, 0.11, 0.1, 0x2a2318, 0, 0.9, 0, 10);
      const armR = b.getObjectByName("armR")!;
      armR.rotation.x = -1.4;
      armR.userData.baseX = -1.4;
      box(armR, 0.06, 0.06, 0.06, 0xf6f2e6, 0.02, -0.3, 0.06, 0.4);
      box(armR, 0.06, 0.06, 0.06, 0xf6f2e6, 0.09, -0.26, 0.02, -0.3);
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
    // ---- environment props (placed on blocking obstacle tiles) ----
    case "stone_mono": {
      const g = new THREE.Group();
      const m = box(g, 0.34, 1.3, 0.24, 0x6d675c, 0, 0.6, 0);
      m.rotation.z = 0.06;
      box(g, 0.42, 0.18, 0.32, 0x55504a, 0, 0.06, 0);
      // carved rune glow
      const rune = glowSprite("rgba(140,220,235,0.7)", "rgba(90,200,216,0.2)", 0.3);
      rune.position.set(0.02, 0.7, 0.14);
      g.add(rune);
      return g;
    }
    case "obelisk": {
      const g = new THREE.Group();
      const m = box(g, 0.3, 1.5, 0.3, 0x2e2320, 0, 0.7, 0);
      m.rotation.y = 0.6;
      const rune = glowSprite("rgba(255,160,60,0.8)", "rgba(230,90,16,0.25)", 0.34);
      rune.position.set(0, 0.8, 0.16);
      g.add(rune);
      return g;
    }
    case "pillar_ruin": {
      const g = new THREE.Group();
      cyl(g, 0.2, 0.24, 0.3, 0x7c766a, 0, 0.15, 0, 9);
      cyl(g, 0.17, 0.19, 0.5, 0x8a8478, 0, 0.55, 0, 9);
      const cap = cyl(g, 0.16, 0.18, 0.28, 0x7c766a, 0.05, 0.92, 0.02, 9);
      cap.rotation.z = 0.3;
      return g;
    }
    case "log": {
      const g = new THREE.Group();
      const trunk = cyl(g, 0.13, 0.15, 1.1, 0x4a3a24, 0, 0.14, 0, 8);
      trunk.rotation.z = Math.PI / 2;
      trunk.rotation.y = 0.4;
      sph(g, 0.09, 0x3d5a2c, 0.2, 0.26, 0.05, 0.5);
      return g;
    }
    case "bonepile": {
      const g = new THREE.Group();
      const bone = 0xd9d2ba;
      box(g, 0.4, 0.06, 0.08, bone, 0, 0.05, 0).rotation.y = 0.4;
      box(g, 0.34, 0.06, 0.07, bone, 0.1, 0.1, 0.1).rotation.y = -0.5;
      sph(g, 0.11, 0xefe8d2, -0.12, 0.12, 0.06);
      sph(g, 0.02, 0x191410, -0.15, 0.14, 0.15);
      return g;
    }
    case "iceshard": {
      const g = new THREE.Group();
      const im = new THREE.MeshLambertMaterial({ color: 0xbdf2fa, emissive: 0x1f4a56, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 });
      const c1 = new THREE.Mesh(geo("iceshard1", () => new THREE.ConeGeometry(0.14, 0.9, 6)), im);
      c1.position.set(0, 0.45, 0);
      c1.rotation.z = 0.12;
      const c2 = new THREE.Mesh(geo("iceshard2", () => new THREE.ConeGeometry(0.09, 0.55, 6)), im);
      c2.position.set(0.18, 0.26, 0.08);
      c2.rotation.z = -0.3;
      g.add(c1, c2);
      return g;
    }
    default: {
      const g = new THREE.Group();
      sph(g, 0.2, 0xff00ff, 0, 0.3, 0);
      return g;
    }
  }
}

// Upright swirling rift portal.
function portalModel(rimColor: number, coreColor: number, glowInner: string, glowOuter: string): THREE.Group {
  const g = new THREE.Group();
  cyl(g, 0.6, 0.7, 0.12, 0x55504a, 0, 0.06, 0, 12);
  const ring = new THREE.Mesh(
    geo(`portalring${rimColor}`, () => new THREE.TorusGeometry(0.55, 0.07, 8, 22)),
    new THREE.MeshLambertMaterial({ color: rimColor, emissive: rimColor, emissiveIntensity: 0.5 }),
  );
  ring.position.y = 0.75;
  ring.name = "ring";
  g.add(ring);
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
  g.rotation.y = Math.PI / 4;
  return g;
}
