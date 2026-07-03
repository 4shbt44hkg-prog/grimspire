# GRIMSPIRE

An original action RPG in the spirit of **Diablo II: Lord of Destruction**, with the crafting
depth of the **Eastern Sun** mod baked in. Runs in the browser, built for playing with friends.

![genre](https://img.shields.io/badge/genre-ARPG-8a0303) ![players](https://img.shields.io/badge/co--op-up%20to%206-c8a856)

## What's in the game

- **Full 3D overworld** — a Three.js-rendered world with a classic D2-style isometric
  camera, real shadow-mapped lighting, mouse-wheel zoom, and low-poly monsters, bosses
  and townsfolk (still 100% code-generated, no assets). Trees between the camera and
  your hero politely shrink out of the way.
- **Four wild biomes** — The Blighted Moor, Emberfall Wastes, The Frozen Reach and
  Gloomwood rotate as you push deeper. Each zone has a winding trail, a **waypoint**
  back to town, and a swirling **Rift Portal** at its end leading to the next zone.
  Every 5th zone belongs to the Gravelord.
- **Town Portal** — every hero's innate ability (T or the HUD slot): open passage to
  town from anywhere, and step back to the zone you left.
- **Two classes** — Warlord (Bash, Sweep, Cleave, Seismic Slam, Battle Cry,
  **Whirlwind**) and Pyromancer (Firebolt, Fire Nova, Frost Nova, Fireball, Teleport,
  **Chain Lightning**, Meteor, **Flame Sentinel** turrets) — plus passives, stat
  points and skill points per level.
- **D2-style loot** — normal / magic / rare / crafted / **unique** (gold) / **set** (green)
  items with prefix+suffix affix pools, magic find, gold find, grid inventory, stash,
  potion belt, and colored ground labels.
- **Sockets & runewords** — 5 gem types in 3 grades, 8 runes, and named runewords
  (e.g. **Ash + Cinder** in a weapon forges *Kindle*).
- **The Umbral Cube** — Eastern Sun-style transmutation with a built-in recipe book:
  - gem/rune fusion (3 gems → next grade, 2 runes → next rank)
  - disenchanting items into **Arcane Dust / Glowing Shards / Soul Embers**
  - rerolling magic and rare items
  - **Blood / Storm / Frost crafts** (crafted-orange items)
  - **Tier Ascension** — upgrade an item's base to the next tier *keeping all its mods*
  - **Relic Gamble** — 2 Soul Embers + a Shard → a random unique
- **Endless depths** — procedurally generated dungeons that scale forever, champion and
  rare monster packs with affixes, chests, shrines, and **The Gravelord** boss every 5 depths.
- **Town economy** — **Marla the Merchant** sells potions and crafting reagents and buys
  anything you drag home, and **Zeke the Gambler** takes your gold for unidentified rolls
  on any equipment slot — with real odds of uniques and set pieces.
- **Plays on phones too** — touch devices automatically get a virtual joystick, skill
  and potion buttons, pinch zoom, long-press item tooltips, and a phone-sized UI.
  Phone and desktop players share the same co-op games.
- **Online co-op** — up to 6 players per game via a 4-letter room code, with party frames,
  chat, shared monsters and shared loot drops.
- Characters save automatically in your browser (per hero, per machine).

## Running it locally

Requires [Node.js](https://nodejs.org) 20+.

```bash
npm install
npm run dev
```

Open http://localhost:5173, create a hero, and click **New Game**.

## Playing with friends

The game is client + one small server (world simulation, co-op rooms). Friends just need
the URL — no installs.

### Same network (LAN)

Run `npm run dev`, then have friends open `http://<your-LAN-IP>:5173`
(add `--host` to the vite script or use the production build below).

### Over the internet (recommended: one free-tier deploy)

The production build is a **single Node process** that serves the game and hosts the
websocket — perfect for Render / Railway / Fly.io free tiers:

```bash
npm run build   # outputs dist/
npm start       # serves dist/ + game server on $PORT (default 8080)
```

For example on **Render**: create a Web Service from this repo with
build command `npm install && npm run build` and start command `npm start`.
You'll get a URL like `https://grimspire.onrender.com` — send it to your friends,
start a New Game, and share the 4-letter code shown at the top of the screen.

## Controls

| Input | Action |
|---|---|
| Left click | Move / attack / pick up / interact |
| Shift + left click (hold) | Stand your ground and attack in place |
| Right click | Cast selected skill |
| Q W E R | Cast skill 1–4 (also selects it) |
| Mouse wheel | Zoom the camera |
| 1 2 3 4 | Drink belt potion |
| I / S / C / B | Inventory / Skills / Character / Umbral Cube |
| T | Town Portal (innate ability — to town and back) |
| Enter | Chat |
| Right-click an item | Equip it / send potion to belt (sells it while the merchant is open) |
| Click with gem/rune held | Socket it into the item under the cursor |
| Shift-click an item | Quick-move between inventory and open stash/cube |

**On touch devices:** left thumb = floating joystick, right thumb = attack + skill
buttons, side buttons for potions and Town Portal, pinch to zoom, tap items to
pick up/place and long-press to inspect them.

## Tips from the depths

- **Nothing is vendor trash.** Disenchant blues and yellows in the cube for reagents,
  or sell them to Marla — then hand the gold to Zeke and pray for gold-text.
- Normal (white) items with sockets are runeword bases. A shard adds sockets to a
  plain one.
- Rare/champion monsters (blue/gold glow) and chests drop much better loot, and the
  Gravelord (every 5th depth) is a piñata.
- Deeper = harder = better. Depth is the difficulty ladder; magic find gear makes it rain.

## Project layout

```
src/shared/   game data & logic used by BOTH client and server
              (items, affixes, uniques, sets, runewords, cube recipes,
               skills, monsters, seeded map generation)
src/client/   canvas renderer, pixel sprites, UI panels, input, sound, netcode
src/server/   websocket co-op server: rooms, monster AI, combat, loot rolls
```

All art and audio are generated in code — no external assets, nothing copyrighted.
