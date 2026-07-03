import type { S2C } from "../shared/protocol";
import { applySnapshot, G, handleEvents, markStatsDirty, receivePickup, syncStats } from "./game";
import { toast } from "./ui";

let ws: WebSocket | null = null;

export function connect(name: string, cls: "warlord" | "pyromancer", room: string, lvl: number): Promise<{ room: string; id: string; seed: number }> {
  return new Promise((resolve, reject) => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    let joined = false;

    ws.onopen = () => {
      ws!.send(JSON.stringify({ t: "join", room, name, cls, lvl }));
    };

    ws.onmessage = (e) => {
      let msg: S2C;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (msg.t) {
        case "joined":
          joined = true;
          G.connected = true;
          G.send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
          resolve({ room: msg.room, id: msg.id, seed: msg.seed });
          break;
        case "err":
          if (!joined) reject(new Error(msg.msg));
          else toast(msg.msg, "#d05050");
          break;
        case "snap":
          (window as unknown as { lastSnap: unknown }).lastSnap = msg;
          applySnapshot(msg);
          break;
        case "ev":
          handleEvents(msg.ev);
          break;
        case "pickup_ok":
          receivePickup(msg.item);
          break;
        case "shrine_buff": {
          const kinds: Record<string, { name: string; mods: { stat: string; v: number }[] }> = {
            battle: { name: "Battle Shrine", mods: [{ stat: "dmg_pct", v: 45 }] },
            arcane: { name: "Arcane Shrine", mods: [{ stat: "spell_pct", v: 35 }, { stat: "cs_pct", v: 20 }] },
            swift: { name: "Shrine of Haste", mods: [{ stat: "move_pct", v: 25 }, { stat: "as_pct", v: 20 }] },
            gilded: { name: "Gilded Shrine", mods: [{ stat: "mf", v: 50 }, { stat: "gold_pct", v: 80 }] },
          };
          const k = kinds[msg.kind] ?? kinds.battle;
          G.buffs = G.buffs.filter((b) => b.id !== "shrine");
          G.buffs.push({ id: "shrine", name: k.name, mods: k.mods as never, until: G.now + msg.dur });
          markStatsDirty();
          syncStats(true);
          toast(`${k.name} empowers you!`, "#5ac8d8");
          break;
        }
      }
    };

    ws.onclose = () => {
      if (!joined) {
        reject(new Error("Could not reach the game server."));
      } else if (G.connected) {
        G.connected = false;
        toast("Disconnected from server.", "#d05050");
        setTimeout(() => location.reload(), 2500);
      }
    };
    ws.onerror = () => { /* onclose handles it */ };
  });
}
