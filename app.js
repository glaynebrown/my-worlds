/* My Worlds UI: hash routes, the library, sign-in, and adding/editing worlds.
   The inside of a world (board, quotes, favorites, canon, fics, rewatch) is
   in world.js. Data goes through DB (store.js, or demo.js in sample mode).

   Routes:  #/                 library of worlds
            #/new              add a world
            #/w/ID             a world (opens on its mood board)
            #/w/ID/SECTION     board | quotes | favs | canon | fics | rewatch
            #/w/ID/ship/SID    one ship's page (photos)
            #/w/ID/settings    edit a world
            #/login  #/reset                                               */

const view = document.getElementById('view');
const state = { user: null, settings: null, worlds: [], items: [], loaded: false, unwatch: [], filters: {} };
let DB = Store.configured ? Store : null;

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const worldById = id => state.worlds.find(w => w.id === id);
const itemsIn = (worldId, kind) => state.items.filter(i => i.world === worldId && (!kind || i.kind === kind));
const sortedWorlds = () => [...state.worlds].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.t - b.t);

function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.className = ''; }, isError ? 6000 : 2600);
}

const ERRORS = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'permission-denied': 'You don’t have permission to do that.',
  'unavailable': 'You’re offline, and this isn’t saved on this phone yet.',
  'storage/retry-limit-exceeded': 'No connection. Check your internet and try again.',
  'storage/unauthorized': 'The server refused this photo. Sign out and back in, then try again.',
};
const friendlyError = e => ERRORS[e && e.code] || (e && e.message) || 'Something went wrong.';

// Disables a button while its action runs and shows any error as a toast.
async function busy(btn, fn, text = 'Saving…') {
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = text;
  try { return await fn(); } catch (e) { console.error(e); toast(friendlyError(e), true); } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

// ---------- pop-ups ----------
// While a pop-up is open, new data doesn't redraw the page underneath; it
// catches up when the pop-up closes.
let modalOpen = 0, missedRefresh = false;

function openModal(html, onMount, extraClass = '') {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${extraClass}" role="dialog" aria-modal="true">${html}</div>`;
  modalOpen++;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    bg.remove();
    modalOpen--;
    if (!modalOpen && missedRefresh) { missedRefresh = false; refresh(); }
  };
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  document.body.appendChild(bg);
  if (onMount) onMount(bg, close);
  return close;
}

function confirmBox(title, body, yes, onYes) {
  openModal(`<h2>${esc(title)}</h2><p>${esc(body)}</p>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn danger" id="yes">${esc(yes)}</button></div>`,
  (root, close) => $('#yes', root).onclick = e => busy(e.target, async () => { await onYes(); close(); }, 'Working…'));
}

/* One pop-up form for every kind of entry.
   fields: [{ key, label, type: 'text'|'textarea'|'url'|'photo'|'colors', placeholder, big }]
   onSave(values, { photo: prepared|null, dropPhoto }) ; onDelete optional. */
function formModal({ title, fields, values = {}, onSave, onDelete, deleteLabel = 'Delete', extra = '' }) {
  let prepared = null, dropPhoto = false;
  const fieldHtml = f => {
    const v = values[f.key];
    if (f.type === 'textarea') {
      return `<label class="field"><span class="field-label">${esc(f.label)}</span><textarea name="${f.key}" rows="${f.big ? 9 : 4}" placeholder="${esc(f.placeholder || '')}">${esc(v || '')}</textarea></label>`;
    }
    if (f.type === 'photo') {
      const cur = values.photo;
      return `<div class="field"><span class="field-label">${esc(f.label)}</span>
        <div class="photo-pick"><div class="photo-prev">${cur ? `<img src="${esc(cur.thumbUrl)}" alt="">` : '<span>No photo</span>'}</div>
        <div class="photo-btns"><label class="btn small">Choose photo<input type="file" accept="image/*" hidden data-photo></label>
        <button type="button" class="btn small ghost" data-drop ${cur ? '' : 'hidden'}>Remove</button></div></div></div>`;
    }
    if (f.type === 'colors') {
      const pal = f.palette, cur = v || [pal[0][1], pal[1][1]];
      const row = (n) => `<div class="swatches" data-slot="${n}">${pal.map(([name, c]) =>
        `<button type="button" class="swatch${cur[n] === c ? ' on' : ''}" style="--c:${c}" data-c="${c}" aria-label="${esc(name)}" title="${esc(name)}"></button>`).join('')}</div>`;
      return `<div class="field"><span class="field-label">${esc(f.label)}</span><div class="two-colors">${row(0)}<span class="amp">+</span>${row(1)}</div></div>`;
    }
    return `<label class="field"><span class="field-label">${esc(f.label)}</span><input name="${f.key}" type="${f.type === 'url' ? 'url' : 'text'}" value="${esc(v || '')}" placeholder="${esc(f.placeholder || '')}" ${f.type === 'url' ? 'inputmode="url" autocapitalize="off"' : ''}></label>`;
  };

  openModal(`<form id="mf" novalidate><h2>${esc(title)}</h2>${fields.map(fieldHtml).join('')}${extra}
    <div class="actions">${onDelete ? `<button type="button" class="btn ghost danger-text" id="del">${esc(deleteLabel)}</button>` : ''}<span class="spacer"></span>
    <button type="button" class="btn" data-close>Cancel</button><button class="btn primary" id="save">Save</button></div></form>`,
  (root, close) => {
    const colorPick = {};
    $$('.swatches', root).forEach(row => {
      const slot = +row.dataset.slot;
      colorPick[slot] = ($('.swatch.on', row) || $('.swatch', row)).dataset.c;
      row.onclick = e => {
        const b = e.target.closest('.swatch');
        if (!b) return;
        $$('.swatch', row).forEach(s => s.classList.toggle('on', s === b));
        colorPick[slot] = b.dataset.c;
      };
    });
    const fileIn = $('[data-photo]', root);
    if (fileIn) {
      fileIn.onchange = async () => {
        const file = fileIn.files[0];
        if (!file) return;
        try {
          prepared = await Photos.prepare(file);
          dropPhoto = false;
          $('.photo-prev', root).innerHTML = `<img src="${URL.createObjectURL(prepared.thumb.blob)}" alt="">`;
          $('[data-drop]', root).hidden = false;
        } catch (e) { toast(friendlyError(e), true); }
      };
      $('[data-drop]', root).onclick = e => {
        prepared = null; dropPhoto = true;
        $('.photo-prev', root).innerHTML = '<span>No photo</span>';
        e.target.hidden = true;
      };
    }
    if (onDelete) $('#del', root).onclick = () => { close(); onDelete(); };
    $('#mf', root).onsubmit = e => {
      e.preventDefault();
      const out = {};
      fields.forEach(f => {
        if (f.type === 'photo') return;
        if (f.type === 'colors') out[f.key] = [colorPick[0], colorPick[1]];
        else out[f.key] = root.querySelector(`[name="${f.key}"]`).value.trim();
      });
      busy($('#save', root), async () => {
        const ok = await onSave(out, { photo: prepared, dropPhoto });
        if (ok !== false) close();
      });
    };
    const first = $('input:not([type=file]),textarea', root);
    if (first && !values[first.name]) setTimeout(() => first.focus(), 60);
  });
}

// ---------- routing ----------
function parseHash() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

const THEME_COLOR = { library: '#16110e', avatar: '#efe3c8', twd: '#1f1e1a', hp: '#1a120c' };
function setPageTheme(world) {
  const body = document.body;
  if (world) Themes.apply(body, world);
  else { body.dataset.theme = 'library'; body.removeAttribute('style'); }
  const color = world ? (world.theme === 'custom' ? world.look.bg : THEME_COLOR[world.theme]) : THEME_COLOR.library;
  $('meta[name="theme-color"]').setAttribute('content', color);
}

function route() {
  const [page = '', id, sub, extra] = parseHash();
  $('#banner').hidden = !(DB && DB.demo);
  if (!DB) { setPageTheme(null); return renderSetupNeeded(); }
  if (!state.user) {
    setPageTheme(null);
    return page === 'reset' ? renderReset() : renderLogin();
  }
  if (!state.loaded) { setPageTheme(null); view.innerHTML = '<p class="loading">Opening the library…</p>'; return; }

  if (page === 'w') {
    const world = worldById(id);
    if (!world) { location.replace('#/'); return; }
    setPageTheme(world);
    if (sub === 'ship') return renderShip(world, extra);
    return sub === 'settings' ? renderWorldForm(world) : renderWorld(world, sub);
  }
  setPageTheme(null);
  if (page === 'new') return renderWorldForm(null);
  renderLibrary();
}

// Re-draw from fresh data, but never while a form is being filled in.
function refresh() {
  const [page, , sub] = parseHash();
  if (modalOpen || tileSorting) { missedRefresh = true; return; }
  if (page === 'new' || sub === 'settings') return;
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
}

let lastHash = null;
window.addEventListener('hashchange', () => {
  // Switching sections inside a world keeps your place near the tabs; anything else starts at the top.
  const [p1, id1] = (lastHash || '').replace(/^#\/?/, '').split('/');
  const [p2, id2] = parseHash();
  const sameWorld = p1 === 'w' && p2 === 'w' && id1 === id2;
  const y = window.scrollY;
  lastHash = location.hash;
  $$('.modal-bg').forEach(m => m.remove());
  modalOpen = 0;
  $$('.tile-ghost').forEach(g => g.remove());
  tileSorting = false;
  route();
  const tabs = $('.w-tabs');
  window.scrollTo(0, sameWorld && tabs ? Math.min(y, tabs.offsetTop) : 0);
});

// ---------- session ----------
function startSession() {
  DB.onAuth(async user => {
    state.unwatch.forEach(stop => stop());
    Object.assign(state, { user, settings: null, worlds: [], items: [], loaded: false, unwatch: [] });
    if (!user) return route();
    route();
    try { state.settings = await DB.loadSettings(); } catch (e) { console.error(e); toast(friendlyError(e), true); state.settings = {}; }
    const got = { worlds: false, items: false };
    const arrived = (key, list) => {
      state[key] = list;
      got[key] = true;
      if (state.loaded) { setTimeout(savePhotosForOffline, 3000); return refresh(); }
      if (got.worlds && got.items) {
        setTimeout(savePhotosForOffline, 3000);
        state.loaded = true;
        if (!state.settings.seeded && !state.worlds.length) seedStarters();
        route();
      }
    };
    const onError = e => { console.error(e); toast(friendlyError(e), true); };
    state.unwatch = [
      DB.watchWorlds(list => arrived('worlds', list), onError),
      DB.watchItems(list => arrived('items', list), onError),
    ];
  });
}

// The first time you sign in: Avatar, The Walking Dead and Harry Potter.
let seeding = false;
async function seedStarters() {
  if (seeding) return;
  seeding = true;
  try {
    const ids = [];
    for (const [i, w] of Themes.STARTERS.entries()) ids.push(await DB.addWorld({ ...w, order: i, watched: [], rounds: 0 }));
    for (const { world, ...item } of Themes.STARTER_ITEMS) await DB.addItem({ ...item, world: ids[world] });
    await DB.saveSettings({ seeded: true });
    state.settings.seeded = true;
    if (DB.demo) await DB.addSamples(ids);
  } catch (e) { console.error(e); toast(friendlyError(e), true); }
}

// ---------- setup / sign in ----------
function authShell(inner) {
  return `<div class="auth"><div class="auth-card">
    <div class="lib-crest" aria-hidden="true">${CREST}</div>
    <h1 class="lib-title">My Worlds</h1>${inner}</div></div>`;
}
// The little arched doorway on the library and sign-in screens.
const CREST = `<svg viewBox="0 0 64 64" width="56" height="56"><path d="M16 58V28a16 16 0 0 1 32 0v30" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M22 58V29a10 10 0 0 1 20 0v29" fill="currentColor" opacity=".16"/><path d="M8 58h48" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M32 14l1.4 3.2 3.4.3-2.6 2.2.8 3.3L32 21.3 29 23l.8-3.3-2.6-2.2 3.4-.3z" fill="currentColor"/><circle cx="24" cy="38" r="1" fill="currentColor"/><circle cx="40" cy="33" r="1.2" fill="currentColor"/><circle cx="35" cy="45" r=".9" fill="currentColor"/></svg>`;

function renderSetupNeeded() {
  view.innerHTML = authShell(`<p class="lib-sub">isn’t connected to Firebase yet.</p>
    <p class="muted small">The setup steps are in README.md. Until then you can look around in sample mode (nothing is saved).</p>
    <button class="btn primary block" id="sample" style="margin-top:18px">Try sample mode</button>`);
  $('#sample').onclick = startSample;
}

function startSample() {
  DB = DemoStore;
  try { sessionStorage.setItem('fw-sample', '1'); } catch {}
  startSession();
}

function renderLogin() {
  view.innerHTML = authShell(`<form id="f" novalidate>
    <label class="field"><span class="field-label">Email</span><input type="email" id="email" autocomplete="username" required></label>
    <label class="field"><span class="field-label">Password</span><input type="password" id="pw" autocomplete="current-password" required></label>
    <p class="error" id="err" hidden></p>
    <button class="btn primary block" style="margin-top:18px">Enter</button>
    <p class="center" style="margin-top:14px"><a class="small muted" href="#/reset">Forgot password?</a></p></form>`);
  $('#f').onsubmit = e => {
    e.preventDefault();
    const email = $('#email').value.trim(), pw = $('#pw').value, err = $('#err');
    if (!email || !pw) { err.textContent = 'Enter your email and password.'; err.hidden = false; return; }
    err.hidden = true;
    busy($('button', e.target), async () => {
      try { await DB.signIn(email, pw); location.hash = '#/'; } catch (x) { err.textContent = friendlyError(x); err.hidden = false; }
    }, 'Opening…');
  };
}

function renderReset() {
  view.innerHTML = authShell(`<form id="f" novalidate>
    <p class="muted small">We’ll email you a link to pick a new password.</p>
    <label class="field"><span class="field-label">Email</span><input type="email" id="email" autocomplete="username"></label>
    <p class="error" id="err" hidden></p>
    <button class="btn primary block" style="margin-top:18px">Send link</button>
    <p class="center" style="margin-top:14px"><a class="small muted" href="#/login">Back to sign in</a></p></form>`);
  $('#f').onsubmit = e => {
    e.preventDefault();
    const email = $('#email').value.trim(), err = $('#err');
    if (!email) { err.textContent = 'Enter your email.'; err.hidden = false; return; }
    busy($('button', e.target), async () => {
      try { await DB.resetPassword(email); toast('Link sent. Check your email.'); location.hash = '#/login'; } catch (x) { err.textContent = friendlyError(x); err.hidden = false; }
    }, 'Sending…');
  };
}

// ---------- library ----------
function tileHtml(w) {
  const photo = w.cardPhoto && w.cardPhoto.thumbUrl;
  return `<div class="tile${photo ? ' has-photo' : ''}" role="link" tabindex="0" data-world="${w.id}">
    <span class="tile-art" aria-hidden="true"></span>
    <span class="tile-name">${esc(w.name)}</span></div>`;
}

function renderLibrary() {
  const worlds = sortedWorlds();
  view.innerHTML = `<div class="library">
    <header class="lib-head"><div class="lib-crest" aria-hidden="true">${CREST}</div>
      <h1 class="lib-title">My Worlds</h1><p class="lib-sub">Pick a door and step inside — there’s no knowing where you might be swept off to.</p></header>
    <div class="shelf">${worlds.map(tileHtml).join('')}
      <a class="tile add-tile" href="#/new"><span class="plus" aria-hidden="true">+</span><span class="tile-name">Add a world</span></a></div>
    <p class="center lib-foot"><button class="linkish" id="out">Sign out</button></p></div>`;
  // Each tile wears its own world's look.
  $$('.tile[data-world]').forEach(el => {
    const w = worldById(el.dataset.world);
    Themes.apply(el, w); // (resets inline style for worlds you added, so the photo goes on after)
    if (w.cardPhoto) el.style.setProperty('--card-photo', `url('${w.cardPhoto.thumbUrl}')`);
    cardInk(el, w.cardInk);
  });
  $('#out').onclick = () => confirmBox('Sign out?', 'Your worlds stay saved in your account.', 'Sign out', () => DB.signOut());
  enableTileDrag($('.shelf'));
}

// Hold a door (about half a second) to pick it up, drag it, let go to drop.
// A quick tap still opens the world, and a swipe still scrolls the page.
let dragListeners = null; // the last library's listeners, removed when it redraws
let tileSorting = false;  // no redraws while a door is being dragged

// Doors aren't real links (an iPhone press-and-hold on a link opens its own
// preview and interrupts the drag), so a tap opens the world from here.
// Hold a door (about half a second) to pick it up, drag it, let go to drop.
// Touch drives it on the phone; the mouse (pointer events) on a computer.
function enableTileDrag(shelf) {
  if (dragListeners) dragListeners.abort();
  dragListeners = new AbortController();
  const opts = { signal: dragListeners.signal };
  $$('.tile-ghost').forEach(g => g.remove()); // leftovers from an interrupted drag
  tileSorting = false;

  const HOLD_MS = 450, SLOP = 10;
  let timer = null, start = null, tile = null, ghost = null, offset = null, dragging = false, justDragged = false;

  const tiles = () => $$('.tile[data-world]', shelf);
  const cancelHold = () => { clearTimeout(timer); timer = null; };
  const begin = (t, x, y) => { tile = t; start = { x, y }; cancelHold(); timer = setTimeout(pickUp, HOLD_MS); };

  function pickUp() {
    timer = null;
    if (!tile || !tile.isConnected) return;
    dragging = tileSorting = true;
    const r = tile.getBoundingClientRect();
    offset = { x: start.x - r.left, y: start.y - r.top };
    ghost = tile.cloneNode(true);
    ghost.classList.add('tile-ghost');
    Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    document.body.appendChild(ghost);
    tile.classList.add('tile-placeholder');
    shelf.classList.add('sorting');
  }

  function moveTo(x, y) {
    if (!ghost) return;
    ghost.style.left = `${x - offset.x}px`;
    ghost.style.top = `${y - offset.y}px`;
    const over = document.elementFromPoint(x, y);
    const target = over && over.closest('.tile[data-world]');
    if (!target || target === tile || !shelf.contains(target)) return;
    const list = tiles();
    shelf.insertBefore(tile, list.indexOf(target) > list.indexOf(tile) ? target.nextSibling : target);
  }

  // Always cleans up, even if the touch was interrupted.
  function drop() {
    if (ghost) ghost.remove();
    ghost = null;
    if (tile) tile.classList.remove('tile-placeholder');
    shelf.classList.remove('sorting');
    dragging = tileSorting = false;
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 350);
    const ids = tiles().map(t => t.dataset.world);
    const changed = ids.map((id, k) => [worldById(id), k]).filter(([w, k]) => w && w.order !== k);
    if (changed.length) {
      Promise.all(changed.map(([w, k]) => DB.updateWorld(w, { order: k })))
        .catch(e => { toast(friendlyError(e), true); refresh(); });
    }
    if (missedRefresh) { missedRefresh = false; setTimeout(refresh, 0); }
  }
  const end = () => { cancelHold(); if (dragging) drop(); };

  // ----- phone: touch -----
  shelf.addEventListener('touchstart', e => {
    const t = e.target.closest('.tile[data-world]');
    if (!t || e.touches.length > 1) return;
    begin(t, e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true, ...opts });
  shelf.addEventListener('touchmove', e => {
    const p = e.touches[0];
    if (dragging) { e.preventDefault(); moveTo(p.clientX, p.clientY); return; } // the finger moves the door, not the page
    if (timer && Math.hypot(p.clientX - start.x, p.clientY - start.y) > SLOP) cancelHold(); // it's a scroll
  }, { passive: false, ...opts });
  shelf.addEventListener('touchend', end, opts);
  shelf.addEventListener('touchcancel', end, opts);

  // ----- computer: mouse -----
  shelf.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button > 0) return;
    const t = e.target.closest('.tile[data-world]');
    if (t) begin(t, e.clientX, e.clientY);
  }, opts);
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    if (dragging) { moveTo(e.clientX, e.clientY); return; }
    if (timer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP) cancelHold();
  }, opts);
  window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') end(); }, opts);

  // ----- opening a world -----
  const open = t => { location.hash = `#/w/${t.dataset.world}`; };
  shelf.addEventListener('click', e => {
    const t = e.target.closest('.tile[data-world]');
    if (!t) return;
    if (dragging || justDragged) return;
    open(t);
  }, opts);
  shelf.addEventListener('keydown', e => {
    const t = e.target.closest('.tile[data-world]');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(t); }
  }, opts);
  shelf.addEventListener('contextmenu', e => { if (e.target.closest('.tile')) e.preventDefault(); }, opts);
}

// The world name's color on its home card (null = the theme's own, or white on a photo).
// Dark text gets a light fade behind it instead of a dark one.
const CARD_INKS = [['#ffffff', 'White'], ['#f3e9d2', 'Cream'], ['#e0b74a', 'Gold'], ['#b3261e', 'Red'], ['#1c1814', 'Black']];
function cardInk(el, ink) {
  el.classList.toggle('light-fade', !!ink && Themes.isDark(ink));
  el.classList.toggle('inked', !!ink);
  if (ink) el.style.setProperty('--card-ink', ink); else el.style.removeProperty('--card-ink');
}

// ---------- add / edit a world ----------
function trackToFields(track) {
  if (!track) return { type: 'none', seasons: '', noun: 'Film', items: '' };
  if (track.type === 'list') return { type: 'list', seasons: '', noun: track.noun || 'Film', items: track.items.join('\n') };
  return { type: 'episodes', seasons: track.seasons.join(', '), noun: track.noun || '', items: '' };
}

function readTrack(root, old) {
  const type = $('input[name=ttype]:checked', root).value;
  if (type === 'none') return null;
  if (type === 'list') {
    const items = $('#t-items', root).value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!items.length) throw new Error('Add at least one title to the rewatch list, or pick “No tracker”.');
    return { type: 'list', noun: $('#t-noun', root).value.trim() || 'Part', items };
  }
  const seasons = $('#t-seasons', root).value.split(/[^0-9]+/).map(Number).filter(n => n > 0);
  if (!seasons.length) throw new Error('Type how many episodes are in each season, like 10, 10, 8.');
  const out = { type: 'episodes', seasons };
  if (old && old.type === 'episodes' && old.noun) out.noun = old.noun;
  return out;
}

function renderWorldForm(world) {
  const isNew = !world;
  const custom = isNew || world.theme === 'custom';
  const look = { ...Themes.PRESETS[0], ...(world && world.look) };
  const tf = trackToFields(world ? world.track : { type: 'episodes', seasons: [] });
  const parts = world ? canonParts(world) : { ending: true, ships: true, headcanons: true };
  let prepared = null, dropPhoto = false;

  const lookHtml = !custom ? '' : `
    <h2 class="form-h">The look</h2>
    <div class="presets">${Themes.PRESETS.map((p, i) => `<button type="button" class="preset" data-i="${i}" style="--pbg:${p.bg};--pcard:${p.card};--pacc:${p.accent};--ptext:${Themes.isDark(p.bg) ? p.card : p.ink}"><span class="preset-dot"></span><span style="font-family:'${p.font}'">${esc(p.name)}</span></button>`).join('')}</div>
    <div class="color-grid">
      ${[['bg', 'Background'], ['card', 'Cards'], ['ink', 'Text'], ['accent', 'Accent']].map(([k, label]) =>
        `<label class="color-field"><input type="color" id="c-${k}" value="${esc(look[k])}"><span>${label}</span></label>`).join('')}
    </div>
    <label class="field"><span class="field-label">Title font</span><select id="font">${Themes.FONTS.map(f => `<option ${f === look.font ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
    <div class="field"><span class="field-label">Background photo (optional)</span>
      <div class="photo-btns"><label class="btn small">Choose photo<input type="file" accept="image/*" hidden id="bgfile"></label>
      <button type="button" class="btn small ghost" id="bgdrop" ${look.photo ? '' : 'hidden'}>Remove</button></div></div>
    <div class="preview-wrap"><span class="field-label">Preview</span><div class="w-preview" id="prev">
      <div class="w-preview-title" id="prev-title"></div><div class="w-preview-card">“A quote would sit here.”<span class="w-preview-pill">Board</span></div></div></div>`;

  view.innerHTML = `<div class="page form-page">
    <header class="w-head"><a class="back" href="${isNew ? '#/' : `#/w/${world.id}`}">‹ ${isNew ? 'Worlds' : 'Back'}</a></header>
    <h1 class="w-title small-title">${isNew ? 'Add a world' : 'World settings'}</h1>
    <form id="wf" novalidate class="card form-card">
      <label class="field"><span class="field-label">Name</span><input id="name" value="${esc(world ? world.name : '')}" placeholder="Narnia, Bridgerton, Star Wars…"></label>
      ${lookHtml}
      ${isNew ? '' : `<h2 class="form-h">Home page card</h2>
      <div class="card-pick">
        <div class="shelf-mini"><a class="tile" id="card-prev" tabindex="-1"><span class="tile-art" aria-hidden="true"></span><span class="tile-name">${esc(world.name)}</span></a></div>
        <div class="photo-btns"><label class="btn small">Choose photo<input type="file" accept="image/*" hidden id="cardfile"></label>
          <button type="button" class="btn small ghost" id="carddrop" ${world.cardPhoto ? '' : 'hidden'}>Use the theme instead</button></div>
      </div>
      <div class="field"><span class="field-label">Name color</span>
        <div class="swatches ink-swatches" id="inks">
          <button type="button" class="swatch auto${world.cardInk ? '' : ' on'}" data-ink="" aria-label="Automatic" title="Automatic">A</button>
          ${CARD_INKS.map(([c, n]) => `<button type="button" class="swatch${world.cardInk === c ? ' on' : ''}" style="--c:${c}" data-ink="${c}" aria-label="${n}" title="${n}"></button>`).join('')}
          <label class="swatch custom-ink${world.cardInk && !CARD_INKS.some(([c]) => c === world.cardInk) ? ' on' : ''}" title="Any color" style="--c:${esc(world.cardInk || '#8a6d3b')}"><input type="color" id="inkpick" value="${esc(world.cardInk || '#8a6d3b')}" aria-label="Any color"></label>
        </div></div>`}
      <h2 class="form-h">Rewatch tracker</h2>
      <div class="seg" role="radiogroup">
        ${[['episodes', 'A show'], ['list', 'Movies / books'], ['none', 'No tracker']].map(([v, l]) =>
          `<label><input type="radio" name="ttype" value="${v}" ${tf.type === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </div>
      <div data-t="episodes"><label class="field"><span class="field-label">Episodes in each season</span><input id="t-seasons" value="${esc(tf.seasons)}" placeholder="10, 10, 8" inputmode="numeric"></label></div>
      <div data-t="list">
        <label class="field"><span class="field-label">Each one is a…</span><input id="t-noun" value="${esc(tf.noun)}" placeholder="Film"></label>
        <label class="field"><span class="field-label">Titles in order, one per line</span><textarea id="t-items" rows="6">${esc(tf.items)}</textarea></label>
      </div>
      <h2 class="form-h">My Canon</h2>
      <label class="switch"><input type="checkbox" id="canon" ${!world || world.canonOn ? 'checked' : ''}><span class="track"></span><span>Include a My Canon section</span></label>
      <div class="canon-parts" id="parts">
        <span class="field-label">Show on My Canon</span>
        ${[['ending', 'My ending', 'where my story ends + how it really ends'], ['ships', 'Ships', 'with photos'], ['headcanons', 'Headcanons', '']].map(([k, label, hint]) =>
          `<label class="check"><input type="checkbox" data-part="${k}" ${parts[k] ? 'checked' : ''}><span>${label}${hint ? ` <span class="muted small">(${hint})</span>` : ''}</span></label>`).join('')}
      </div>
      <div class="actions"><span class="spacer"></span><a class="btn" href="${isNew ? '#/' : `#/w/${world.id}`}">Cancel</a><button class="btn primary" id="save">${isNew ? 'Create world' : 'Save'}</button></div>
    </form>
    ${isNew ? '' : `<div class="card form-card danger-zone">
      <div class="row-btns"><button class="btn small" id="up">Move earlier</button><button class="btn small" id="down">Move later</button></div>
      <button class="btn ghost danger-text block" id="del" style="margin-top:12px">Delete this world</button></div>`}
  </div>`;

  const root = $('#wf');
  const showTrack = () => {
    const t = $('input[name=ttype]:checked', root).value;
    $$('[data-t]', root).forEach(el => { el.hidden = el.dataset.t !== t; });
  };
  $$('input[name=ttype]', root).forEach(r => { r.onchange = showTrack; });
  showTrack();
  const showParts = () => { $('#parts').hidden = !$('#canon').checked; };
  $('#canon').onchange = showParts;
  showParts();

  if (custom) {
    const readLook = () => ({
      bg: $('#c-bg').value, card: $('#c-card').value, ink: $('#c-ink').value, accent: $('#c-accent').value, font: $('#font').value,
    });
    const drawPreview = () => {
      const l = readLook();
      const photoUrl = prepared ? URL.createObjectURL(prepared.thumb.blob) : (!dropPhoto && look.photo ? look.photo.url : null);
      Themes.apply($('#prev'), { theme: 'custom', look: { ...l, photo: photoUrl ? { url: photoUrl } : null } });
      $('#prev-title').textContent = $('#name').value.trim() || 'Your world';
    };
    $$('.preset').forEach(b => {
      b.onclick = () => {
        const p = Themes.PRESETS[+b.dataset.i];
        ['bg', 'card', 'ink', 'accent'].forEach(k => { $(`#c-${k}`).value = p[k]; });
        $('#font').value = p.font;
        drawPreview();
      };
    });
    $$('#wf input[type=color], #font, #name').forEach(el => { el.oninput = drawPreview; });
    $('#font').onchange = drawPreview;
    $('#bgfile').onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try { prepared = await Photos.prepare(file); dropPhoto = false; $('#bgdrop').hidden = false; drawPreview(); } catch (x) { toast(friendlyError(x), true); }
    };
    $('#bgdrop').onclick = e => { prepared = null; dropPhoto = true; e.target.hidden = true; drawPreview(); };
    Themes.FONTS.forEach(Themes.loadFont);
    drawPreview();

    root._readLook = readLook;
  }

  // Home page card photo: previewed here, saved with the rest of the form.
  let cardPrepared = null, cardDrop = false, ink = world ? world.cardInk || null : null;
  const drawCard = () => {
    const el = $('#card-prev');
    if (!el) return;
    Themes.apply(el, world);
    cardInk(el, ink);
    const url = cardPrepared ? URL.createObjectURL(cardPrepared.thumb.blob) : (!cardDrop && world.cardPhoto ? world.cardPhoto.thumbUrl : null);
    el.classList.toggle('has-photo', !!url);
    if (url) el.style.setProperty('--card-photo', `url('${url}')`);
  };
  if (!isNew) {
    drawCard();
    $('#cardfile').onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try { cardPrepared = await Photos.prepare(file); cardDrop = false; $('#carddrop').hidden = false; drawCard(); } catch (x) { toast(friendlyError(x), true); }
    };
    $('#carddrop').onclick = e => { cardPrepared = null; cardDrop = true; e.target.hidden = true; drawCard(); };
    const pickInk = (value, btn) => {
      ink = value || null;
      $$('#inks .swatch').forEach(s => s.classList.toggle('on', s === btn));
      drawCard();
    };
    $$('#inks button').forEach(b => { b.onclick = () => pickInk(b.dataset.ink, b); });
    $('#inkpick').oninput = e => {
      const lab = e.target.closest('.swatch');
      lab.style.setProperty('--c', e.target.value);
      pickInk(e.target.value, lab);
    };
  }

  root.onsubmit = e => {
    e.preventDefault();
    busy($('#save'), async () => {
      const name = $('#name').value.trim();
      if (!name) throw new Error('Give your world a name.');
      const track = readTrack(root, world && world.track);
      const canonPicked = Object.fromEntries($$('[data-part]', root).map(c => [c.dataset.part, c.checked]));
      const data = { name, track, canonOn: $('#canon').checked, canonParts: canonPicked };
      if (!isNew) data.cardInk = ink;
      if (data.canonOn && !Object.values(canonPicked).some(Boolean)) throw new Error('Pick at least one thing to show on My Canon, or turn it off.');
      if (custom) data.look = { ...root._readLook(), photo: dropPhoto ? null : (look.photo || null) };
      if (isNew) {
        const order = Math.max(-1, ...state.worlds.map(w => w.order ?? 0)) + 1;
        const id = await DB.addWorld({ ...data, theme: 'custom', order, cutoff: null, ending: '', watched: [], rounds: 0 }, prepared);
        location.hash = `#/w/${id}`;
      } else {
        // A shorter tracker can't point past its end.
        const last = Themes.steps(track).length - 1;
        data.watched = [...watchedOf(world)].filter(i => i <= last);
        data.cutoff = world.cutoff == null || world.cutoff > last ? null : world.cutoff;
        await DB.updateWorld(world, data, prepared, dropPhoto);
        if (cardPrepared) await DB.setCardPhoto(world, cardPrepared);
        else if (cardDrop && world.cardPhoto) await DB.setCardPhoto(world, null);
        toast('Saved');
        location.hash = `#/w/${world.id}`;
      }
    });
  };

  if (!isNew) {
    const move = dir => {
      const list = sortedWorlds();
      const i = list.findIndex(w => w.id === world.id), j = i + dir;
      if (j < 0 || j >= list.length) return toast(dir < 0 ? 'Already first.' : 'Already last.');
      [list[i], list[j]] = [list[j], list[i]];
      Promise.all(list.map((w, k) => (w.order === k ? null : DB.updateWorld(w, { order: k }))))
        .then(() => toast(dir < 0 ? 'Moved earlier' : 'Moved later'), e => toast(friendlyError(e), true));
    };
    $('#up').onclick = () => move(-1);
    $('#down').onclick = () => move(1);
    $('#del').onclick = () => {
      const inside = itemsIn(world.id);
      confirmBox(`Delete ${world.name}?`, `This deletes the world and everything in it (${inside.length} saved things, including photos). It can’t be undone.`, 'Delete', async () => {
        await DB.deleteWorld(world, inside);
        location.hash = '#/';
      });
    };
  }
}

// ---------- offline ----------
// A small bar while there's no signal. Everything still opens from the phone;
// text changes save there and sync when the signal comes back.
function drawOffline() { $('#offline-bar').hidden = navigator.onLine; }
window.addEventListener('online', () => { drawOffline(); savePhotosForOffline(); });
window.addEventListener('offline', drawOffline);
drawOffline();

// While online, quietly save a copy of every photo's small version on the
// phone (the service worker keeps them), so boards and cards show in airplane
// mode even for photos you haven't opened lately.
const savedPhotos = new Set();
let savingPhotos = false;
async function savePhotosForOffline() {
  if (savingPhotos || !navigator.onLine || !DB || DB.demo || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  savingPhotos = true;
  try {
    const urls = [...state.items.map(i => i.photo && i.photo.thumbUrl), ...state.worlds.map(w => w.cardPhoto && w.cardPhoto.thumbUrl),
      ...state.worlds.map(w => w.look && w.look.photo && w.look.photo.url)].filter(u => u && !savedPhotos.has(u));
    for (let k = 0; k < urls.length; k += 4) {
      await Promise.all(urls.slice(k, k + 4).map(u => fetch(u).then(() => savedPhotos.add(u), () => {})));
    }
  } finally { savingPhotos = false; }
}

// ---------- start ----------
lastHash = location.hash;
if (DB) startSession();
else {
  let sample = false;
  try { sample = sessionStorage.getItem('fw-sample') === '1'; } catch {}
  if (sample) startSample(); else route();
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Offline mode unavailable', e));
}
