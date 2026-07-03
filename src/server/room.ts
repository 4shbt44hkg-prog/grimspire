import type { WebSocket } from "ws";
import { MONSTERS, MONSTER_AFFIXES, SKILLS, depthDmgMult, depthHpMult, depthXpMult, monsterPool, GEM_TYPES, RUNE_ORDER } from "../shared/gamedata";
import { makeItem, rollEquipDrop } from "../shared/items";
import { generateMap, isWalkable, moveWithCollision } from "../shared/mapgen";
import type { C2S, Ev, S2C } from "../shared/protocol";
import { chance, mulberry32, pick, ri, uid, type RNG } from "../shared/rng";
import type { CombatStats, GameMap, GroundItem, Item, MonsterState, ProjState } from "../shared/types";

const TICK = 1 / 15;
const SNAP_EVERY = 2; // 7.5 snapshots/sec

interface SPlayer {
  ws: WebSocket;
  id: string;
  name: string;
  cls: "warlord" | "pyromancer";
  lvl: number;
  x: number; y: number; depth: number;
  anim: string; dir: number; hpFrac: number;
  dead: boolean;
  stats: CombatStats;
  lastSeen: number;
}

interface SMonster extends MonsterState {
  cd: number;              // attack cooldown
  wanderT: number;
  wx: number; wy: number;
  slowT: number;
  aggroId?: string;
  dmgMult: number;
  speedMult: number;
  asMult: number;
  leech: boolean;
  aura?: string;
  auraT: number;
  xp: number;
  mfBonus: number;
  // behavior state
  chargeState: "none" | "windup" | "dash";
  chargeT: number;
  chargeDX: number;
  chargeDY: number;
  chargeCd: number;
  healT: number;
}

interface SProj extends ProjState {
  dmg: number;
  ttl: number;
  radius: number;          // splash
  ownerId: string;
  slow?: number;
  eleKind: string;
  chains?: number;         // remaining chain-lightning jumps
  hitIds?: string[];       // monsters already struck by this chain
  chill?: number;          // seconds of movement chill applied to players hit
}

interface SSentinel {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  until: number;           // sim.time when it expires
  cd: number;
  dmg: number;
}

interface SSpin {
  pid: string;
  until: number;           // sim.time
  nextTick: number;
  dmg: number;
  radius: number;
}

interface DepthSim {
  map: GameMap;
  monsters: SMonster[];
  projs: SProj[];
  items: GroundItem[];
  usedObjects: Set<string>;
  pending: { at: number; x: number; y: number; radius: number; dmg: number; ownerId: string; ele: string }[];
  sentinels: SSentinel[];
  spins: SSpin[];
  spawned: boolean;
  time: number;
}

const defaultStats = (): CombatStats => ({
  lvl: 1, minDmg: 1, maxDmg: 3, eleDmg: { fire: 0, cold: 0, light: 0, pois: 0 },
  asPct: 0, csPct: 0, spellPct: 0, lifesteal: 0, manasteal: 0, mf: 0, goldPct: 0,
  def: 0, res: { fire: 0, cold: 0, light: 0, pois: 0 }, maxLife: 50, skillLvls: {},
});

export class Room {
  code: string;
  seed: number;
  players = new Map<WebSocket, SPlayer>();
  depths = new Map<number, DepthSim>();
  rng: RNG;
  tickCount = 0;
  events = new Map<number, Ev[]>(); // per-depth event queues
  globalEvents: Ev[] = [];

  constructor(code: string) {
    this.code = code;
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.rng = mulberry32(this.seed ^ 0xabcdef);
  }

  getDepth(d: number): DepthSim {
    let sim = this.depths.get(d);
    if (!sim) {
      sim = {
        map: generateMap(this.seed, d), monsters: [], projs: [], items: [],
        usedObjects: new Set(), pending: [], sentinels: [], spins: [], spawned: false, time: 0,
      };
      this.depths.set(d, sim);
      if (d > 0) this.spawnMonsters(sim, d);
    }
    return sim;
  }

  spawnMonsters(sim: DepthSim, depth: number) {
    if (sim.spawned) return;
    sim.spawned = true;
    const pool = monsterPool(depth);
    for (const pack of sim.map.packs) {
      const defId = pick(this.rng, pool);
      const isRare = chance(this.rng, 0.09);
      const isChamp = !isRare && chance(this.rng, 0.14);
      const count = isRare ? Math.max(3, pack.count) : pack.count;
      const affixes: string[] = [];
      if (isRare) {
        const keys = Object.keys(MONSTER_AFFIXES);
        while (affixes.length < 2) {
          const a = pick(this.rng, keys);
          if (!affixes.includes(a)) affixes.push(a);
        }
      } else if (isChamp) {
        affixes.push(pick(this.rng, Object.keys(MONSTER_AFFIXES)));
      }
      // support casters (healers/chillers) lead packs of regular monsters
      // instead of forming whole covens of themselves
      const def = MONSTERS[defId];
      const escortPool = pool.filter((p) => !MONSTERS[p].heal && !MONSTERS[p].chillOnHit);
      const escortId = (def.heal || def.chillOnHit) && escortPool.length ? pick(this.rng, escortPool) : defId;
      for (let i = 0; i < count; i++) {
        const leader = i === 0;
        this.spawnOne(sim, depth, leader ? defId : escortId,
          pack.x + (this.rng() - 0.5) * 3, pack.y + (this.rng() - 0.5) * 3,
          leader && isRare ? affixes : leader && isChamp ? affixes : [],
          leader && isRare, leader && isChamp, false);
      }
    }
    if (depth % 5 === 0) {
      const down = sim.map.objects.find((o) => o.type === "stairs_down");
      if (down) {
        this.spawnOne(sim, depth, "boss", down.x, down.y, ["mighty"], false, false, true);
        for (let i = 0; i < 4; i++) this.spawnOne(sim, depth, "skeleton", down.x + (this.rng() - 0.5) * 4, down.y + (this.rng() - 0.5) * 4, [], false, false, false);
      }
    }
  }

  spawnOne(sim: DepthSim, depth: number, defId: string, x: number, y: number, affixes: string[], rare: boolean, champ: boolean, boss: boolean) {
    const def = MONSTERS[defId];
    let hpMult = depthHpMult(depth), dmgMult = depthDmgMult(depth), speedMult = 1, asMult = 1, leech = false;
    let aura: string | undefined;
    for (const a of affixes) {
      const af = MONSTER_AFFIXES[a];
      hpMult *= af.hpMult ?? 1; dmgMult *= af.dmgMult ?? 1;
      speedMult *= af.speedMult ?? 1; asMult *= af.asMult ?? 1;
      if (af.leech) leech = true;
      if (af.aura) aura = af.aura;
    }
    if (rare) hpMult *= 2.6;
    if (champ) hpMult *= 1.7;
    const maxHp = Math.round(def.hp * hpMult);
    sim.monsters.push({
      id: uid("m"), def: defId, x, y, hp: maxHp, maxHp, affixes, rare, champ, boss,
      slow: 0, dir: 0, anim: "idle", lvl: depth,
      cd: 0, wanderT: 0, wx: x, wy: y, slowT: 0, dmgMult, speedMult, asMult, leech, aura, auraT: 0,
      xp: Math.round(def.xp * depthXpMult(depth) * (rare ? 5 : champ ? 2.5 : 1) * (boss ? 1 : 1)),
      mfBonus: rare ? 100 : champ ? 40 : boss ? 200 : 0,
      chargeState: "none", chargeT: 0, chargeDX: 0, chargeDY: 0, chargeCd: 1, healT: 1,
    });
  }

  ev(depth: number, e: Ev) {
    let q = this.events.get(depth);
    if (!q) { q = []; this.events.set(depth, q); }
    q.push(e);
  }

  // ---------------- message handling ----------------
  handle(ws: WebSocket, msg: C2S) {
    const p = this.players.get(ws);
    if (!p) return;
    switch (msg.t) {
      case "pos": {
        p.x = msg.x; p.y = msg.y; p.anim = msg.anim; p.dir = msg.dir;
        p.hpFrac = msg.hpFrac; p.lvl = msg.lvl;
        if (msg.depth !== p.depth) {
          p.depth = msg.depth;
          this.getDepth(p.depth);
        }
        break;
      }
      case "stats": p.stats = msg.stats; break;
      case "cast": this.handleCast(p, msg); break;
      case "pickup": {
        const sim = this.getDepth(p.depth);
        const idx = sim.items.findIndex((g) => g.gid === msg.gid);
        if (idx >= 0) {
          const [g] = sim.items.splice(idx, 1);
          this.send(p.ws, { t: "pickup_ok", gid: g.gid, item: g.item });
        }
        break;
      }
      case "drop": {
        const sim = this.getDepth(p.depth);
        sim.items.push({ gid: uid("g"), item: msg.item, x: msg.x, y: msg.y });
        break;
      }
      case "interact": this.handleInteract(p, msg.objId); break;
      case "chat":
        this.globalEvents.push({ k: "chat", name: p.name, msg: String(msg.msg).slice(0, 200) });
        break;
      case "dead": p.dead = true; this.ev(p.depth, { k: "fx", fx: "playerdie", x: p.x, y: p.y }); break;
      case "respawn": p.dead = false; p.depth = 0; p.hpFrac = 1; break;
    }
  }

  handleInteract(p: SPlayer, objId: string) {
    const sim = this.getDepth(p.depth);
    const obj = sim.map.objects.find((o) => o.id === objId);
    if (!obj || sim.usedObjects.has(objId)) return;
    const dist = Math.hypot(obj.x - p.x, obj.y - p.y);
    if (dist > 2.5) return;
    if (obj.type === "chest") {
      sim.usedObjects.add(objId);
      const r = mulberry32((this.seed ^ (p.depth * 7919) ^ objId.length * 31 ^ Date.now()) >>> 0);
      const n = ri(r, 2, 4);
      for (let i = 0; i < n; i++) this.dropLoot(sim, p.depth, obj.x, obj.y, p.stats.mf, 1.6, r);
      this.ev(p.depth, { k: "chest", id: objId });
    } else if (obj.type === "shrine") {
      sim.usedObjects.add(objId);
      this.send(p.ws, { t: "shrine_buff", kind: obj.shrineKind ?? "battle", dur: 60 });
      this.ev(p.depth, { k: "shrine", id: objId, kind: obj.shrineKind });
    }
  }

  handleCast(p: SPlayer, msg: Extract<C2S, { t: "cast" }>) {
    if (p.dead) return;
    const sk = SKILLS[msg.skill];
    const sim = this.getDepth(p.depth);
    const lvl = msg.skill === "basic" ? 1 : (p.stats.skillLvls[msg.skill] ?? 1);
    const r = Math.random;
    const st = p.stats;

    const weaponRoll = () => st.minDmg + Math.random() * Math.max(0, st.maxDmg - st.minDmg);
    const eleSum = st.eleDmg.fire + st.eleDmg.cold + st.eleDmg.light * 1 + st.eleDmg.pois;

    if (msg.skill === "basic") {
      // basic melee swing
      this.meleeHit(sim, p, msg.tx, msg.ty, 1.8, 0.9, weaponRoll() + eleSum, "phys", msg.targetId);
      return;
    }
    if (msg.skill === "basic_bolt") {
      // caster's default attack: a weak arcane bolt
      const dx = msg.tx - p.x, dy = msg.ty - p.y;
      const len = Math.hypot(dx, dy) || 1;
      sim.projs.push({
        id: uid("pr"), x: p.x, y: p.y, vx: (dx / len) * 13, vy: (dy / len) * 13,
        element: "phys", friendly: true, spr: "bolt",
        dmg: weaponRoll() * (1 + st.spellPct / 200) + eleSum, ttl: 1.6, radius: 0, ownerId: p.id, eleKind: "phys",
      });
      return;
    }
    if (!sk) return;

    if (sk.kind === "spin") {
      // whirlwind: periodic full-circle weapon damage that follows the player
      const dmg = weaponRoll() * (sk.wd ?? 0.6) + (sk.base ?? 0) + (sk.perLvl ?? 0) * (lvl - 1) + eleSum;
      sim.spins = sim.spins.filter((s) => s.pid !== p.id);
      sim.spins.push({ pid: p.id, until: sim.time + (sk.duration ?? 1.6), nextTick: sim.time, dmg, radius: sk.radius ?? 1.8 });
      return;
    }
    if (sk.kind === "summon") {
      // flame sentinel: stationary turret, max 2 per player
      const dmg = ((sk.base ?? 0) + (sk.perLvl ?? 0) * (lvl - 1)) * (1 + st.spellPct / 100) + st.eleDmg.fire * 0.5;
      const mine = sim.sentinels.filter((s) => s.ownerId === p.id);
      if (mine.length >= 2) {
        const oldest = mine.reduce((a, b) => (a.until < b.until ? a : b));
        sim.sentinels.splice(sim.sentinels.indexOf(oldest), 1);
      }
      const dist = Math.hypot(msg.tx - p.x, msg.ty - p.y);
      const max = 5;
      let sx2 = msg.tx, sy2 = msg.ty;
      if (dist > max) {
        sx2 = p.x + ((msg.tx - p.x) / dist) * max;
        sy2 = p.y + ((msg.ty - p.y) / dist) * max;
      }
      sim.sentinels.push({ id: uid("sn"), ownerId: p.id, x: sx2, y: sy2, until: sim.time + (sk.duration ?? 18), cd: 0, dmg });
      this.ev(p.depth, { k: "fx", fx: "summon", x: sx2, y: sy2 });
      return;
    }
    if (sk.kind === "melee") {
      const dmg = weaponRoll() * (sk.wd ?? 1) + (sk.base ?? 0) + (sk.perLvl ?? 0) * (lvl - 1) + eleSum;
      const radius = sk.radius ?? 1.9;
      this.meleeHit(sim, p, msg.tx, msg.ty, radius, sk.id === "cleave" ? 2.4 : 0.9, dmg, sk.element ?? "phys", msg.targetId);
    } else if (sk.kind === "proj") {
      const eleBonus =
        sk.element === "light" ? st.eleDmg.light :
        sk.element === "cold" ? st.eleDmg.cold : st.eleDmg.fire;
      const dmg = ((sk.base ?? 0) + (sk.perLvl ?? 0) * (lvl - 1)) * (1 + st.spellPct / 100) + eleBonus;
      const dx = msg.tx - p.x, dy = msg.ty - p.y;
      const len = Math.hypot(dx, dy) || 1;
      sim.projs.push({
        id: uid("pr"), x: p.x, y: p.y, vx: (dx / len) * (sk.projSpeed ?? 12), vy: (dy / len) * (sk.projSpeed ?? 12),
        element: sk.element ?? "fire", friendly: true, spr: sk.id,
        dmg, ttl: 2.2, radius: sk.radius ?? 0, ownerId: p.id, eleKind: sk.element ?? "fire",
        chains: sk.chain ? 3 + Math.floor(lvl / 5) : 0, hitIds: sk.chain ? [] : undefined,
      });
    } else if (sk.kind === "nova") {
      const eleBonus =
        sk.element === "fire" ? st.eleDmg.fire :
        sk.element === "cold" ? st.eleDmg.cold :
        sk.element === "light" ? st.eleDmg.light : 0;
      const dmg = sk.wd
        ? weaponRoll() * sk.wd + (sk.base ?? 0) + (sk.perLvl ?? 0) * (lvl - 1) + eleSum
        : ((sk.base ?? 0) + (sk.perLvl ?? 0) * (lvl - 1)) * (1 + st.spellPct / 100) + eleBonus;
      const radius = (sk.radius ?? 3) + lvl * 0.08;
      for (const m of sim.monsters) {
        if (m.hp <= 0) continue;
        if (Math.hypot(m.x - p.x, m.y - p.y) <= radius) {
          if (sk.slow) { m.slow = sk.slow; m.slowT = 2.5 + lvl * 0.15; }
          this.damageMonster(sim, p, m, dmg, sk.element ?? "cold");
        }
      }
      this.ev(p.depth, { k: "fx", fx: "nova", x: p.x, y: p.y, r: radius, ele: sk.element });
    } else if (sk.kind === "ground") {
      const dmg = sk.wd
        ? weaponRoll() * sk.wd + (sk.base ?? 0) + (sk.perLvl ?? 0) * (lvl - 1) + eleSum
        : ((sk.base ?? 0) + (sk.perLvl ?? 0) * (lvl - 1)) * (1 + st.spellPct / 100) + st.eleDmg.fire;
      const delay = sk.id === "meteor" ? 0.9 : 0;
      sim.pending.push({ at: sim.time + delay, x: msg.tx, y: msg.ty, radius: sk.radius ?? 2.5, dmg, ownerId: p.id, ele: sk.element ?? "phys" });
      this.ev(p.depth, { k: "fx", fx: sk.id, x: msg.tx, y: msg.ty, r: sk.radius, delay });
    }
    // buffs/blink are client-side (they flow back through stats/pos sync)
  }

  meleeHit(sim: DepthSim, p: SPlayer, tx: number, ty: number, range: number, arc: number, dmg: number, ele: string, targetId?: string) {
    const ang = Math.atan2(ty - p.y, tx - p.x);
    let hitAny = false;
    // the clicked monster gets first claim on a single-target swing
    let list = sim.monsters;
    if (targetId) {
      const t = sim.monsters.find((m) => m.id === targetId && m.hp > 0);
      if (t) list = [t, ...sim.monsters.filter((m) => m !== t)];
    }
    for (const m of list) {
      if (m.hp <= 0) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > range + MONSTERS[m.def].size) continue;
      const mAng = Math.atan2(m.y - p.y, m.x - p.x);
      let diff = Math.abs(mAng - ang);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff <= arc / 2 || m.id === targetId || d < 1.0) {
        this.damageMonster(sim, p, m, dmg * (0.9 + Math.random() * 0.2), ele);
        hitAny = true;
        if (arc < 1.5) break; // single-target skills stop at first hit
      }
    }
    if (hitAny && p.stats.lifesteal > 0) {
      this.send(p.ws, { t: "ev", ev: [{ k: "fx", fx: "leech", amt: Math.round(dmg * p.stats.lifesteal / 100) }] } as S2C);
    }
  }

  damageMonster(sim: DepthSim, p: SPlayer, m: SMonster, dmg: number, ele: string) {
    const final = Math.max(1, Math.round(dmg));
    m.hp -= final;
    m.aggroId = p.id;
    this.ev(p.depth, { k: "dmg", id: m.id, amt: final, ele });
    if (m.hp <= 0) {
      m.hp = 0;
      this.ev(p.depth, { k: "die", id: m.id, xp: m.xp, x: m.x, y: m.y, boss: m.boss });
      // splitters burst into spawn
      const def = MONSTERS[m.def];
      if (def.splitInto) {
        for (let i = 0; i < def.splitInto.count; i++) {
          this.spawnOne(sim, Math.max(1, m.lvl), def.splitInto.def,
            m.x + (Math.random() - 0.5) * 1.2, m.y + (Math.random() - 0.5) * 1.2, [], false, false, false);
          const sp = sim.monsters[sim.monsters.length - 1];
          sp.aggroId = p.id;
        }
        this.ev(p.depth, { k: "fx", fx: "split", x: m.x, y: m.y });
      }
      const r = mulberry32((Math.random() * 0xffffffff) >>> 0);
      const drops = m.boss ? 4 : m.rare ? ri(r, 2, 3) : m.champ ? ri(r, 1, 2) : 1;
      const dropChance = m.boss || m.rare || m.champ ? 1 : 0.62;
      for (let i = 0; i < drops; i++) {
        if (chance(r, dropChance)) {
          this.dropLoot(sim, p.depth, m.x, m.y, p.stats.mf + m.mfBonus, m.boss ? 2.2 : 1, r);
        }
      }
      if (m.boss && chance(r, 0.9)) {
        sim.items.push({ gid: uid("g"), item: makeItem("soulember"), x: m.x + (r() - 0.5), y: m.y + (r() - 0.5) });
      }
    }
  }

  dropLoot(sim: DepthSim, depth: number, x: number, y: number, mf: number, boost: number, r: RNG) {
    const jx = x + (r() - 0.5) * 2, jy = y + (r() - 0.5) * 2;
    const roll = r();
    let item: Item | null = null;
    if (roll < 0.26) {
      item = makeItem("gold", "normal", ri(r, 5, 20) * depth);
    } else if (roll < 0.44) {
      const grade = depth >= 12 ? ri(r, 1, 2) : depth >= 6 ? ri(r, 0, 1) : 0;
      const tier = Math.min(3, 1 + Math.floor(depth / 6) + (chance(r, 0.2) ? 1 : 0));
      item = makeItem((r() < 0.62 ? "hp" : "mp") + Math.max(1, Math.min(3, tier)), "normal", 1);
      if (grade > 3) item = null;
    } else if (roll < 0.52) {
      const t = pick(r, [...GEM_TYPES]);
      const g = depth >= 10 && chance(r, 0.25) ? 2 : depth >= 5 && chance(r, 0.4) ? 1 : 0;
      item = makeItem(`${t}_${g}`);
    } else if (roll < 0.585) {
      const maxRune = Math.min(RUNE_ORDER.length - 1, Math.floor(depth / 2.5) + 1);
      item = makeItem(`rune_${RUNE_ORDER[ri(r, 0, maxRune)]}`);
    } else if (roll < 0.62) {
      item = makeItem("dust", "normal", ri(r, 1, 2));
    } else {
      item = rollEquipDrop(r, Math.max(1, depth + ri(r, -1, 2)), mf, boost);
    }
    if (item) {
      const g: GroundItem = { gid: uid("g"), item, x: jx, y: jy };
      sim.items.push(g);
      this.ev(depth, { k: "drop", gid: g.gid, x: jx, y: jy, rarity: item.rarity, base: item.base });
    }
  }

  // ---------------- simulation ----------------
  tick() {
    this.tickCount++;
    const depthsWithPlayers = new Set<number>();
    for (const p of this.players.values()) depthsWithPlayers.add(p.depth);

    for (const d of depthsWithPlayers) {
      if (d === 0) continue;
      const sim = this.getDepth(d);
      sim.time += TICK;
      this.simDepth(sim, d);
    }

    if (this.tickCount % SNAP_EVERY === 0) this.broadcast();
  }

  simDepth(sim: DepthSim, depth: number) {
    const players = [...this.players.values()].filter((p) => p.depth === depth && !p.dead);

    // pending ground AoEs (meteor/slam)
    for (let i = sim.pending.length - 1; i >= 0; i--) {
      const pe = sim.pending[i];
      if (sim.time >= pe.at) {
        sim.pending.splice(i, 1);
        const owner = [...this.players.values()].find((p) => p.id === pe.ownerId);
        if (!owner) continue;
        for (const m of sim.monsters) {
          if (m.hp <= 0) continue;
          if (Math.hypot(m.x - pe.x, m.y - pe.y) <= pe.radius) {
            this.damageMonster(sim, owner, m, pe.dmg * (0.9 + Math.random() * 0.2), pe.ele);
          }
        }
        this.ev(depth, { k: "fx", fx: "boom", x: pe.x, y: pe.y, r: pe.radius, ele: pe.ele });
      }
    }

    // whirlwind spins follow their player
    for (let i = sim.spins.length - 1; i >= 0; i--) {
      const sp = sim.spins[i];
      if (sim.time >= sp.until) { sim.spins.splice(i, 1); continue; }
      if (sim.time >= sp.nextTick) {
        sp.nextTick = sim.time + 0.25;
        const owner = players.find((p) => p.id === sp.pid);
        if (!owner) { sim.spins.splice(i, 1); continue; }
        for (const m of sim.monsters) {
          if (m.hp <= 0) continue;
          if (Math.hypot(m.x - owner.x, m.y - owner.y) <= sp.radius + MONSTERS[m.def].size) {
            this.damageMonster(sim, owner, m, sp.dmg * (0.9 + Math.random() * 0.2), "phys");
          }
        }
      }
    }

    // flame sentinels
    for (let i = sim.sentinels.length - 1; i >= 0; i--) {
      const sn = sim.sentinels[i];
      if (sim.time >= sn.until) { sim.sentinels.splice(i, 1); continue; }
      sn.cd -= TICK;
      if (sn.cd <= 0) {
        let best: SMonster | null = null, bd = 8;
        for (const m of sim.monsters) {
          if (m.hp <= 0) continue;
          const d = Math.hypot(m.x - sn.x, m.y - sn.y);
          if (d < bd) { bd = d; best = m; }
        }
        if (best) {
          sn.cd = 0.9;
          const dx = best.x - sn.x, dy = best.y - sn.y;
          const len = Math.hypot(dx, dy) || 1;
          sim.projs.push({
            id: uid("pr"), x: sn.x, y: sn.y, vx: (dx / len) * 11, vy: (dy / len) * 11,
            element: "fire", friendly: true, spr: "firebolt",
            dmg: sn.dmg, ttl: 1.6, radius: 0, ownerId: sn.ownerId, eleKind: "fire",
          });
        }
      }
    }

    // projectiles
    for (let i = sim.projs.length - 1; i >= 0; i--) {
      const pr = sim.projs[i];
      pr.x += pr.vx * TICK; pr.y += pr.vy * TICK;
      pr.ttl -= TICK;
      let dead = pr.ttl <= 0 || !isWalkable(sim.map, pr.x, pr.y);
      if (!dead && pr.friendly) {
        for (const m of sim.monsters) {
          if (m.hp <= 0) continue;
          if (pr.hitIds?.includes(m.id)) continue;
          if (Math.hypot(m.x - pr.x, m.y - pr.y) < MONSTERS[m.def].size + 0.25) {
            const owner = [...this.players.values()].find((p) => p.id === pr.ownerId);
            if (owner) {
              this.damageMonster(sim, owner, m, pr.dmg, pr.eleKind);
              if (pr.radius > 0) {
                for (const m2 of sim.monsters) {
                  if (m2 !== m && m2.hp > 0 && Math.hypot(m2.x - pr.x, m2.y - pr.y) <= pr.radius) {
                    this.damageMonster(sim, owner, m2, pr.dmg * 0.6, pr.eleKind);
                  }
                }
                this.ev(depth, { k: "fx", fx: "boom", x: pr.x, y: pr.y, r: pr.radius, ele: pr.eleKind });
              }
            }
            // chain lightning leaps to the next victim
            if ((pr.chains ?? 0) > 0 && pr.hitIds) {
              pr.hitIds.push(m.id);
              let next: SMonster | null = null, nd = 4.5;
              for (const m2 of sim.monsters) {
                if (m2.hp <= 0 || pr.hitIds.includes(m2.id)) continue;
                const d = Math.hypot(m2.x - pr.x, m2.y - pr.y);
                if (d < nd) { nd = d; next = m2; }
              }
              if (next) {
                const dx = next.x - pr.x, dy = next.y - pr.y;
                const len = Math.hypot(dx, dy) || 1;
                const speed = Math.hypot(pr.vx, pr.vy) || 14;
                pr.vx = (dx / len) * speed;
                pr.vy = (dy / len) * speed;
                pr.chains = (pr.chains ?? 1) - 1;
                pr.dmg *= 0.8;
                pr.ttl = 1.2;
                dead = false;
                break;
              }
            }
            dead = true;
            break;
          }
        }
      } else if (!dead && !pr.friendly) {
        for (const p of players) {
          if (Math.hypot(p.x - pr.x, p.y - pr.y) < 0.45) {
            this.hitPlayer(p, pr.dmg, pr.eleKind, depth, pr.chill);
            dead = true;
            break;
          }
        }
      }
      if (dead) sim.projs.splice(i, 1);
    }

    // monsters
    if (!players.length) return;
    for (const m of sim.monsters) {
      if (m.hp <= 0) continue;
      const def = MONSTERS[m.def];
      m.cd -= TICK;
      if (m.slowT > 0) { m.slowT -= TICK; if (m.slowT <= 0) m.slow = 0; }

      // nearest living player
      let target: SPlayer | null = null, bestD = 1e9;
      for (const p of players) {
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d < bestD) { bestD = d; target = p; }
      }
      if (!target) continue;

      const speed = def.speed * m.speedMult * (1 - (m.slow ?? 0));
      const inAggro = bestD < def.aggro || m.aggroId != null;

      // ---- telegraphed charge (Cinder Hound & co.) ----
      if (def.charge) {
        m.chargeCd -= TICK;
        if (m.chargeState === "windup") {
          m.chargeT -= TICK;
          m.anim = "windup";
          if (m.chargeT <= 0) {
            m.chargeState = "dash";
            m.chargeT = 1.0;
          }
          continue;
        }
        if (m.chargeState === "dash") {
          m.chargeT -= TICK;
          m.anim = "dash";
          const step = def.charge.speed * m.speedMult * TICK;
          const [nx, ny] = moveWithCollision(sim.map, m.x, m.y, m.chargeDX * step, m.chargeDY * step, def.size * 0.7);
          const blocked = Math.abs(nx - m.x) < 0.001 && Math.abs(ny - m.y) < 0.001;
          m.x = nx; m.y = ny;
          let hit = false;
          for (const p of players) {
            if (Math.hypot(p.x - m.x, p.y - m.y) < def.size + 0.5) {
              const dmg = (def.dmg[0] + Math.random() * (def.dmg[1] - def.dmg[0])) * m.dmgMult * def.charge.dmgMult;
              this.hitPlayer(p, dmg, "phys", depth);
              hit = true;
            }
          }
          if (m.chargeT <= 0 || blocked || hit) m.chargeState = "none";
          continue;
        }
        if (inAggro && bestD > 2 && bestD < 8 && m.chargeCd <= 0) {
          m.chargeState = "windup";
          m.chargeT = def.charge.windup;
          m.chargeCd = def.charge.cooldown;
          const len = bestD || 1;
          m.chargeDX = (target.x - m.x) / len;
          m.chargeDY = (target.y - m.y) / len;
          m.dir = m.chargeDX < 0 ? -1 : 1;
          m.anim = "windup";
          continue;
        }
      }

      // ---- pack healers (Bog Witch) ----
      if (def.heal && inAggro) {
        m.healT -= TICK;
        if (m.healT <= 0) {
          m.healT = 1.6;
          for (const o of sim.monsters) {
            if (o !== m && o.hp > 0 && o.hp < o.maxHp && Math.hypot(o.x - m.x, o.y - m.y) < 5) {
              o.hp = Math.min(o.maxHp, o.hp + Math.round(def.heal * depthHpMult(depth) * 0.5));
              this.ev(depth, { k: "fx", fx: "heal", id: o.id, x: o.x, y: o.y });
            }
          }
        }
      }

      if (inAggro && bestD > def.attackRange * 0.85) {
        const dx = (target.x - m.x) / bestD, dy = (target.y - m.y) / bestD;
        const keepAway = def.proj && bestD < def.attackRange * 0.55;
        const mv = keepAway ? -0.6 : 1;
        const [nx, ny] = moveWithCollision(sim.map, m.x, m.y, dx * speed * TICK * mv, dy * speed * TICK * mv, def.size * 0.7);
        m.x = nx; m.y = ny;
        m.dir = dx < 0 ? -1 : 1;
        m.anim = "walk";
      } else if (!inAggro) {
        // lazy wander
        m.wanderT -= TICK;
        if (m.wanderT <= 0) {
          m.wanderT = 2 + Math.random() * 3;
          m.wx = m.x + (Math.random() - 0.5) * 4;
          m.wy = m.y + (Math.random() - 0.5) * 4;
        }
        const d = Math.hypot(m.wx - m.x, m.wy - m.y);
        if (d > 0.3) {
          const [nx, ny] = moveWithCollision(sim.map, m.x, m.y, ((m.wx - m.x) / d) * speed * 0.4 * TICK, ((m.wy - m.y) / d) * speed * 0.4 * TICK, def.size * 0.7);
          m.x = nx; m.y = ny;
          m.anim = "walk";
        } else m.anim = "idle";
      } else {
        m.anim = "idle";
      }

      // attack
      if (inAggro && bestD <= def.attackRange + 0.15 && m.cd <= 0) {
        m.cd = 1 / (def.attackRate * m.asMult);
        m.anim = "attack";
        const dmg = (def.dmg[0] + Math.random() * (def.dmg[1] - def.dmg[0])) * m.dmgMult;
        if (def.proj) {
          const dx = target.x - m.x, dy = target.y - m.y;
          const len = Math.hypot(dx, dy) || 1;
          sim.projs.push({
            id: uid("pr"), x: m.x, y: m.y, vx: (dx / len) * def.proj.speed, vy: (dy / len) * def.proj.speed,
            element: def.proj.element, friendly: false, spr: def.proj.element === "fire" ? "firebolt" : "arrow",
            dmg, ttl: 2.5, radius: 0, ownerId: m.id, eleKind: def.proj.element, chill: def.chillOnHit,
          });
        } else {
          this.hitPlayer(target, dmg, "phys", depth);
          if (m.leech) m.hp = Math.min(m.maxHp, m.hp + dmg * 0.5);
        }
      }

      // elemental auras on rare monsters
      if (m.aura) {
        m.auraT -= TICK;
        if (m.auraT <= 0) {
          m.auraT = 1;
          for (const p of players) {
            if (Math.hypot(p.x - m.x, p.y - m.y) < 2.2) {
              this.hitPlayer(p, 2 * m.dmgMult, m.aura, depth);
            }
          }
        }
      }
    }

    // simple separation so monsters don't stack
    const alive = sim.monsters.filter((m) => m.hp > 0);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const minD = MONSTERS[a.def].size + MONSTERS[b.def].size;
        if (d > 0.001 && d < minD) {
          const push = (minD - d) / 2;
          const ux = dx / d, uy = dy / d;
          [a.x, a.y] = moveWithCollision(sim.map, a.x, a.y, -ux * push, -uy * push, 0.2);
          [b.x, b.y] = moveWithCollision(sim.map, b.x, b.y, ux * push, uy * push, 0.2);
        }
      }
    }
  }

  hitPlayer(p: SPlayer, rawDmg: number, ele: string, depth: number, chill?: number) {
    if (p.dead) return;
    let dmg = rawDmg;
    if (ele === "phys") {
      const dr = p.stats.def / (p.stats.def + 60 + 12 * depth);
      dmg *= 1 - Math.min(0.75, dr);
    } else {
      const res = (p.stats.res as any)[ele] ?? 0;
      dmg *= 1 - Math.min(75, res) / 100;
    }
    dmg = Math.max(1, Math.round(dmg));
    this.send(p.ws, { t: "ev", ev: [{ k: "phit", amt: dmg, ele, chill }] });
  }

  // ---------------- net ----------------
  send(ws: WebSocket, msg: S2C) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  broadcast() {
    const allPlayers = [...this.players.values()];
    for (const p of allPlayers) {
      const sim = this.getDepth(p.depth);
      const evs = [...(this.events.get(p.depth) ?? []), ...this.globalEvents];
      const snap: S2C = {
        t: "snap",
        depth: p.depth,
        players: allPlayers.map((q) => ({
          id: q.id, name: q.name, cls: q.cls, lvl: q.lvl, x: q.x, y: q.y,
          depth: q.depth, anim: q.anim, dir: q.dir, hp: q.hpFrac, dead: q.dead,
        })),
        monsters: sim.monsters.filter((m) => m.hp > 0).map((m) => ({
          id: m.id, def: m.def, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp,
          affixes: m.affixes, rare: m.rare, champ: m.champ, boss: m.boss,
          slow: m.slow, dir: m.dir, anim: m.anim, lvl: m.lvl,
        })),
        projs: sim.projs.map((pr) => ({
          id: pr.id, x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy,
          element: pr.element, friendly: pr.friendly, spr: pr.spr,
        })),
        items: sim.items,
        objUsed: [...sim.usedObjects],
        sentinels: sim.sentinels.map((s) => ({
          id: s.id, ownerId: s.ownerId, x: s.x, y: s.y, until: Math.max(0, s.until - sim.time),
        })),
      };
      this.send(p.ws, snap);
      if (evs.length) this.send(p.ws, { t: "ev", ev: evs });
    }
    this.events.clear();
    this.globalEvents = [];
  }

  addPlayer(ws: WebSocket, name: string, cls: "warlord" | "pyromancer", lvl: number): SPlayer {
    const p: SPlayer = {
      ws, id: uid("p"), name: name.slice(0, 16) || "Wanderer", cls, lvl,
      x: 13.5, y: 13.5, depth: 0, anim: "idle", dir: 1, hpFrac: 1,
      dead: false, stats: defaultStats(), lastSeen: Date.now(),
    };
    this.players.set(ws, p);
    this.globalEvents.push({ k: "join", name: p.name });
    return p;
  }

  removePlayer(ws: WebSocket) {
    const p = this.players.get(ws);
    if (p) {
      this.players.delete(ws);
      this.globalEvents.push({ k: "leave", name: p.name });
    }
  }
}
