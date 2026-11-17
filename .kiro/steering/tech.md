---
inclusion: always
---

# Tech stack and conventions

- **Next.js 15 (App Router) + React 19**, plain JSX for pages and components. Node 22+.
- **Game: TypeScript + Canvas 2D**, no game engine, under `game/`. Type-checked by
  `npm run game:check` (its own `game/tsconfig.json`). The page mounts it with a dynamic import
  from `components/HouseHost.jsx`.
- **Curriculum: SQLite through `@libsql/client`**. Schema in `db/migrations/*.sql`, applied by
  `scripts/migrate.mjs`. Content is built from `data/` by `scripts/seed.mjs`. The database file
  defaults to `.data/nekogaku.sqlite` (`DATABASE_URL` overrides it). Pages read through
  `lib/curriculum.js`; nothing reads `data/` at request time.
- **Progress** is stored in SQLite per anonymous player (cookie `neko_player`, random UUID).
  The house save lives in `localStorage` (`nekogaku-house-v1`).
- **Voices: VOICEVOX Engine**, run locally (Docker image `voicevox/voicevox_engine:cpu-latest`)
  only while `npm run voice:build` generates `public/audio/voice/*.mp3`. The app never calls the
  engine at runtime. Credit line: `VOICEVOX:四国めたん`.
- **Music: synthesized** by `scripts/make-music.ts` (no samples). SFX are synthesized in the
  browser with Web Audio (`game/audio.ts`).

## Code rules

- Pure logic (clock, EXP/Love, quiz building, walk geometry) lives in small modules without DOM
  access so it can be property-tested with `fast-check` (`tests/`).
- Parameterized SQL only (`db.execute({ sql, args })`). Validate every API input.
- No secrets in code. There are none to need: the app has no external services.
- Keep files focused; prefer a new small module over growing a big one.
