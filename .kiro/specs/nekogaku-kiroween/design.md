# Design: NekoGaku, Kiroween edition

## The stitch (why this is a Frankenstein)

| Part | Technology | Talks to the others through |
| --- | --- | --- |
| Haunted cat house | TypeScript + Canvas 2D, a procedural cat rig (no sprite sheets) | `localStorage` reward queue, item words |
| Grimoire curriculum engine | SQLite (libSQL), SQL migrations, seed from open data | Next.js route handlers |
| Japanese voices | VOICEVOX neural TTS in Docker, offline batch to MP3 | `data/voice-manifest.json` → `audio` fields |
| Soundtrack | A DSP synthesizer written in TypeScript (no samples) | MP3 + loop metadata |
| Shell | Next.js 15 + React 19 | routes `/`, `/study/...` |

None of these normally live together: a pet sim, a relational curriculum database, a neural
speech engine and a hand-written synthesizer. The bridge between the cat house and the grimoire is
deliberately thin: a quiz result becomes EXP for a cat.

## Game architecture (`game/`)

```
main.ts ── HUD + input + loop
  ├─ sim/clock.ts        arcadeClock(playMs) → { day, hour, minute, phase }          (pure)
  ├─ sim/progress.ts     levelOf(exp), expToNext, clampLove, rewardForQuiz            (pure)
  ├─ sim/room.ts         ROOM bounds, walk polygon, clampToFloor                       (pure)
  ├─ sim/world.ts        cats, items, ball, feather, gym set, save/load
  ├─ sim/brain.ts        each cat's activity choice and steps
  ├─ halloween/room-art.ts   paints the living room (static layer + live layer)
  ├─ halloween/items.ts      10 Halloween items: draw, how cats use them, which costume, Japanese word
  ├─ halloween/costumes.ts   vampire, ghost, werewolf, bat, witch overlays on catShapes(pose)
  ├─ render.ts           camera, lighting by hour, draw order by y
  ├─ audio.ts            synthesized SFX (meow, purr, pop, boing, shutter) + music loop
  └─ ui.ts               dialogs: Cats, Items, Album, Gym picker, Settings
```

- Cat drawing: `drawCat(ctx, pose, look, physique(look, level, 4.2), opts)`. A pose comes from
  `sampleClip(clip, {t, phase, seed, intensity})`, blended with `lerpPose` when the clip changes,
  and faces from `emotionFace`. The gym uses the `lift` clip with `drawBarbell` as a paw prop.
- Weight is fixed at the ideal weight (there is no food stat), so a cat's build depends on level only.
- Costumes: after the body, the overlay draws at `catShapes(pose, phys)` head/neck anchors in the
  cat's local frame, so it follows sitting, walking, sleeping and lifting.

## Arcade clock

`hour = (18 + playMs / 25_000) mod 24` (25 s per in-game hour → 10 min per day).
Phases: day 6–17, dusk 17–19, night 19–24, witching 0–3, dawn 3–6. Lighting is a tint per phase
with smooth blending across the boundary hour.

## Progression

- `levelOf(exp)`: level n needs `expFor(n) = 40·(n−1)·n/2 + 20·(n−1)` total EXP; capped at 15.
- Rewards: quiz → `correct × 4 + (perfect ? 10 : 0)`; gym set → 12; play → 1 per 20 s (cap 30/day of play).
- Love: pet +0.15 (once per 4 s per cat), play +0.1, gym +0.3; clamp 0..10.
- Costumes are not unlocked or picked from a wardrobe: they come from items (R7). `ItemUse.costume`
  names the costume; `World.dressUp` sets `cat.costume` for `COSTUME_SECONDS` (45) and, for worn items,
  marks `item.worn = cat.id` so it leaves the floor. Flying costumes (bat, witch) run the `fly` act:
  swoops between random floor points at z ≈ 150, then a landing. A ghost hovers in the drawing only.

## Accounts (access codes)

- `players(id, code_hash, label)`, `sessions(token_hash, player_id)`, `house_saves(player_id, json, saved_at)`,
  `rewards(player_id, cat, exp, source)` (migration 0002). Only SHA-256 hashes of codes and tokens are stored.
- `npm run codes -- new 3 "Judges"` prints new codes once; `npm run codes -- add NEKO-…` registers a known
  code on another server. `/login` signs in (`POST /api/session`, 10 tries/minute/IP) and sets the
  httpOnly cookie `neko_session`. `middleware.js` sends cookie-less visits of `/` and `/study/*` to `/login`;
  pages and APIs verify the session against the database.

## Study → house bridge

The lesson page posts the result to `/api/progress`; the server saves the best score and queues the EXP in
`rewards` for the study buddy cat. The house fetches `/api/house` on load (save + rewards) and
`/api/house?only=rewards` on focus, applies them with a banner, and saves back (`PUT /api/house`, newest
`savedAt` wins; a local copy covers offline moments).

## Explanations and the mock exam

`makeQuestion` carries `notes[i]` for every option (what that option really means: the word behind an
English meaning, the meaning behind a word or pattern). `explain` always says why the answer is right
(meaning, note, example sentence; SSW questions use their written `why`). `buildExam(units, seed, 20)` takes
a few questions from each of 10 random units of a track; `components/Exam.jsx` runs a 10-minute clock and
reviews every answer at the end.

## Curriculum database

```sql
tracks(id TEXT PK, ord INT, title, subtitle, kind)        -- n5..n1, kaigo, food
units(id TEXT PK, track_id, ord INT, kind, title, size INT, data_json)   -- vocab|kanji|grammar|ssw
progress(player_id, unit_id, best INT, attempts INT, updated_at, PK(player_id, unit_id))
meta(key PK, value)
```

- Vocab units: 20 words (OpenJLPT order). Kanji units: 20 kanji. Grammar units: 5 patterns.
  SSW units: one topic each (terms + scenario questions).
- Quizzes are built at request time by `lib/quiz.js` from the unit with a seeded RNG
  (deterministic per unit + attempt): distractors come from the same unit/track, deduplicated.

## Voices

`scripts/build-voice.mjs` collects every Japanese string that needs audio (vocab readings, grammar
examples, SSW terms, item words), asks VOICEVOX (`/audio_query` + `/synthesis`, speaker 2,
四国めたん ノーマル), converts WAV → mono 48 kbps MP3 with ffmpeg, names the file by a hash of
(speaker, text) and writes `data/voice-manifest.json`. The seed attaches `audio` paths from it.
Rebuilding is incremental (existing files are skipped).

## UI theme (grimoire)

Near-black violet background (`#0f0a14`), parchment cards (`#e9dcc0` text on `#1d1424`), pumpkin
orange accents (`#ff8a3d`), ghost green focus (`#9dffb0`). Fonts: system serif for headings,
system sans for text. Flickering candle glow via CSS, `prefers-reduced-motion` respected.

## Testing

- Property-based tests (fast-check): clock range and monotonicity, level bounds and monotonicity,
  Love clamp, quiz invariants (one correct option, unique options, deterministic with seed),
  `clampToFloor` always returns a point inside the walk area.
- `npm run content:check`: every unit has data, no Indonesian marker words in learner text.
- `npm run game:check` (tsc) and `npm run build`.
