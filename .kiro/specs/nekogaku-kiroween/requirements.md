# Requirements: NekoGaku, Kiroween edition

Format: EARS (Easy Approach to Requirements Syntax). "The house" is the cat room on `/`;
"the grimoire" is the study area on `/study`.

## R1. One haunted room

- R1.1 The house SHALL show exactly one room, a Halloween living room, with no doors or exits.
- R1.2 The room SHALL always show Halloween decoration (pumpkins, candles, bats, cobwebs, moon window).
- R1.3 WHEN the player drags on empty floor, the view SHALL pan inside the room's bounds.

## R2. Three cats

- R2.1 The house SHALL contain exactly three cats: Cecil, Kuku and Bolu, drawn by the procedural rig.
- R2.2 WHEN the player taps a cat, the cat SHALL react to petting and gain Love (rate-limited).
- R2.3 WHEN the player presses and holds a cat, the player SHALL carry it; WHEN released, the cat
  SHALL land at the release point clamped to the floor.
- R2.4 WHILE idle, each cat SHALL choose its own activity (walk, sit, groom, nap, use an item).

## R3. Play

- R3.1 WHEN ball mode is on and the player taps the floor, a ball SHALL be thrown there and the
  nearest awake cat SHALL chase and bat it.
- R3.2 WHILE feather mode is on, the feather SHALL follow the pointer and nearby cats SHALL crouch,
  pounce and bat at it.
- R3.3 Playing (ball, feather) SHALL raise Love and a small amount of EXP, rate-limited.

## R4. Halloween items

- R4.1 The game SHALL offer exactly 10 item kinds, all Halloween-themed and drawn in code: pumpkin bed,
  coffin, ghost sheet, full-moon lamp, bat wings, witch broom, witch cauldron, spooky tree tower,
  candles, spider toy.
- R4.2 WHEN the player picks an item in the Items menu and taps the floor, the item SHALL be placed there.
- R4.3 WHEN the player taps a placed item, the game SHALL show its Japanese word (kana, romaji,
  English) with VOICEVOX audio, and offer Give to (each cat), Move and Put away.
- R4.4 Cats SHALL use items that fit them (nap in the pumpkin bed, peek out of the cauldron, perch on
  the tree tower, watch the candles, bat the spider toy).

## R5. Photos

- R5.1 WHEN the player presses Photo, the game SHALL capture the canvas with a Halloween frame and
  offer Save.
- R5.2 The game SHALL keep the last 12 photos in an on-device album shown in the menu.

## R6. Progression: EXP and Love only

- R6.1 Each cat SHALL have exactly two stats: EXP (deriving a level 1..15) and Love (0..10 hearts).
- R6.2 The level SHALL never decrease when EXP increases, and SHALL stay within 1..15.
- R6.3 A cat's size and age look SHALL follow its level (kitten, teen, adult, senior).
- R6.4 Love SHALL stay within 0..10.

## R7. Costumes come from items

- R7.1 A cat SHALL look like itself (its own coat and face) unless it is wearing a costume.
- R7.2 WHEN a cat uses a costume item, it SHALL dress up for a while (45 s of play):
  coffin → vampire (cape, collar, fangs); ghost sheet → ghost (sheet with its own face showing,
  floating); full-moon lamp → werewolf (wolf ears, cheek fur, mane, a howl); bat wings → bat (wings,
  flies around the room); witch broom → witch (hat, flies on the broom).
- R7.3 Worn items (sheet, wings, broom) SHALL leave the floor while worn and come back when the
  costume ends. Costumes SHALL follow the cat in every pose.
- R7.4 The transformation SHALL show the costume's Japanese word and say it with VOICEVOX.

## R8. Gym

- R8.1 WHEN the player presses Gym, the game SHALL ask which cat to train (no gym room).
- R8.2 WHEN a cat is chosen, it SHALL lift a barbell in the living room for one set with a
  determined face and sweat marks, then gain EXP.

## R9. Arcade clock

- R9.1 The clock SHALL be independent of real time: one in-game day lasts 10 real minutes,
  starting at 18:00 on a new save.
- R9.2 The room lighting SHALL follow the in-game hour (dusk, night, witching hour, dawn, day).
- R9.3 The in-game hour SHALL always be in [0, 24) and advance monotonically with play time.

## R10. Grimoire (study)

- R10.1 The grimoire SHALL offer tracks N5, N4, N3, N2, N1, SSW Kaigo and SSW Food.
- R10.2 JLPT tracks SHALL contain the full OpenJLPT vocabulary, kanji and grammar for the level,
  split into units.
- R10.3 SSW tracks SHALL contain English units with Japanese key terms and scenario questions.
- R10.4 Each unit SHALL have study cards (Japanese, reading, English, example) and a quiz.
- R10.5 Every quiz question SHALL have exactly one correct option and no duplicate options.
- R10.6 WHEN a quiz ends, the result SHALL be saved and converted to EXP for the chosen study cat.
- R10.7 All learner-facing text SHALL be English.
- R10.8 The grimoire UI SHALL be dark and Halloween-themed while meeting WCAG AA contrast for text.

## R11. Audio

- R11.1 Japanese words SHALL have VOICEVOX audio generated offline; the app SHALL work (silently)
  for words without audio.
- R11.2 Background music SHALL be original synthesized tracks only.
- R11.3 Cat and UI sounds SHALL be synthesized in the browser.
- R11.4 The credits page SHALL list VOICEVOX:四国めたん, OpenJLPT (CC BY-SA 4.0) and the app license.

## R12. Access codes

- R12a.1 The house and the grimoire SHALL require signing in with an access code (NEKO-XXXX-XXXX)
  issued separately; the door page SHALL be the only public page besides the credits.
- R12a.2 Codes and session tokens SHALL be stored only as SHA-256 hashes; sign-in SHALL be rate-limited.
- R12a.3 The house save and grimoire progress SHALL be stored per code on the server, so a judge
  continues on any device.

## R13. Explanations and the mock exam

- R13.1 WHEN the learner answers a quiz question, the game SHALL explain why the answer is right and,
  for a wrong pick, what the picked option really means (built from the data).
- R13.2 Each track SHALL offer a mock exam (simulation): 20 mixed questions, a 10-minute clock, no
  feedback until the end, then a review of every question with its explanation.

## R14. Hackathon compliance

- R14.1 The repository SHALL be public-ready with an OSI license (MIT) and keep `/.kiro` in git.
- R14.2 No third-party game assets, trademarks or copyrighted music SHALL be included.
- R14.3 The app SHALL run without any external service.
