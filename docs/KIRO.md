# How Kiro was used

NekoGaku Kiroween was built in **Kiro CLI**, in one long terminal session with a spec, steering, hooks, skills and sub-agents. This file is the write-up for the judges. Everything it mentions is in the `/.kiro` folder of this repository.

## Which Kiro

Kiro CLI only. The work was terminal-shaped: running a Docker voice engine, batching about 7,300 clips through ffmpeg, seeding SQLite, driving a headless browser for screenshots. The CLI ran all of that next to the code.

## Spec-driven development

`.kiro/specs/nekogaku-kiroween/` holds three files.

- **requirements.md**: 14 groups of requirements in EARS form ("WHEN the player taps a cat, the cat SHALL…"). Each one has an ID (R7.2, R10.5) that the code, the tests and the commit-sized tasks point back to.
- **design.md**: the architecture of each stitched part, the formulas (arcade clock, EXP curve, quiz rules), the database schema, the account model.
- **tasks.md**: the build order, each task tagged with the requirements it closes.

The spec paid off when the direction changed mid-build. Two examples:

1. Costumes started as a wardrobe you unlock with levels. The direction changed to "cats look like themselves; a Halloween item turns them into a vampire, a ghost, a werewolf, a flying bat or a flying witch". Rewriting R4 and R7 first made the code change obvious: items gained a `costume` field, the world gained `dressUp`, `undress` and a `fly` act, and the unlock code was deleted. Nothing else had to move.
2. The app started with anonymous cookies. The direction changed to access codes for the judges. R12a was written first (hashed codes, hashed sessions, rate limit, saves per code), then migration 0002, then the routes. The house's save moved from `localStorage` to the server without touching the simulation.

Compared with vibe coding, the spec made each change a diff to a document first. When a screenshot looked wrong, the question was always "which requirement does this break", which kept fixes small.

## Steering

`.kiro/steering/` has six files:

| File | Inclusion | What it does |
| --- | --- | --- |
| `product.md` | always | The product in one page and seven hard rules (English only, EXP and Love only, arcade time, one season, self-contained, original assets only, scary but readable) |
| `tech.md` | always | Stack, where pure logic lives so it can be property-tested, SQL and secret rules |
| `structure.md` | always | Repository map |
| `art-and-content.md` | fileMatch `game/**`, `data/**`, `components/**` | The cats' drawing rules, the room palette, lesson rules (one correct option, readings always shown) |
| `antislop.md` | fileMatch UI, docs | Which antislop skill filters which kind of work |
| `nekogaku-skill-overrides.md` | always | Repo rules that win over anything older: three cats, no personal data, never push on the author's behalf |

The strategy that mattered most: **hard rules as a short numbered list in an always-on file**. The earlier project this build borrows from has hunger, energy, hygiene, coins, weather and seasons. Keeping "two cat stats only", "arcade time" and "only original assets" in context at every turn made it easy to port the rig without dragging those systems along.

## Hooks

`.kiro/hooks/` has four hooks:

| Hook | Trigger | What it automates |
| --- | --- | --- |
| `game-typecheck` | PostFileSave on `game/**/*.ts` | `tsc -p game` after every save of the game, so a broken rig type shows up at once |
| `content-check` | PostFileSave on `data/**`, `lib/content-build.js`, `lib/quiz.js` | Validates all 563 units, every SSW question (4 different options, one answer, an explanation) and scans learner-facing files for leftover Indonesian or third-party asset paths |
| `tests-on-stop` | Stop | Runs the property tests at the end of every agent turn |
| `guard-source-project` | PreToolUse | Blocks any tool call that would write into the earlier project in the sibling folder, while still allowing reads and copies out of it |

The guard hook earned its keep in an unplanned way: its first version blocked a harmless command that only *mentioned* the folder in a heredoc. That false positive was fixed by matching write *targets* (redirects, `rm`, `mv`, the destination of `cp`, `sed -i`, file-tool paths) and testing the script against eight cases before turning it back on.

## Skills

`.kiro/skills/` holds two sets:

- **nekogaku**: a project skill that maps the house's code (rig, simulation, Halloween art, HUD) and its style rules, so any change to the cats starts from the right file.
- **antislop** (MIT, six skills): the filter for UI, copy and comments, used in "during" mode. It drove concrete changes: em dashes and decorative arrows removed from buttons, a sparkle glyph replaced, a low-contrast "R.I.P." decoration dropped, empty/loading/error states added to the grimoire, every text colour pair checked with its WCAG contrast script (all 16 pairs pass AA), and a `DESIGN.md` written so the filter had a direction to sit on. `antislop-code` cleaned the comments of the ported rig; a TypeScript transpile with comments stripped proved the code itself stayed byte-identical.

## Sub-agents

A **context-gatherer** sub-agent mapped an earlier, much larger project (about 32,000 lines of game code, a 3 MB curriculum, AI and voice pipelines) into an inventory of what to port and what to leave. That one report decided the scope: port the cat rig, rebuild everything else small.

## Property-based testing

`tests/` uses fast-check. Properties that are written as requirements:

- R9.3: the arcade hour is always in [0, 24), and later play never shows an earlier moment.
- R9.1: one in-game day is exactly 10 real minutes; 6 hours after the start is the witching hour.
- R6.2 / R6.4: the level stays in 1..15 and never drops when EXP grows; Love stays in 0..10 for any input, NaN included.
- R1.3 / R2.3: wherever a cat is dropped, it lands on the floor, and clamping is idempotent.
- R10.5: for random units, every quiz has 2 to 4 options, no duplicates, exactly one answer, and the same seed gives the same quiz. A second test runs the builder over the whole real curriculum and requires an explanation on every question.
- Access codes: generated codes survive normalisation, and sloppy typing (lower case, no dashes) still signs in.

The real-curriculum property is the one that guards the content: if a future data change leaves a unit with too few distinct meanings for a quiz, or a question without an explanation, the test names the unit.

## MCP and powers

Not used. The project needed no external service at build time beyond Docker and ffmpeg, which the CLI runs directly.
