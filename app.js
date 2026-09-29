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
const state = { user: null, settings: null, worlds: [], items: [], loaded: false, unwatch: [], filters: {}, shared: {} };
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
    if (f.type === 'check') {
      return `<label class="switch modal-switch"><input type="checkbox" name="${f.key}" ${v ? 'checked' : ''}><span class="track"></span><span>${esc(f.label)}</span></label>`;
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
        else if (f.type === 'check') out[f.key] = root.querySelector(`[name="${f.key}"]`).checked;
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

const THEME_COLOR = { library: '#16110e', avatar: '#efe3c8', twd: '#1f1e1a', hp: '#1a120c', disney: '#171a3d', lotr: '#121812', narnia: '#16222f', got: '#14161a', firefly: '#141a26', tlou: '#1b211c', potc: '#0f1f26' };
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
    return page === 'reset' ? renderReset() : page === 'signup' ? renderSignup() : renderLogin();
  }
  if (state.needsInvite) { setPageTheme(null); return renderInvite(); }
  if (!state.loaded) { setPageTheme(null); view.innerHTML = '<p class="loading">Opening the library…</p>'; return; }
  if (state.importing) return; // share.js shows its own progress

  if (page === 'w') {
    const world = worldById(id);
    if (!world) { location.replace('#/'); return; }
    setPageTheme(world);
    if (sub === 'ship') return renderShip(world, extra);
    return sub === 'settings' ? renderWorldForm(world) : renderWorld(world, sub);
  }
  setPageTheme(null);
  if (page !== 'new') wishToOpen = null;
  if (page === 'new') return renderWorldForm(null);
  if (page === 'wishlist') return renderWishlist();
  if (page === 'share') return renderShare();
  if (page === 'library') return renderLibraryPick();
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
  DB.onAuth(openAccount);
}

// The invite code comes in on the link (…/?invite=CODE) and is kept on this
// phone so "Create account" can use it.
function savedInvite() {
  try {
    const fromLink = new URLSearchParams(location.search).get('invite');
    if (fromLink) localStorage.setItem('fw-invite', fromLink.trim());
    return localStorage.getItem('fw-invite') || '';
  } catch { return ''; }
}

async function openAccount(user) {
    state.unwatch.forEach(stop => stop());
    stopAllShared();
    Object.assign(state, { user, settings: null, worlds: [], items: [], loaded: false, unwatch: [], needsInvite: false, shared: {} });
    if (!user) return route();
    route();
    try { state.settings = await DB.loadSettings(); } catch (e) { console.error(e); toast(friendlyError(e), true); state.settings = {}; }
    // A login that hasn't joined yet needs the invite code once.
    if (state.settings === null) {
      const code = savedInvite();
      state.settings = code ? await DB.join(code).catch(() => null) : null;
      if (!state.settings) { state.needsInvite = true; return route(); }
    }
    if (state.settings.libraryMode || state.settings.sharedFrom) {
      DB.loadWallpapers().then(w => { state.wallpapers = w; if (parseHash()[0] === 'library') refresh(); }).catch(() => {});
    }
    const got = { worlds: false, items: false };
    const arrived = (key, list) => {
      state[key] = list;
      got[key] = true;
      if (key === 'worlds') syncSharedWatches();
      if (state.loaded) { setTimeout(savePhotosForOffline, 3000); return refresh(); }
      if (got.worlds && got.items) {
        setTimeout(savePhotosForOffline, 3000);
        state.loaded = true;
        firstRun();
        route();
        setTimeout(offerJoins, 1500);
      }
      publishWallpapers();
    };
    const onError = e => { console.error(e); toast(friendlyError(e), true); };
    state.unwatch = [
      DB.watchWorlds(list => arrived('worlds', list), onError),
      DB.watchItems(list => arrived('items', list), onError),
    ];
}

// First time on a brand-new account: a copy someone shared (share.js) wins
// over the built-in starters.
async function firstRun() {
  const s = state.settings;
  if (!s.seeded && !state.worlds.length && DB.loadShare) {
    const share = await DB.loadShare().catch(e => { console.error(e); return null; });
    if (share) return importShare(share);
  }
  // Joined with the invite: they choose their own doors from the Library.
  if (s.libraryMode && !s.seeded && !state.worlds.length) { location.hash = '#/library'; return; }
  await seedStarters();
  // Already has worlds? A copy that arrived later is offered, not forced.
  if (state.worlds.length && DB.loadShare) {
    const share = await DB.loadShare().catch(e => { console.error(e); return null; });
    if (share) offerShare(share);
  }
}

// The built-in worlds (themes.js STARTERS). The first sign-in gets all of
// them; a built-in added later (like Lord of the Rings) shows up once in an
// existing account. settings.seededThemes remembers which were given, so one
// you delete doesn't come back.
let seeding = false;
async function seedStarters() {
  if (seeding) return;
  const s = state.settings;
  if (s.libraryMode) return; // they add built-in worlds from the Library instead
  const given = s.seededThemes || (s.seeded || state.worlds.length ? ['avatar', 'twd', 'hp'] : []);
  const todo = Themes.STARTERS.map((w, i) => [w, i]).filter(([w]) => !given.includes(w.theme) && !state.worlds.some(x => x.theme === w.theme));
  if (!todo.length && s.seededThemes) return;
  seeding = true;
  try {
    const firstTime = !state.worlds.length;
    let order = Math.max(-1, ...state.worlds.map(w => w.order ?? 0)) + 1;
    const ids = {};
    for (const [w, i] of todo) ids[i] = await DB.addWorld({ ...w, order: order++, watched: [], rounds: 0 });
    for (const { world, ...item } of Themes.STARTER_ITEMS) if (ids[world]) await DB.addItem({ ...item, world: ids[world] });
    const all = Themes.STARTERS.map(w => w.theme);
    await DB.saveSettings({ seeded: true, seededThemes: all });
    Object.assign(s, { seeded: true, seededThemes: all });
    if (DB.demo && firstTime) await DB.addSamples(Object.values(ids));
  } catch (e) { console.error(e); toast(friendlyError(e), true); }
  seeding = false;
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
    <p class="center" style="margin-top:14px"><a class="small muted" href="#/reset">Forgot password?</a></p>
    ${savedInvite() ? '<p class="center" style="margin-top:22px"><a class="btn block" href="#/signup">New here? Create an account</a></p>' : ''}</form>`);
  $('#f').onsubmit = e => {
    e.preventDefault();
    const email = $('#email').value.trim(), pw = $('#pw').value, err = $('#err');
    if (!email || !pw) { err.textContent = 'Enter your email and password.'; err.hidden = false; return; }
    err.hidden = true;
    busy($('button', e.target), async () => {
      try { await DB.signIn(email, pw); if (/^#\/(login|reset)?$/.test(location.hash) || !location.hash) location.hash = '#/'; } catch (x) { err.textContent = friendlyError(x); err.hidden = false; }
    }, 'Opening…');
  };
}

function renderSignup() {
  view.innerHTML = authShell(`<form id="f" novalidate>
    <p class="muted small">Make your own account. Everything you add stays private to you.</p>
    <label class="field"><span class="field-label">Email</span><input type="email" id="email" autocomplete="username"></label>
    <label class="field"><span class="field-label">Password (at least 6 characters)</span><input type="password" id="pw" autocomplete="new-password"></label>
    <label class="field"><span class="field-label">Invite code</span><input id="code" value="${esc(savedInvite())}" autocapitalize="off" autocomplete="off"></label>
    <p class="error" id="err" hidden></p>
    <button class="btn primary block" style="margin-top:18px">Create account</button>
    <p class="center" style="margin-top:14px"><a class="small muted" href="#/login">I already have an account</a></p></form>`);
  $('#f').onsubmit = e => {
    e.preventDefault();
    const email = $('#email').value.trim(), pw = $('#pw').value, code = $('#code').value.trim(), err = $('#err');
    const fail = msg => { err.textContent = msg; err.hidden = false; };
    if (!email || !pw || !code) return fail('Fill in your email, a password and the invite code.');
    if (pw.length < 6) return fail('Pick a password with at least 6 characters.');
    err.hidden = true;
    busy($('button', e.target), async () => {
      try { localStorage.setItem('fw-invite', code); } catch {}
      try {
        await DB.createAccount(email, pw);
        location.hash = '#/';
      } catch (x) {
        fail(x.code === 'auth/email-already-in-use' ? 'That email already has an account. Try signing in.'
          : x.code === 'auth/weak-password' ? 'Pick a longer password.'
          : x.code === 'auth/operation-not-allowed' || x.code === 'auth/admin-restricted-operation' ? 'New accounts are turned off right now.'
          : friendlyError(x));
      }
    }, 'Creating…');
  };
}

// Signed in, but this login hasn't joined with the invite code yet.
function renderInvite() {
  view.innerHTML = authShell(`<form id="f" novalidate>
    <p class="muted small">One more step: enter the invite code you were given.</p>
    <label class="field"><span class="field-label">Invite code</span><input id="code" autocapitalize="off" autocomplete="off"></label>
    <p class="error" id="err" hidden></p>
    <button class="btn primary block" style="margin-top:18px">Join</button>
    <p class="center" style="margin-top:14px"><button type="button" class="linkish" id="out">Sign out</button></p></form>`);
  $('#out').onclick = () => DB.signOut();
  $('#f').onsubmit = e => {
    e.preventDefault();
    const code = $('#code').value.trim(), err = $('#err');
    busy($('button', e.target), async () => {
      try {
        await DB.join(code);
        try { localStorage.setItem('fw-invite', code); } catch {}
        openAccount(state.user);
      } catch (x) { err.textContent = 'That invite code isn’t right.'; err.hidden = false; }
    }, 'Joining…');
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
    <span class="tile-name">${esc(plainName(w))}${w.sharedId ? `<span class="tile-sub">${esc(sharedWithLine(w))}</span>` : ''}</span></div>`;
}

function renderLibrary() {
  const worlds = sortedWorlds();
  const nick = (state.settings && state.settings.displayName) || '';
  view.innerHTML = `<div class="library">
    ${nick ? `<p class="lib-me">${esc(nick)}</p>` : ''}
    <header class="lib-head"><button class="lib-crest crest-link" id="crest" aria-label="Menu">${CREST}</button>
      <h1 class="lib-title">My Worlds</h1><p class="lib-sub">Pick a door and step inside — there’s no knowing where you might be swept off to.</p></header>
    <div class="shelf">${worlds.map(tileHtml).join('')}</div>
    ${worlds.length ? '' : '<p class="empty">No doors yet. Tap the doorway above to add one.</p>'}</div>`;
  // Each tile wears its own world's look.
  $$('.tile[data-world]').forEach(el => {
    const w = worldById(el.dataset.world);
    Themes.apply(el, w); // (resets inline style for worlds you added, so the photo goes on after)
    if (w.cardPhoto) el.style.setProperty('--card-photo', `url('${w.cardPhoto.thumbUrl}')`);
    cardInk(el, w.cardInk);
    cardPos(el, w.cardPos);
    el.classList.toggle('no-shade', w.cardShade === false);
  });
  // The doorway icon hides everything that isn't a door.
  $('#crest').onclick = () => openModal(`<div class="crest-menu">
      <button class="btn block ghost name-row" id="nick"><span class="muted small">Your name</span><span>${esc(nick || 'Add your name')}</span></button>
      <a class="btn block" href="#/library" data-close>+ Add a world</a>
      <a class="btn block" href="#/wishlist" data-close>Wishlist</a>
      <button class="btn block ghost" id="out">Sign out</button>
      <button class="linkish danger-text" id="gone">Delete my account</button></div>`, (root, close) => {
    $('#out', root).onclick = () => { close(); confirmBox('Sign out?', 'Your worlds stay saved in your account.', 'Sign out', () => DB.signOut()); };
    $('#gone', root).onclick = () => { close(); deleteAccountFlow(); };
    $('#nick', root).onclick = () => { close(); nicknameForm(); };
  }, 'small-modal');
  enableTileDrag($('.shelf'));
}

// Your name or nickname: top left of the home page, and filled in when you share a world.
function nicknameForm() {
  formModal({
    title: 'Your name',
    values: { name: (state.settings && state.settings.displayName) || '' },
    fields: [{ key: 'name', label: 'Name or nickname', placeholder: 'Gabriella' }],
    onSave: async v => {
      await DB.saveSettings({ displayName: v.name });
      state.settings.displayName = v.name;
      if (!parseHash()[0]) renderLibrary();
    },
  });
}

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
// Where the name sits on the card: 'top|middle|bottom' + '-' + 'left|center|right' (null = the theme's spot).
const POS_V = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
const POS_H = { left: 'flex-start', center: 'center', right: 'flex-end' };
function cardPos(el, pos) {
  const [v, h] = (pos || '').split('-');
  el.classList.toggle('positioned', !!(POS_V[v] && POS_H[h]));
  el.classList.toggle('pos-top', POS_V[v] && POS_H[h] && v === 'top');
  el.classList.toggle('pos-bottom', POS_V[v] && POS_H[h] && v === 'bottom');
  if (POS_V[v] && POS_H[h]) {
    el.style.setProperty('--pos-v', POS_V[v]);
    el.style.setProperty('--pos-h', POS_H[h]);
    el.style.setProperty('--pos-t', h);
  }
}

function cardInk(el, ink) {
  el.classList.toggle('light-fade', !!ink && Themes.isDark(ink));
  el.classList.toggle('inked', !!ink);
  if (ink) el.style.setProperty('--card-ink', ink); else el.style.removeProperty('--card-ink');
}

// ---------- wishlist (tap the doorway above "My Worlds") ----------
// Ideas for future worlds: items of kind 'wish' that belong to no world.
let wishToOpen = null;

function wishForm(w) {
  formModal({
    title: w ? 'Edit' : 'Add to the wishlist',
    values: w || {},
    fields: [
      { key: 'text', label: 'Show, movie or book', placeholder: 'Bridgerton' },
      { key: 'toWatch', label: 'I haven’t watched it yet', type: 'check' },
      { key: 'note', label: 'Notes (optional)', type: 'textarea', placeholder: 'Who recommended it, the look, ships…' },
    ],
    onSave: async v => {
      if (!v.text) throw new Error('Name the world.');
      if (w) await DB.updateItem(w, v); else await DB.addItem({ world: null, kind: 'wish', ...v });
    },
    onDelete: w && (() => confirmBox(`Remove ${w.text}?`, '', 'Remove', () => DB.deleteItem(w))),
  });
}

function renderWishlist() {
  const wishes = state.items.filter(i => i.kind === 'wish').sort((a, b) => (a.t || 0) - (b.t || 0));
  const card = w => `<div class="wish card">
      <button class="wish-main" data-id="${w.id}"><span class="wish-name">${esc(w.text)}</span>${w.note ? `<span class="wish-note">${esc(w.note)}</span>` : ''}</button>
      <button class="btn small wish-open" data-open="${w.id}">${w.toWatch ? 'Start watching · open a door' : 'Open this door'}</button></div>`;
  const group = (title, list) => (list.length ? `<h2 class="sec-h">${title}</h2><div class="wishes">${list.map(card).join('')}</div>` : '');
  view.innerHTML = `<div class="page wishlist">
    <header class="w-head"><a class="back" href="#/">‹ Worlds</a></header>
    <header class="lib-head"><div class="lib-crest" aria-hidden="true">${CREST}</div>
      <h1 class="lib-title">Wishlist</h1><p class="lib-sub">Things to watch, and doors I’d like to open someday.</p></header>
    <button class="btn primary add-btn" id="addw"><span aria-hidden="true">+</span> Add to the wishlist</button>
    ${wishes.length
      ? group('To watch', wishes.filter(w => w.toWatch)) + group('Door ideas', wishes.filter(w => !w.toWatch))
      : '<p class="empty">Nothing yet. What world comes next?</p>'}
  </div>`;
  $('#addw').onclick = () => wishForm();
  $$('.wish-main').forEach(b => { b.onclick = () => wishForm(state.items.find(i => i.id === b.dataset.id)); });
  $$('.wish-open').forEach(b => { b.onclick = () => { wishToOpen = b.dataset.open; location.hash = '#/new'; }; });
}

// ---------- add / edit a world ----------
function trackToFields(track) {
  if (!track) return { type: 'none', seasons: '', noun: 'Film', items: '' };
  if (track.type === 'collection') {
    let lines = track.items, at = 0;
    if (track.sections) {
      lines = [];
      track.sections.forEach(({ name, count }) => { lines.push(`# ${name}`, ...track.items.slice(at, at + count)); at += count; });
    }
    return { type: 'collection', seasons: '', noun: 'Film', items: '', coll: lines.join('\n') };
  }
  if (track.type === 'list') {
    // Sections show as "# Heading" lines in the text box.
    let lines = track.items;
    if (track.sections) {
      lines = [];
      let at = 0;
      track.sections.forEach(({ name, count }) => { lines.push(`# ${name}`, ...track.items.slice(at, at + count)); at += count; });
    }
    return { type: 'list', seasons: '', noun: track.noun || 'Film', items: lines.join('\n') };
  }
  // Typed episode titles show as lines, with a "# season name" line before every season.
  let titles = '';
  const names = track.seasonNames || [];
  if ((track.titles && track.titles.some(Boolean)) || names.some(Boolean)) {
    let at = 0;
    titles = track.seasons.map((n, s) => {
      const lines = (track.titles || []).slice(at, at + n).map(t => t || '');
      at += n;
      while (lines.length && !lines[lines.length - 1]) lines.pop();
      return [`# ${names[s] || `Season ${s + 1}`}`, ...lines].join('\n');
    }).join('\n');
  }
  return { type: 'episodes', seasons: track.seasons.join(', '), noun: track.noun || '', items: '', titles };
}

function readTrack(root, old) {
  const type = $('input[name=ttype]:checked', root).value;
  if (type === 'none') return null;
  if (type === 'collection') {
    // Like a movie list with # sections, plus shows written "Title [22, 22, 13]".
    const lines = $('#t-coll', root).value.split('\n').map(s => s.trim()).filter(Boolean);
    const items = [], sections = [];
    lines.forEach(l => {
      if (l.startsWith('#')) sections.push({ name: l.replace(/^#+\s*/, '') || 'More', count: 0 });
      else { items.push(l); if (sections.length) sections[sections.length - 1].count++; }
    });
    if (!items.length) throw new Error('Add at least one movie or show to the collection.');
    const out = { type: 'collection', items };
    if (sections.length) {
      const before = items.length - sections.reduce((n, s) => n + s.count, 0);
      if (before) sections.unshift({ name: 'More', count: before });
      out.sections = sections.filter(s => s.count);
    }
    // Typed episode titles stay only if the list didn't change.
    if (old && old.type === 'collection' && old.titles && old.items.join('\n') === items.join('\n')) out.titles = old.titles;
    return out;
  }
  if (type === 'list') {
    const lines = $('#t-items', root).value.split('\n').map(s => s.trim()).filter(Boolean);
    const items = [], sections = [];
    lines.forEach(l => {
      if (l.startsWith('#')) sections.push({ name: l.replace(/^#+\s*/, '') || 'More', count: 0 });
      else { items.push(l); if (sections.length) sections[sections.length - 1].count++; }
    });
    if (!items.length) throw new Error('Add at least one title to the rewatch list, or pick “No tracker”.');
    const out = { type: 'list', noun: $('#t-noun', root).value.trim() || 'Part', items };
    if (sections.length) {
      const before = items.length - sections.reduce((n, s) => n + s.count, 0);
      if (before) sections.unshift({ name: 'More', count: before }); // titles above the first heading
      out.sections = sections.filter(s => s.count);
    }
    if (old && old.shuffle) out.shuffle = true;
    if (old && old.labels && old.items.join('\n') === items.join('\n')) out.labels = old.labels;
    return out;
  }
  const seasons = $('#t-seasons', root).value.split(/[^0-9]+/).map(Number).filter(n => n > 0);
  if (!seasons.length) throw new Error('Type how many episodes are in each season, like 10, 10, 8.');
  const out = { type: 'episodes', seasons };
  if (old && old.type === 'episodes' && old.noun) out.noun = old.noun;
  // Optional typed titles: one per line in order; "# Season 3" jumps to that season.
  if ($('#t-named', root).checked) {
    const starts = seasons.map((_, s) => seasons.slice(0, s).reduce((a, b) => a + b, 0));
    const total = seasons.reduce((a, b) => a + b, 0);
    const titles = Array(total).fill('');
    let at = 0;
    // Every line is one episode (an empty line = no title yet). Each "#" line starts
    // the next season, and whatever follows the # is that season's name, as written.
    const lines = $('#t-titles', root).value.split('\n').map(l => l.trim());
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    let season = -1;
    const seasonNames = seasons.map(() => '');
    lines.forEach(l => {
      if (l.startsWith('#')) {
        season++;
        if (season < seasons.length) seasonNames[season] = l.replace(/^#+\s*/, '');
        if (starts[season] != null) at = starts[season]; else at = total;
        return;
      }
      if (at < total) titles[at++] = l;
    });
    // Names that just say "Season 3" for season 3 aren't worth storing.
    const custom = seasonNames.map((n, s) => (n && n.toLowerCase() !== `season ${s + 1}` ? n : ''));
    if (custom.some(Boolean)) out.seasonNames = custom;
    if (titles.some(Boolean)) out.titles = titles;
  }
  return out;
}

function renderWorldForm(world) {
  const isNew = !world;
  // Opened from a wishlist idea: its name is filled in, and it leaves the list once the world exists.
  const fromWish = isNew && wishToOpen ? state.items.find(i => i.id === wishToOpen) : null;
  const custom = isNew || world.theme === 'custom';
  const look = { ...Themes.PRESETS[0], ...(world && world.look) };
  // A shared world's tracker lives with the group; only the person who shared it changes it.
  const sharedW = !!(world && world.sharedId && sectionShared(world, 'rewatch'));
  const lockTrack = sharedW && !isSharedOwner(world);
  const tf = trackToFields(world ? withShared(world).track : { type: 'episodes', seasons: [] });
  const parts = world ? canonParts(world) : { ending: true, ships: true, headcanons: true };
  let prepared = null, dropPhoto = false;

  const lookHtml = !custom ? '' : `
    <h2 class="form-h">The look</h2>
    <div class="presets">${Themes.PRESETS.map((p, i) => `<button type="button" class="preset" data-i="${i}" style="--pbg:${p.bg};--pcard:${p.card};--pacc:${p.accent};--ptext:${Themes.isDark(p.bg) ? (Themes.isDark(p.card) ? p.ink : p.card) : (Themes.isDark(p.ink) ? p.ink : p.card)}"><span class="preset-dot"></span><span style="font-family:'${p.font}'">${esc(p.name)}</span></button>`).join('')}</div>
    <div class="color-grid">
      ${[['bg', 'Background'], ['card', 'Cards'], ['ink', 'Text'], ['accent', 'Accent']].map(([k, label]) =>
        `<label class="color-field"><input type="color" id="c-${k}" value="${esc(look[k])}"><span>${label}</span></label>`).join('')}
    </div>
    <label class="field"><span class="field-label">Title font</span><select id="font">${Themes.FONTS.map(f => `<option ${f === look.font ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
    <div class="field"><span class="field-label">Background photo (optional)</span>
      <div class="photo-btns"><label class="btn small">Choose photo<input type="file" accept="image/*" hidden id="bgfile"></label>
      <button type="button" class="btn small ghost" id="bgdrop" ${look.photo ? '' : 'hidden'}>Remove</button></div>
      <label class="switch" id="tintwrap" ${look.photo ? '' : 'hidden'}><input type="checkbox" id="tint" ${look.tint === false ? '' : 'checked'}><span class="track"></span><span>Tint photo with background color</span></label></div>
    <div class="preview-wrap"><span class="field-label">Preview</span><div class="w-preview" id="prev">
      <div class="w-preview-title" id="prev-title"></div><div class="w-preview-card">“A quote would sit here.”<span class="w-preview-pill">Board</span></div></div></div>`;

  view.innerHTML = `<div class="page form-page">
    <header class="w-head"><a class="back" href="${isNew ? '#/' : `#/w/${world.id}`}">‹ ${isNew ? 'Worlds' : 'Back'}</a></header>
    <h1 class="w-title small-title">${isNew ? 'Add a world' : 'World settings'}</h1>
    <form id="wf" novalidate class="card form-card">
      <label class="field"><span class="field-label">Name</span><input id="name" value="${esc(world ? world.name : (fromWish && fromWish.text) || '')}" placeholder="Narnia, Bridgerton, Star Wars…"></label>
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
        </div></div>
      <label class="switch"><input type="checkbox" id="shade" ${world.cardShade === false ? '' : 'checked'}><span class="track"></span><span>Shade behind the name (on photos)</span></label>
      <div class="field"><span class="field-label">Name position</span>
        <div class="pos-pick">
          <div class="pos-grid" id="poses">${['top', 'middle', 'bottom'].map(v => ['left', 'center', 'right'].map(h =>
            `<button type="button" class="pos-cell${world.cardPos === `${v}-${h}` ? ' on' : ''}" data-pos="${v}-${h}" aria-label="${v} ${h}" title="${v} ${h}"><span></span></button>`).join('')).join('')}</div>
          <button type="button" class="btn small${world.cardPos ? '' : ' on-auto'}" id="posauto">Auto</button>
        </div></div>`}
      <h2 class="form-h">Rewatch tracker</h2>
      ${sharedW ? `<p class="muted small">${lockTrack ? 'This tracker is shared. Only the person who shared it can change it.' : 'This tracker is shared, so changes here update it for everyone.'}</p>` : ''}
      <fieldset class="plain-fieldset" ${lockTrack ? 'disabled' : ''}>
      <div class="seg" role="radiogroup">
        ${[['episodes', 'A show'], ['list', 'Movies / books'], ['collection', 'Collection'], ['none', 'No tracker']].map(([v, l]) =>
          `<label><input type="radio" name="ttype" value="${v}" ${tf.type === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </div>
      <div data-t="episodes"><label class="field"><span class="field-label">Episodes in each season (commas or spaces)</span><input id="t-seasons" value="${esc(tf.seasons)}" placeholder="10, 10, 8" autocomplete="off" autocorrect="off"></label>
        <label class="switch"><input type="checkbox" id="t-named" ${tf.titles ? 'checked' : ''}><span class="track"></span><span>Add episode titles</span></label>
        <label class="field" id="t-titles-wrap" ${tf.titles ? '' : 'hidden'}><span class="field-label">Episode titles</span><span class="muted small field-hint">Start each season with a # and the season number or title (examples: # Season 1, # Part 1, # The Beginning). Then list the episode titles underneath, one per line. Or add them one at a time later: tap an episode’s name on the Rewatch card.</span><textarea id="t-titles" rows="8" placeholder="# Season 1&#10;Pilot&#10;The Second One&#10;# Season 2&#10;…">${esc(tf.titles || '')}</textarea></label></div>
      <div data-t="collection">
        <label class="field"><span class="field-label">Movies and shows, by section</span><span class="muted small field-hint">Start each section with a # (like # Batman). Then one movie or show per line, in the order you want. For a show, add its episodes per season in brackets: Gotham [22, 22, 22, 12, 12]. The same title in two sections counts as one.</span><textarea id="t-coll" rows="10" placeholder="# Batman&#10;Batman Begins (2005)&#10;Gotham [22, 22, 22, 12, 12]&#10;Justice League (2017)&#10;# Superman&#10;Man of Steel (2013)&#10;Justice League (2017)">${esc(tf.coll || '')}</textarea></label>
      </div>
      <div data-t="list">
        <label class="field"><span class="field-label">Each one is a…</span><input id="t-noun" value="${esc(tf.noun)}" placeholder="Film"></label>
        <label class="field"><span class="field-label">Titles in order, one per line (a line starting with # makes a section)</span><textarea id="t-items" rows="6">${esc(tf.items)}</textarea></label>
      </div>
      ${isNew || !(world.rounds > 0) ? `<label class="switch" data-t-any><input type="checkbox" id="first" ${(world && world.firstWatch) || (fromWish && fromWish.toWatch) ? 'checked' : ''}><span class="track"></span><span>I’m watching this for the first time</span></label>` : ''}
      </fieldset>
      <h2 class="form-h">Fics</h2>
      <label class="switch"><input type="checkbox" id="fics" ${!world || world.ficsOn !== false ? 'checked' : ''}><span class="track"></span><span>Include a Fics section</span></label>
      <h2 class="form-h">My Canon</h2>
      <label class="switch"><input type="checkbox" id="canon" ${!world || world.canonOn ? 'checked' : ''}><span class="track"></span><span>Include a My Canon section</span></label>
      <div class="canon-parts" id="parts">
        <span class="field-label">Show on My Canon</span>
        ${[['ending', 'My ending', 'where my story ends + how it really ends'], ['ships', 'Ships', 'with photos'], ['headcanons', 'Headcanons', '']].map(([k, label, hint]) =>
          `<label class="check"><input type="checkbox" data-part="${k}" ${parts[k] ? 'checked' : ''}><span>${label}${hint ? ` <span class="muted small">(${hint})</span>` : ''}</span></label>`).join('')}
      </div>
      <div class="actions"><span class="spacer"></span><a class="btn" href="${isNew ? '#/' : `#/w/${world.id}`}">Cancel</a><button class="btn primary" id="save">${isNew ? 'Create world' : 'Save'}</button></div>
    </form>
    ${isNew || DB.demo === undefined ? '' : `<div class="card form-card share-card">${shareSettingsHtml(world)}</div>`}
    ${isNew ? '' : `<div class="card form-card danger-zone">
      <div class="row-btns"><button class="btn small" id="up">Move earlier</button><button class="btn small" id="down">Move later</button></div>
      <button class="btn ghost danger-text block" id="del" style="margin-top:12px">Delete this world</button></div>`}
  </div>`;

  const root = $('#wf');
  const showTrack = () => {
    const t = $('input[name=ttype]:checked', root).value;
    $$('[data-t]', root).forEach(el => { el.hidden = el.dataset.t !== t; });
    const fw = $('[data-t-any]', root);
    if (fw) fw.hidden = t === 'none';
  };
  $$('input[name=ttype]', root).forEach(r => { r.onchange = showTrack; });
  showTrack();
  $('#t-named').onchange = e => { $('#t-titles-wrap').hidden = !e.target.checked; };
  const showParts = () => { $('#parts').hidden = !$('#canon').checked; };
  $('#canon').onchange = showParts;
  showParts();

  if (custom) {
    const readLook = () => ({
      bg: $('#c-bg').value, card: $('#c-card').value, ink: $('#c-ink').value, accent: $('#c-accent').value, font: $('#font').value,
      tint: $('#tint').checked,
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
      try { prepared = await Photos.prepare(file); dropPhoto = false; $('#bgdrop').hidden = false; $('#tintwrap').hidden = false; drawPreview(); } catch (x) { toast(friendlyError(x), true); }
    };
    $('#bgdrop').onclick = e => { prepared = null; dropPhoto = true; e.target.hidden = true; $('#tintwrap').hidden = true; drawPreview(); };
    $('#tint').onchange = drawPreview;
    Themes.FONTS.forEach(Themes.loadFont);
    drawPreview();

    root._readLook = readLook;
  }

  // Home page card photo: previewed here, saved with the rest of the form.
  let cardPrepared = null, cardDrop = false, ink = world ? world.cardInk || null : null, pos = world ? world.cardPos || null : null;
  const drawCard = () => {
    const el = $('#card-prev');
    if (!el) return;
    Themes.apply(el, world);
    cardInk(el, ink);
    cardPos(el, pos);
    el.classList.toggle('no-shade', !$('#shade').checked);
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
    const pickPos = value => {
      pos = value;
      $$('#poses .pos-cell').forEach(c => c.classList.toggle('on', c.dataset.pos === value));
      $('#posauto').classList.toggle('on-auto', !value);
      drawCard();
    };
    $$('#poses .pos-cell').forEach(c => { c.onclick = () => pickPos(c.dataset.pos); });
    $('#shade').onchange = drawCard;
    $('#posauto').onclick = () => pickPos(null);
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
      const track = lockTrack ? withShared(world).track : readTrack(root, world && withShared(world).track);
      checkPhotoRoom((prepared && !(look.photo) ? 1 : 0) + (cardPrepared && !(world && world.cardPhoto) ? 1 : 0));
      const canonPicked = Object.fromEntries($$('[data-part]', root).map(c => [c.dataset.part, c.checked]));
      const data = { name, track, canonOn: $('#canon').checked, canonParts: canonPicked, ficsOn: $('#fics').checked };
      if (!isNew) { data.cardInk = ink; data.cardPos = pos; data.cardShade = $('#shade').checked; }
      if ($('#first')) data.firstWatch = $('#first').checked;
      if (data.canonOn && !Object.values(canonPicked).some(Boolean)) throw new Error('Pick at least one thing to show on My Canon, or turn it off.');
      if (custom) data.look = { ...root._readLook(), photo: dropPhoto ? null : (look.photo || null) };
      if (isNew) {
        const order = Math.max(-1, ...state.worlds.map(w => w.order ?? 0)) + 1;
        const id = await DB.addWorld({ ...data, theme: 'custom', order, cutoff: null, ending: '', watched: [], rounds: 0 }, prepared);
        if (fromWish) { await DB.deleteItem(fromWish); wishToOpen = null; toast('Door opened. It’s off your wishlist.'); }
        location.hash = `#/w/${id}`;
      } else {
        // A shorter tracker can't point past its end.
        const last = Themes.steps(track).length - 1;
        data.watched = [...watchedOf(world)].filter(i => i <= last);
        data.cutoff = world.cutoff == null || world.cutoff > last ? null : world.cutoff;
        if (sharedW) {
          if (!lockTrack) await DB.updateShared(world.sharedId, { track });
          delete data.watched; // shared marks live with the group
        }
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
    wireShareSettings(world);
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
