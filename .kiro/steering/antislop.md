---
inclusion: fileMatch
fileMatchPattern: ['app/**', 'components/**', 'game/main.ts', 'game/halloween/**', 'README.md', 'docs/**', '*.md']
---

# antislop is the filter for UI, copy and comments

The antislop skills are installed in `.kiro/skills/` (MIT, github.com/miqdadbadjuber/anti-slop, v3.2.30).
Mode for this project: **during**.

- Direction comes from `DESIGN.md`; antislop only filters on top of it.
- UI work: `antislop` + `antislop-ui` + `antislop-human` (WCAG AA, checked with
  `python3 .kiro/skills/antislop-human/contrast-check.py <fg> <bg>`) + `antislop-layoutmobile`.
- README, write-up, Devpost text: `antislop-copywriting`. No em dashes, no hype words, no invented numbers.
- Comments: `antislop-code` (comments only, never code). The ported rig in `game/art` was cleaned this way and
  verified identical with comments stripped.
- Before saying a UI task is done, run the Delivery Gate: build, click through, check phone width.
