---
inclusion: always
---

# Repository map

```
app/                 Next.js routes (/, /study, /study/[track], /study/[track]/[unit], /credits, api/*)
components/          React components (HouseHost, StudyHub, Lesson, ...)
game/
  art/               The procedural cat rig (our own design): look, rig, mold, poses, clips, emotions
  core/              math helpers
  halloween/         costumes, room painter, the 10 items (all drawn in code)
  sim/               arcade clock, progression (EXP/Love), cats' behaviour, the world
  main.ts            HUD, input, render loop
lib/                 server helpers: db, curriculum, player, quiz
db/migrations/       SQL schema
data/                openjlpt/ (CC BY-SA 4.0), ssw/ (our English SSW units), voice-manifest.json
scripts/             migrate, seed, build-voice (VOICEVOX), make-music, check-content
public/audio/        voice/ (generated), music/ (synthesized)
tests/               property-based and unit tests
.kiro/               specs, steering, hooks, skills (must stay in git)
```
