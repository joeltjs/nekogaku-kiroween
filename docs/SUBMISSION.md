# Devpost submission text

Copy these into the Devpost form. Everything here is in English, as the rules require.

## Project name

NekoGaku: Kiroween edition

## Tagline

Study Japanese in a haunted grimoire; your cats grow up in the house next door.

## Category

Frankenstein.

## Description

For the Frankenstein category, NekoGaku stitches together four parts that rarely share an app: a hand-built 2D pet simulation, an offline SQLite curriculum engine, a neural Japanese voice, and a synthesizer that composes its own soundtrack.

The house is one Halloween parlor where three cats live: Cecil, Kuku and Bolu. They are drawn entirely in code by a procedural rig, with poses, gaits and emotions. You pet them, carry them, throw a ball, wave a feather, and send one to lift a barbell. Ten Halloween items each teach a Japanese word with its voice. Five of them dress a cat up: the coffin makes a vampire, the ghost sheet a floating ghost, the full-moon lamp a howling werewolf, the bat wings a cat that flies around the room, the broom a flying witch. Time is arcade time: a day lasts ten minutes, from dusk to the witching hour.

The grimoire holds JLPT N5 to N1 (the full OpenJLPT vocabulary, kanji and grammar lists) and two Specified Skilled Worker tracks, nursing care and food manufacturing, written in English with the Japanese terms and scenario questions. Each unit is study cards with VOICEVOX audio, then a quiz where every answer is explained, including what a wrong pick really means. Each track has a timed mock exam with a full review. Quiz results become EXP for your study buddy cat, and the cat grows from kitten to senior.

There is no AI at runtime and no external service. The curriculum is seeded from open data into SQLite with SQL migrations, the voices are rendered offline in a batch from a VOICEVOX container, and the music is composed by a DSP script without samples. The whole repository was built with Kiro CLI from a spec, steering files, hooks and skills.

## How to test (private field for judges)

1. Open the app URL and enter one of the access codes issued separately (format `NEKO-XXXX-XXXX`).
2. In the house: tap a cat to pet it, hold to carry it, try Ball and Feather. Open **Items**, place the coffin, tap it, and choose **Give to** a cat. Do the same with the bat wings or the broom to see a cat fly.
3. Press **Gym** and pick a cat.
4. Press **Grimoire**, open JLPT N5, study Vocabulary 1 and take the quiz. Then open **Start the simulation** for the mock exam.
5. Return to the house: the study buddy cat shows the EXP banner.

Each code has its own house and progress, so judges do not overwrite each other.

## Built with

Kiro CLI, TypeScript, Canvas 2D, Next.js, React, SQLite (libSQL), VOICEVOX, Docker, ffmpeg, Web Audio, fast-check.

## How Kiro was used

See `docs/KIRO.md` in the repository. Short version for the form:

- **Spec-driven development**: `.kiro/specs/nekogaku-kiroween/` with EARS requirements (R1 to R14), a design document and a task list. Two mid-build direction changes (costumes from items instead of unlocks; access codes instead of anonymous cookies) were made in the spec first, then in code.
- **Steering**: six files, always-on product rules plus file-matched art, content and antislop rules.
- **Hooks**: type-check the game on save, check the curriculum on data changes, run property tests at the end of each turn, and block writes to the earlier project.
- **Skills**: a project skill for the cat house, and the antislop skills (MIT) as the filter for UI, copy, accessibility, mobile layout and code comments.
- **Sub-agents**: a context-gatherer mapped the earlier, much larger project to decide what to port.
- **Property-based testing**: fast-check properties for the arcade clock, the EXP and Love bounds, the floor clamp, the quiz invariants on random and real units, and access codes.

## Earlier code (declaration)

The procedural cat rig in `game/art/` was brought in from an earlier, private NekoGaku project. Everything else was written in this repository during the submission period. The README has the full list.

## Bonus prizes to consider

- **Bonus Blog Prize**: write a post during the submission period that says it was written for Kiroween 2026, then add its URL.
- **Social Blitz**: post with `#KiroweenHackathon26` at the very beginning, about your favourite part of Kiro and how it changed your workflow; add the URL.
- **Best Demo**: no form entry; it goes to the best Presentation score among the top 10%.
- Not eligible unless you qualify: Startup (needs a startup), Student (needs student proof), Ghost of Kiroween Past (needs a Kiroween 2025 registration), Kiro Crew App (needs a Crew app).

## Demo video plan (under 3 minutes, YouTube, public)

1. 0:00 to 0:20: the problem. Studying JLPT or SSW Japanese alone is dry; streaks break.
2. 0:20 to 1:10: the house. Pet, carry, ball, feather, place the coffin and give it to Kuku (vampire), wings to Cecil (flies), the gym.
3. 1:10 to 2:00: the grimoire. A unit with audio, a wrong answer and its explanation, the mock exam review.
4. 2:00 to 2:30: back to the house, the EXP banner, the cat a level older.
5. 2:30 to 2:55: Kiro: the spec, a hook firing, the property tests passing.

Use only the app's own music and sounds in the video.
