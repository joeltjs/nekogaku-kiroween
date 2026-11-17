/**
 * The house's HUD, input and loop. `startHouse(root)` builds everything inside `root` and returns a
 * function that stops it (React mounts and unmounts it through components/HouseHost.jsx).
 */
import { drawCat, drawPortrait } from './art/cat-rig';
import { sampleClip } from './art/cat-clips';
import { Audio } from './audio';
import { ITEMS, ITEM_IDS, COSTUMES, type ItemId } from './halloween/items';
import { Renderer } from './render';
import { PHASE_LABELS, clockText } from './sim/clock';
import { MAX_LOVE, levelProgress } from './sim/progress';
import { allExamsPassed, examsPassed as passedList, trackName, unlockText } from './sim/unlock';
import { clampToFloor, type Pt } from './sim/room';
import { CAT_BLURBS, CAT_NAMES, World, type Cat } from './sim/world';
import { SLOT_CATS, SLOT_COSTUMES, SLOT_COUNT, slotCount, slotKey } from './sim/album';
import { AGE_LABELS, ageOf, idealWeight, physique } from './art/cat-look';

const SAVE_KEY = 'nekogaku-house-v1';
const ALBUM_KEY = 'nekogaku-album-v1';
const BUDDY_KEY = 'nekogaku-buddy';
const PREFS_KEY = 'nekogaku-prefs';
type Mode = 'pet' | 'ball' | 'feather';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
async function voiceUrl(text: string) {
  const data = new TextEncoder().encode(`2|${text}`), hash = await crypto.subtle.digest('SHA-256', data);
  return `/audio/voice/${[...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)}.mp3`;
}
const ICON = {
  items: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 13h20v13H6z" fill="#c69a68" stroke="#211c1c" stroke-width="2" stroke-linejoin="round"/><path d="M4 9h24v5H4z" fill="#8a6441" stroke="#211c1c" stroke-width="2" stroke-linejoin="round"/><path d="M14 9h4v17h-4z" fill="#f08a2c" stroke="#211c1c" stroke-width="1.6"/></svg>',
  ball: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="#f08a2c" stroke="#211c1c" stroke-width="2"/><path d="M5.5 13.5h21v5h-21z" fill="#2b1f2e"/><circle cx="16" cy="16" r="11" fill="none" stroke="#211c1c" stroke-width="2"/></svg>',
  feather: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M27 3 14 18" stroke="#6e4a2c" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="11" cy="23" rx="4" ry="8" transform="rotate(30 11 23)" fill="#7d4b9c" stroke="#211c1c" stroke-width="1.6"/><ellipse cx="14" cy="24" rx="3.4" ry="7.5" transform="rotate(-5 14 24)" fill="#f08a2c" stroke="#211c1c" stroke-width="1.6"/></svg>',
  gym: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 16h18" stroke="#9aa0ad" stroke-width="3"/><rect x="3" y="9" width="5" height="14" rx="1.5" fill="#3a3442" stroke="#211c1c" stroke-width="1.8"/><rect x="24" y="9" width="5" height="14" rx="1.5" fill="#3a3442" stroke="#211c1c" stroke-width="1.8"/></svg>',
  photo: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="9" width="26" height="18" rx="4" fill="#e9dcc0" stroke="#211c1c" stroke-width="2"/><path d="M11 9l2-4h6l2 4" fill="#e9dcc0" stroke="#211c1c" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="18" r="5.5" fill="#2b1f2e" stroke="#211c1c" stroke-width="2"/><circle cx="14.5" cy="16.5" r="1.6" fill="#fff"/></svg>',
  menu: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4c-6 0-9 4-9 9 0 4 2 6 2 9h14c0-3 2-5 2-9 0-5-3-9-9-9z" fill="#f4f1ff" stroke="#211c1c" stroke-width="2" stroke-linejoin="round"/><circle cx="12.5" cy="13" r="1.8" fill="#211c1c"/><circle cx="19.5" cy="13" r="1.8" fill="#211c1c"/><path d="M9 22h14l-2 4-2-2-3 3-3-3-2 2z" fill="#f4f1ff" stroke="#211c1c" stroke-width="2" stroke-linejoin="round"/></svg>',
  book: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6c4-1.5 7-1 11 1.5v19C12 24 9 23.5 5 25z" fill="#5b2a4a" stroke="#211c1c" stroke-width="2" stroke-linejoin="round"/><path d="M27 6c-4-1.5-7-1-11 1.5v19c4-2.5 7-3 11-1.5z" fill="#7a3d63" stroke="#211c1c" stroke-width="2" stroke-linejoin="round"/><path d="M9 12l2 2 3-4" stroke="#ffcf5a" stroke-width="1.8" fill="none"/></svg>',
};

export function startHouse(root: HTMLElement): () => void {
  root.innerHTML = `
<div class="house">
  <canvas class="world" aria-label="The haunted living room. Tap a cat to pet it, hold to carry it, drag the floor to look around."></canvas>
  <header class="hud-top">
    <div class="place"><strong>The Haunted Parlor</strong><span data-clock>Day 1 · 18:00</span></div>
    <div class="hud-right">
      <button class="round" data-act="photo" aria-label="Take a photo">${ICON.photo}</button>
    </div>
  </header>
  <div class="mode" data-mode hidden><span data-mode-text></span><button data-act="mode-exit" aria-label="Done">×</button></div>
  <nav class="hud-bottom" aria-label="Tools">
    <button class="tool" data-act="items">${ICON.items}<span>Items</span></button>
    <button class="tool" data-act="ball" aria-pressed="false">${ICON.ball}<span>Ball</span></button>
    <button class="tool" data-act="feather" aria-pressed="false">${ICON.feather}<span>Feather</span></button>
    <button class="tool" data-act="grimoire">${ICON.book}<span>Grimoire</span></button>
    <button class="tool" data-act="menu" aria-haspopup="dialog">${ICON.menu}<span>Menu</span></button>
  </nav>
  <div class="banner" data-banner hidden></div>
  <div class="toast" data-toast role="status" aria-live="polite"></div>
  <div class="item-pop" data-pop hidden></div>
  <dialog class="sheet" data-dialog="menu" aria-label="Menu">
    <div class="sheet-head"><h2>The House</h2><button class="x" data-close aria-label="Close">×</button></div>
    <div class="tabs" role="tablist"><button role="tab" data-tab="cats">Cats</button><button role="tab" data-tab="album">Album</button><button role="tab" data-tab="settings">Settings</button></div>
    <section data-menu-body></section>
  </dialog>
  <dialog class="sheet" data-dialog="items" aria-label="Items">
    <div class="sheet-head"><h2 data-items-title>Items</h2><button class="x" data-close aria-label="Close">×</button></div>
    <p class="hint">Pick an item, then tap the floor to place it. Each one teaches a Japanese word.</p>
    <p class="hint unlock-hint" data-unlock-hint></p>
    <div class="item-grid" data-item-grid></div>
  </dialog>
  <dialog class="sheet" data-dialog="photo" aria-label="Photo">
    <div class="sheet-head"><h2>Snap!</h2><button class="x" data-close aria-label="Close">×</button></div>
    <img data-photo alt="Photo of the cats">
    <div class="row"><a class="primary" data-photo-save download="nekogaku-halloween.png">Save photo</a><span class="hint">Also kept in the Album.</span></div>
  </dialog>
</div>`;
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const canvas = $<HTMLCanvasElement>('canvas.world');
  const world = new World();
  const audio = new Audio();
  const prefs = (() => { try { return { music: true, effects: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { music: true, effects: true }; } })();
  audio.music = prefs.music; audio.effects = prefs.effects;
  const renderer = new Renderer(canvas, world);
  let mode: Mode = 'pet', alive = true, last = performance.now(), saveAge = 0, hudAge = 0;
  let placing: { id: ItemId } | { move: string } | null = null;
  let feather: Pt | null = null;

  world.events = {
    sound: (id, cat) => audio.play(id, cat),
    banner: (title, text) => banner(title, text),
    costume: (cat, id) => {
      void voiceUrl(COSTUMES[id].jp).then(u => window.setTimeout(() => audio.say(u), 600));
      // The moment goes into the album, as long as the house is on screen.
      window.setTimeout(() => { if (root.getClientRects().length) takePhoto(`${cat.name} is a ${COSTUMES[id].name.toLowerCase()}`, false); }, 1400);
    },
  };

  // Small UI helpers
  let toastTimer = 0;
  function toast(text: string) { const el = $('[data-toast]'); el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove('show'), 2800); }
  const banners: [string, string][] = []; let bannerBusy = false;
  function banner(title: string, text: string) { banners.push([title, text]); if (!bannerBusy) nextBanner(); }
  function nextBanner() {
    const b = banners.shift(), el = $('[data-banner]');
    if (!b) { bannerBusy = false; return; }
    bannerBusy = true; el.innerHTML = `<strong>${esc(b[0])}</strong><span>${esc(b[1])}</span>`; el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    window.setTimeout(() => { el.classList.remove('show'); window.setTimeout(() => { el.hidden = true; nextBanner(); }, 400); }, 3400);
  }
  // The save lives on the server under the player's access code (and a copy on this device for when it is offline).
  let playerId = '', serverAge = 99, lastSent = '';
  const localKey = () => `${SAVE_KEY}:${playerId || 'guest'}`;
  function save(force = false) {
    const savedAt = Date.now(), json = JSON.stringify({ ...world.snapshot(), savedAt });
    try { localStorage.setItem(localKey(), json); } catch { /* storage full or private */ }
    if (!playerId || (!force && serverAge < 15) || json === lastSent) return;
    serverAge = 0; lastSent = json;
    void fetch('/api/house', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ save: json, savedAt }), keepalive: true }).catch(() => undefined);
  }
  async function boot() {
    try {
      const r = await fetch('/api/house', { cache: 'no-store' });
      if (r.status === 401) { location.href = '/login'; return; }
      const data = await r.json();
      playerId = data.player?.id || '';
      let local: string | null = null; try { local = localStorage.getItem(localKey()); } catch { /* private */ }
      const at = (raw: string | null) => { try { return raw ? Number(JSON.parse(raw).savedAt) || 0 : -1; } catch { return -1; } };
      const best = at(local) > (data.savedAt || 0) ? local : data.save;
      // The exams come first, so a saved item that is still locked is not put back on the floor.
      setExams(data.exams, true);
      if (best) world.load(JSON.parse(best));
      applyRewards(data.rewards);
    } catch { try { const raw = localStorage.getItem(localKey()); if (raw) world.load(JSON.parse(raw)); } catch { /* fresh house */ } }
  }
  function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify({ music: audio.music, effects: audio.effects })); } catch { /* fine */ } }
  function closeDialogs() { root.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d => d.close()); }
  function open(name: string) { closeDialogs(); hidePop(); const d = $<HTMLDialogElement>(`[data-dialog="${name}"]`); d.showModal(); audio.play('tap'); return d; }
  root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => (b.closest('dialog') as HTMLDialogElement).close()));
  root.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

  /** A little picture of a cat sitting in its costume, for the menus. */
  /** A little picture of a cat sitting as itself, for the menus. */
  function paintCat(c: HTMLCanvasElement, cat: Cat, t = 1.2) {
    const size = c.width, g = c.getContext('2d')!, l = levelProgress(cat.exp).level, phys = physique(cat.look, l, idealWeight(l));
    g.clearRect(0, 0, size, c.height);
    const pose = sampleClip('sitFront', { t, phase: 0, seed: cat.seed, intensity: 1 }), k = size / 112 / Math.max(.72, phys.scale ** .6);
    g.save(); g.translate(size / 2, c.height * .92);
    drawCat(g, pose, cat.look, phys, { facing: 1, scale: k, time: t, blink: 1 });
    g.restore();
  }
  function portrait(cat: Cat, size = 64) {
    const c = document.createElement('canvas'); c.width = c.height = size * 2; c.style.width = c.style.height = `${size}px`;
    const l = levelProgress(cat.exp).level; drawPortrait(c.getContext('2d')!, cat.look, physique(cat.look, l, idealWeight(l)), size * 2);
    return c;
  }
  const hearts = (love: number) => Array.from({ length: MAX_LOVE }, (_, i) => `<i class="${love >= i + 1 ? 'on' : love > i ? 'half' : ''}"></i>`).join('');

  // Menu
  let tab = 'cats';
  function openMenu(t = tab) { tab = t; open('menu'); renderMenu(); }
  root.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab!; audio.play('tap'); renderMenu(); }));
  function renderMenu() {
    root.querySelectorAll<HTMLElement>('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    const body = $('[data-menu-body]');
    if (tab === 'cats') {
      const buddy = localStorage.getItem(BUDDY_KEY) || 'cecil';
      body.innerHTML = world.cats.map(c => {
        const p = levelProgress(c.exp), age = AGE_LABELS[ageOf(p.level)];
        return `<article class="cat-card" data-cat="${c.id}">
          <canvas class="cat-stage" width="220" height="200" data-stage></canvas>
          <div class="cat-info">
            <h3>${esc(c.name)} <small>Lv ${p.level} · ${age}</small></h3>
            <div class="bar" aria-label="EXP"><i style="width:${(p.ratio * 100).toFixed(1)}%"></i><span>${p.span ? `EXP ${p.into} / ${p.span}` : 'Max level'}</span></div>
            <div class="hearts" aria-label="Love ${c.love.toFixed(1)} of 10">${hearts(c.love)}</div>
            <p class="blurb">${esc(CAT_BLURBS[c.id])}</p>
            <p class="costume-now">${c.costume ? `Dressed as a <b>${COSTUMES[c.costume].name.toLowerCase()}</b> <span lang="ja">${COSTUMES[c.costume].jp}</span> for a little while.` : 'Give a Halloween item to dress up: the coffin makes a vampire, the ghost sheet a ghost, the full-moon lamp a werewolf, the bat wings a bat, the broom a witch.'}</p>
            <button class="buddy" data-gym>Send to the barbell</button>
            <button class="buddy" data-buddy aria-pressed="${buddy === c.id}">${buddy === c.id ? 'Study buddy' : 'Make study buddy'}</button>
          </div></article>`;
      }).join('');
      body.querySelectorAll<HTMLElement>('[data-cat]').forEach(card => {
        const cat = world.getCat(card.dataset.cat!)!;
        paintCat(card.querySelector('canvas')!, cat);
        card.querySelector('[data-buddy]')!.addEventListener('click', () => { localStorage.setItem(BUDDY_KEY, cat.id); audio.play('meow', cat.id); renderMenu(); });
        card.querySelector('[data-gym]')!.addEventListener('click', () => { closeDialogs(); world.startGym(cat); renderer.lookAt(1030); toast(`${cat.name} heads to the barbell.`); });
      });
    } else if (tab === 'album') {
      const album = readAlbum();
      body.innerHTML = slotGridHtml() + (album.length ? `<div class="album">${album.map(p => `<figure><img src="${p.data}" alt="Photo from day ${p.day}"><figcaption>${p.note ? `${esc(p.note)} · ` : ''}Day ${p.day} · ${esc(p.time)}<span><a href="${p.data}" download="nekogaku-${p.id}.jpg">Save</a><button data-del="${p.id}">Delete</button></span></figcaption></figure>`).join('')}</div>`
        : '<p class="empty">Nothing here yet. Take a photo with the camera button, or dress a cat up with a Halloween item and its moment is saved here.</p>');
      body.querySelectorAll<HTMLElement>('[data-del]').forEach(b => b.addEventListener('click', () => { writeAlbum(readAlbum().filter(p => p.id !== b.dataset.del)); renderMenu(); }));
    } else {
      body.innerHTML = `<div class="settings">
        <label><input type="checkbox" data-pref="music" ${audio.music ? 'checked' : ''}> Music</label>
        <label><input type="checkbox" data-pref="effects" ${audio.effects ? 'checked' : ''}> Sound effects</label>
        <p class="hint">Time here is arcade time: one day in the house lasts 10 minutes.</p>
        <button data-signout>Sign out</button>
        <p class="hint"><a href="/credits">Credits and licenses</a></p></div>`;
      body.querySelectorAll<HTMLInputElement>('[data-pref]').forEach(i => i.addEventListener('change', () => { if (i.dataset.pref === 'music') audio.setMusic(i.checked); else audio.effects = i.checked; savePrefs(); }));
      body.querySelector('[data-signout]')!.addEventListener('click', () => { save(true); void fetch('/api/session', { method: 'DELETE' }).finally(() => { location.href = '/login'; }); });
    }
  }

  // Album
  interface Photo { id: string; at: number; day: number; time: string; data: string; note?: string }
  function readAlbum(): Photo[] { try { const a = JSON.parse(localStorage.getItem(ALBUM_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }
  /** Each cat's row of costume slots: opened ones show the costume name, the rest say Locked. */
  function slotGridHtml(): string {
    const open = world.albumSlots;
    const rows = SLOT_CATS.map(cat => `<div class="slot-row"><b>${CAT_NAMES[cat]}</b>${SLOT_COSTUMES.map(k => {
      const on = open.includes(slotKey(cat, k));
      return `<span class="slot${on ? ' open' : ''}">${on ? COSTUMES[k].name : 'Locked'}</span>`;
    }).join('')}</div>`).join('');
    return `<section class="slots" aria-label="Costume album slots"><h3>Costume slots: ${slotCount(open)} of ${SLOT_COUNT} open</h3>${rows}</section>`;
  }
  function writeAlbum(a: Photo[]) {
    let list = a.slice(0, 12);
    while (list.length) { try { localStorage.setItem(ALBUM_KEY, JSON.stringify(list)); return; } catch { list = list.slice(0, -1); } }
    localStorage.removeItem(ALBUM_KEY);
  }
  function takePhoto(note = '', show = true) {
    if (show) audio.play('shutter');
    const clock = world.clock, w = 1200, h = Math.round(w * renderer.vh / renderer.vw), pad = 34;
    const c = document.createElement('canvas'); c.width = w; c.height = h + pad * 2 + 40;
    const g = c.getContext('2d')!;
    g.fillStyle = '#1d1424'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(canvas, pad, pad, w - pad * 2, h);
    g.strokeStyle = '#ff8a3d'; g.lineWidth = 6; g.strokeRect(pad, pad, w - pad * 2, h);
    // Little pumpkins in the corners of the frame.
    for (const [x, y] of [[pad, pad], [w - pad, pad], [pad, pad + h], [w - pad, pad + h]]) { g.fillStyle = '#f08a2c'; g.beginPath(); g.ellipse(x, y, 20, 15, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#6b8f3c'; g.fillRect(x - 2, y - 22, 4, 8); }
    g.fillStyle = '#e9dcc0'; g.font = '700 30px Georgia, serif'; g.textAlign = 'left'; g.fillText('NekoGaku · Happy Halloween', pad, h + pad + 46);
    g.textAlign = 'right'; g.font = '600 24px system-ui, sans-serif'; g.fillStyle = '#c9b8d8'; g.fillText(`Day ${clock.day} · ${clockText(clock)}`, w - pad, h + pad + 46);
    const full = c.toDataURL('image/png');
    const small = document.createElement('canvas'); small.width = 720; small.height = Math.round(720 * c.height / c.width); small.getContext('2d')!.drawImage(c, 0, 0, small.width, small.height);
    writeAlbum([{ id: Date.now().toString(36), at: Date.now(), day: clock.day, time: clockText(clock), data: small.toDataURL('image/jpeg', .8), note }, ...readAlbum()]);
    if (!show) return;
    $<HTMLImageElement>('[data-photo]').src = full; $<HTMLAnchorElement>('[data-photo-save]').href = full;
    open('photo');
  }

  // Items
  function openItems() {
    open('items');
    const open15 = ITEM_IDS.filter(id => world.itemUnlocked(id)).length;
    $('[data-items-title]').textContent = `Items · ${open15} of ${ITEM_IDS.length}`;
    const hint = $('[data-unlock-hint]');
    hint.textContent = allExamsPassed(world.examsPassed) ? '' : unlockText(world.examsPassed);
    hint.hidden = !hint.textContent;
    $('[data-item-grid]').innerHTML = ITEM_IDS.map(id => { const d = ITEMS[id], lock = !world.itemUnlocked(id); return `<button data-item="${id}"${lock ? ' class="locked" aria-disabled="true"' : ''}><canvas width="140" height="140"></canvas>${lock ? '<span class="lock-badge">Locked</span><span class="padlock" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="#e9dcc0"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" fill="none" stroke="#e9dcc0" stroke-width="2.2"/></svg></span>' : ''}<b>${esc(d.name)}</b><small><span lang="ja">${d.jp}</span> · ${esc(d.romaji)}</small><em>${lock ? 'Opens after all 7 mock exams at 80%+.' : esc(d.blurb)}</em></button>`; }).join('');
    $('[data-item-grid]').querySelectorAll<HTMLElement>('[data-item]').forEach(b => {
      const id = b.dataset.item as ItemId, def = ITEMS[id], c = b.querySelector('canvas')!, g = c.getContext('2d')!;
      const k = Math.min(1, 110 / Math.max(def.hw * 2.4, def.h + 30));
      g.translate(70, 128); g.scale(k, k); def.draw(g, 1); def.front?.(g, 1);
      b.addEventListener('click', () => {
        if (!world.itemUnlocked(id)) { toast(unlockText(world.examsPassed)); return; }
        closeDialogs(); placing = { id }; renderer.ghost = { id, ...renderer.toWorld(renderer.vw / 2, renderer.vh * .7) }; setModeText(`Tap the floor to place the ${def.name.toLowerCase()}`);
      });
    });
  }
  function hidePop() { $('[data-pop]').hidden = true; renderer.selected = null; }
  function showPop(uid: string) {
    const it = world.items.find(i => i.uid === uid); if (!it) return;
    const d = ITEMS[it.id], el = $('[data-pop]');
    renderer.selected = uid;
    el.innerHTML = `<div class="word"><span lang="ja">${d.jp}</span><small>${esc(d.romaji)} · “${esc(d.meaning)}”</small></div>
      <p class="pop-blurb">${esc(d.blurb)}</p>
      <div class="row give"><span>Give to</span>${world.cats.map(c => `<button data-give="${c.id}">${esc(c.name)}</button>`).join('')}</div>
      <div class="row"><button data-say aria-label="Hear the word"><svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Hear</button><button data-move>Move</button><button data-away>Put away</button></div>`;
    el.hidden = false;
    const say = () => voiceUrl(d.jp).then(u => audio.say(u));
    void say();
    el.querySelector('[data-say]')!.addEventListener('click', () => void say());
    el.querySelectorAll<HTMLElement>('[data-give]').forEach(b => b.addEventListener('click', () => {
      const cat = world.getCat(b.dataset.give!)!;
      if (world.giveItem(cat, uid)) { hidePop(); toast(d.use.costume ? `${cat.name} goes to the ${d.name.toLowerCase()}… watch!` : `${cat.name} goes to the ${d.name.toLowerCase()}.`); }
      else toast(`${cat.name} is busy right now.`);
    }));
    el.querySelector('[data-move]')!.addEventListener('click', () => { placing = { move: uid }; renderer.ghost = { id: it.id, x: it.x, y: it.y }; hidePop(); setModeText(`Tap where the ${d.name.toLowerCase()} should go`); });
    el.querySelector('[data-away]')!.addEventListener('click', () => { world.removeItem(uid); hidePop(); audio.play('pop'); save(); });
  }

  // Gym

  // Modes
  function setModeText(text: string) { const m = $('[data-mode]'); m.hidden = !text; $('[data-mode-text]').textContent = text; }
  function setMode(next: Mode) {
    mode = next; placing = null; renderer.ghost = null;
    if (next !== 'feather') { feather = null; world.setFeather(null); }
    $('[data-act="ball"]').setAttribute('aria-pressed', String(next === 'ball'));
    $('[data-act="feather"]').setAttribute('aria-pressed', String(next === 'feather'));
    setModeText(next === 'ball' ? 'Tap the floor to throw the ball' : next === 'feather' ? 'Drag the feather near a cat' : '');
  }
  root.querySelectorAll<HTMLElement>('[data-act]').forEach(b => b.addEventListener('click', () => {
    audio.unlock();
    const act = b.dataset.act;
    if (act === 'menu') openMenu();
    else if (act === 'photo') takePhoto();
    else if (act === 'items') { setMode('pet'); openItems(); }
    else if (act === 'grimoire') { audio.play('tap'); window.dispatchEvent(new CustomEvent('nekogaku:go', { detail: '/study' })); }
    else if (act === 'ball') { audio.play('tap'); setMode(mode === 'ball' ? 'pet' : 'ball'); }
    else if (act === 'feather') { audio.play('tap'); setMode(mode === 'feather' ? 'pet' : 'feather'); if (mode === 'feather') { feather = renderer.toWorld(renderer.vw / 2, renderer.vh * .6); world.setFeather(feather); } }
    else if (act === 'mode-exit') { setMode('pet'); hidePop(); }
  }));

  // Pointer
  function catAt(p: Pt): Cat | undefined {
    let best: Cat | undefined, bestY = -Infinity;
    for (const c of world.cats) {
      const s = world.shapes(c);
      const inHead = Math.hypot(p.x - s.head.x, p.y - s.head.y) < s.head.r * 1.15;
      const inBody = ((p.x - s.body.x) / (s.body.rx * 1.2)) ** 2 + ((p.y - s.body.y) / (s.body.ry * 1.4)) ** 2 < 1;
      if ((inHead || inBody) && c.y > bestY) { best = c; bestY = c.y; }
    }
    return best;
  }
  function itemAt(p: Pt) {
    return [...world.items].filter(it => !it.worn).sort((a, b) => b.y - a.y).find(it => { const d = ITEMS[it.id]; return Math.abs(p.x - it.x) < d.hw && p.y < it.y + 12 && p.y > it.y - d.h; });
  }
  let down: { id: number; sx: number; sy: number; at: number; cat?: Cat; item?: string; moved: boolean; holding: boolean } | null = null;
  let holdTimer = 0;
  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { sx: e.clientX - r.left, sy: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', e => {
    audio.unlock();
    if (down) return;
    const { sx, sy } = local(e), p = renderer.toWorld(sx, sy);
    canvas.setPointerCapture(e.pointerId);
    down = { id: e.pointerId, sx, sy, at: performance.now(), moved: false, holding: false };
    if (mode === 'feather') { feather = p; world.setFeather(p); return; }
    if (placing) { if (renderer.ghost) Object.assign(renderer.ghost, clampToFloor(p)); return; }
    const cat = catAt(p);
    if (cat) {
      down.cat = cat;
      holdTimer = window.setTimeout(() => { if (down?.cat === cat && !down.moved) { down.holding = true; world.pickUp(cat); world.moveHeld(cat, p); hidePop(); } }, 380);
      return;
    }
    const it = itemAt(p); if (it) down.item = it.uid;
  });
  canvas.addEventListener('pointermove', e => {
    if (!down || e.pointerId !== down.id) {
      if (mode === 'feather' && e.pointerType === 'mouse') { const { sx, sy } = local(e); feather = renderer.toWorld(sx, sy); world.setFeather(feather); }
      return;
    }
    const { sx, sy } = local(e), p = renderer.toWorld(sx, sy), dx = sx - down.sx, dy = sy - down.sy;
    const far = Math.hypot(e.clientX - (down.sx + canvas.getBoundingClientRect().left), e.clientY - (down.sy + canvas.getBoundingClientRect().top));
    if (mode === 'feather') { feather = p; world.setFeather(p); return; }
    if (placing) { if (renderer.ghost) Object.assign(renderer.ghost, clampToFloor(p)); return; }
    if (down.cat) {
      if (!down.holding && far > 14) { down.holding = true; clearTimeout(holdTimer); world.pickUp(down.cat); hidePop(); }
      if (down.holding) world.moveHeld(down.cat, p);
      down.moved = down.moved || far > 14;
      return;
    }
    if (far > 8 || down.moved) { down.moved = true; renderer.pan(dx, dy); down.sx = sx; down.sy = sy; }
  });
  const up = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    clearTimeout(holdTimer);
    const d = down; down = null;
    const { sx, sy } = local(e), p = renderer.toWorld(sx, sy);
    if (mode === 'feather') return;
    if (placing) {
      const at = clampToFloor(p);
      if ('id' in placing) { world.placeItem(placing.id, at); toast(`${ITEMS[placing.id].name} placed. Tap it to hear its Japanese name.`); }
      else { world.moveItem(placing.move, at); audio.play('pop'); }
      placing = null; renderer.ghost = null; setModeText(''); save(); return;
    }
    if (d.cat) {
      if (d.holding) { world.drop(d.cat); save(); }
      else world.pet(d.cat);
      return;
    }
    if (d.moved) return;
    if (d.item) { showPop(d.item); audio.play('tap'); return; }
    hidePop();
    if (mode === 'ball') world.throwBall(p);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Rewards from the grimoire (R10.6)
  /** The mock exams the server says were passed. A newly passed one gets a banner (not on the first load). */
  function setExams(list: unknown, quiet = false) {
    if (!Array.isArray(list)) return;
    const now = list.map(String), before = world.examsPassed;
    const fresh = now.filter(t => !before.includes(t));
    world.examsPassed = passedList(now);
    if (quiet || !fresh.length) return;
    banner(`${trackName(fresh[0])} mock exam passed`, `${world.examsPassed.length} of 7 done.`);
    if (allExamsPassed(world.examsPassed)) banner('10 Halloween items opened', 'Every mock exam passed. Find them in the Items menu.');
  }
  function applyRewards(list: unknown) {
    if (!Array.isArray(list) || !list.length) return;
    for (const r of list.slice(0, 50) as { cat?: unknown; exp?: unknown; source?: unknown }[]) {
      if (typeof r?.exp !== 'number') continue;
      const cat = world.applyReward(String(r.cat), r.exp, String(r.source || 'Study'));
      banner(`${cat.name} +${Math.round(r.exp)} EXP`, `From your study: ${String(r.source || 'a lesson').slice(0, 60)}`);
    }
    save(true);
  }
  function drainRewards() { if (!playerId) return; void fetch('/api/house?only=rewards', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) { setExams(d.exams); applyRewards(d.rewards); } }).catch(() => undefined); }
  const onFocus = () => drainRewards();
  window.addEventListener('focus', onFocus);
  const onResize = () => renderer.resize();
  window.addEventListener('resize', onResize);
  const onHide = () => save(true);
  window.addEventListener('pagehide', onHide);
  void boot();

  // Loop
  let lastPhase = '';
  function hud() {
    const c = world.clock;
    $('[data-clock]').textContent = `Day ${c.day} · ${clockText(c)} · ${PHASE_LABELS[c.phase]}`;
    if (c.phase !== lastPhase) { lastPhase = c.phase; root.querySelector('.house')!.setAttribute('data-phase', c.phase); audio.playMusic(c.phase === 'witching' ? 'witching' : 'parlor'); }
  }
  function frame(now: number) {
    if (!alive) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    world.step(dt);
    const gym = world.cats.find(c => c.act.k === 'gym' || (c.act.k === 'walk' && c.act.then.k === 'gym'));
    if (gym && !down) renderer.camX += ((Math.max(0, gym.x - renderer.vw / renderer.zoom / 2)) - renderer.camX) * Math.min(1, dt * 2), renderer.pan(0, 0);
    if (root.getClientRects().length) renderer.draw(mode === 'feather' ? feather : null);
    if ((hudAge += dt) > .25) { hudAge = 0; hud(); }
    serverAge += dt;
    if ((saveAge += dt) > 5) { saveAge = 0; save(); }
    requestAnimationFrame(frame);
  }
  hud();
  requestAnimationFrame(frame);
  (window as unknown as { nekogaku?: unknown }).nekogaku = { world, renderer, audio };

  return () => {
    alive = false; save(true); audio.stop();
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('resize', onResize); window.removeEventListener('pagehide', onHide);
    root.innerHTML = '';
  };
}
