---
name: nekogaku
description: Work on NekoGaku Kiroween's haunted cat house (game/): the three cats Cecil, Kuku and Bolu, their procedural rig, the Halloween room, the ten items and the costumes they give, play, the gym, the arcade clock, and how the house takes EXP from the grimoire. Use for any change to the cats, the room, items, costumes, sounds or the house HUD.
---

# NekoGaku's haunted cat house

The house is the motivation layer of the app: study in the grimoire becomes EXP for a cat. It is one room, three cats, ten Halloween items. UI text is English, with Japanese words to learn (kana, romaji, meaning).

## How it fits together

| Part | Where | What |
| --- | --- | --- |
| Cat rig | `game/art/` | Look (coat, genes), physique by level, body mould, poses, walking frames, clips, emotions, emote marks, barbell prop |
| Simulation | `game/sim/` | `world.ts` (cats, items, ball, feather, gym, costumes, flying, save), `brain.ts` (idle choices), `clock.ts` (arcade clock), `progress.ts` (EXP, level, Love), `room.ts` (floor) |
| Halloween art | `game/halloween/` | `room-art.ts` (the parlor, sky, lighting), `items.ts` (10 items and the costume each gives), `costumes.ts` (vampire, ghost, werewolf, bat, witch overlays) |
| Rendering | `game/render.ts` | Camera, depth order, costumes on `catShapes` anchors, particles, darkness by hour |
| HUD and input | `game/main.ts` | Dialogs (Cats, Items, Gym, Album, Settings), item pop with Give to, photo, pointer input, server save and rewards |
| Host | `components/HouseHost.jsx` | Mounts the game on `/` (client only) |

Browser handle for testing: `window.nekogaku` = `{ world, renderer, audio }`.

## Style rules

- One dark ink outline on the outer silhouette; flat fills; no gradients on the cats.
- Faces agree with the body; every cat keeps its own coat and face in every pose and costume.
- Pictures are whole: nothing cut off by the room's edge.
- Costumes are overlays on the rig's anchors (head, neck, body, mouth), never a different cat.

## Checks

```sh
npm run game:check     # TypeScript for game/
npm test               # property tests (clock, EXP/Love, floor, quiz)
npm run content:check
```

Before calling a visual change done, run the dev server, sign in with a test code (`npm run codes -- new 1 test`), and look at screenshots at desktop and phone width.
