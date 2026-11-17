# DESIGN.md: NekoGaku, Kiroween edition

Direction for every screen. The antislop skills in `.kiro/skills/` are the filter on top of this.

## Identity

A cozy cat house that has gone a little haunted for Halloween, and a study book that looks like a witch's grimoire. Spooky, never gory. The cats stay cute; the room and the book carry the scare.

- Personality: playful, candle-lit, a bit theatrical in the headings ("The spell fizzles…"), plain and exact in explanations.
- The cats are the brand. No separate logo mark beyond the pumpkin-cat favicon (`app/icon.svg`).

## Palette

| Token | Hex | Use |
| --- | --- | --- |
| night | `#0f0a14` | page ground |
| crypt | `#1d1424` | cards, dialogs |
| crypt-2 | `#2a1d33` | raised cards |
| edge | `#4a3558` | borders |
| parchment | `#e9dcc0` | body text |
| muted | `#c9b8d8` | secondary text |
| candle | `#ffcf5a` | headings, highlights |
| pumpkin | `#ff8a3d` | primary actions, focus glow |
| ghost | `#9dffb0` | correct answers, keyboard focus ring |
| blood | `#e0475f` | wrong answers |

Room art: deep purple walls (`#4a3558`), dark plank floor, pumpkin orange, candle yellow, one brown ink line (`#3a2a24`). Cats: one dark ink outline (`#211c1c`), flat fills.

## Typography

- Headings: an old-style serif stack (Iowan Old Style, Palatino, Georgia). It reads like a printed spellbook.
- Text and controls: the system sans stack for readability.
- Japanese: Hiragino Sans / Noto Sans JP, large on study cards (2.4–4rem).

## Dials

- ENERGY 3: the room flickers (fire, candles, bats across the moon), the study pages stay calm.
- RHYTHM 2: tombstone track cards, a parchment card per word, a review list. Each section has its own shape.
- MOTION 2: candle flicker, drifting fog, bats, a soft rise for cards. All of it stops under `prefers-reduced-motion`.

## Rules for this product

- Halloween decoration is identity here (bats, cobwebs, moon, candles, tombstones). Keep each piece purposeful and never over text.
- Every answer is explained in plain English. No hype words, no em dashes, no invented numbers.
- Text contrast meets WCAG AA on every dark surface.
