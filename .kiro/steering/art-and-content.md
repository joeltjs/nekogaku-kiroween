---
inclusion: fileMatch
fileMatchPattern: ['game/**', 'data/**', 'components/**', 'app/**/*.css']
---

# Art and content rules

## Cats (game/art)

- The cats are drawn by our rig: one dark ink outline (`INK`) on the outer silhouette, flat fills,
  no gradients on characters. Faces must agree with the body.
- Each cat keeps its own coat in every pose and costume: Cecil (white, grey-brown cap, ringed tail,
  sour "jutek" face from teen age), Kuku (calico, biggest eyes), Bolu (golden tabby).
- Costumes are overlays anchored to the rig's head and neck (`catShapes`), so they follow every pose.
- Pictures must be whole: nothing cut off at the edges of the room.

## Room and items

- One room. Flat muted fills, one brown ink line, Halloween night palette (deep purple, pumpkin
  orange, candle yellow). The window shows a moon, bats and the night sky.
- Exactly 10 item kinds, drawn in code in `game/halloween/items.ts`. Each item also teaches one
  Japanese word (kana + romaji + English).

## Lessons

- English UI and explanations. Japanese terms always with reading.
- JLPT content comes from OpenJLPT (CC BY-SA 4.0): keep the attribution on `/credits`.
- SSW content in `data/ssw/` is written for this app in English. Keep claims factual and general;
  no invented statistics, no legal advice.
- Never put an answer twice in a quiz's options; every quiz has exactly one correct option.
