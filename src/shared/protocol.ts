import type { CombatStats, GroundItem, Item, MonsterState, PlayerPub, ProjState, SentinelState } from "./types";

// Client → Server
export type C2S =
  | { t: "join"; room: string; name: string; cls: "warlord" | "pyromancer"; lvl: number }
  | { t: "pos"; x: number; y: number; depth: number; anim: string; dir: number; hpFrac: number; lvl: number }
  | { t: "cast"; skill: string; x: number; y: number; tx: number; ty: number; targetId?: string }
  | { t: "stats"; stats: CombatStats }
  | { t: "pickup"; gid: string }
  | { t: "drop"; item: Item; x: number; y: number }
  | { t: "interact"; objId: string }
  | { t: "chat"; msg: string }
  | { t: "dead" }
  | { t: "respawn" };

export interface Ev {
  k: "dmg" | "die" | "drop" | "phit" | "chest" | "shrine" | "boss" | "chat" | "join" | "leave" | "fx" | "levelup";
  [key: string]: unknown;
}

// Server → Client
export type S2C =
  | { t: "joined"; room: string; id: string; seed: number }
  | { t: "err"; msg: string }
  | { t: "snap"; depth: number; players: PlayerPub[]; monsters: MonsterState[]; projs: ProjState[]; items: GroundItem[]; objUsed: string[]; sentinels: SentinelState[] }
  | { t: "ev"; ev: Ev[] }
  | { t: "pickup_ok"; gid: string; item: Item }
  | { t: "shrine_buff"; kind: string; dur: number };
