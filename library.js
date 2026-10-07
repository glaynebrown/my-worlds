/* The Library: the built-in worlds anyone can add, plus "Build your own".
   - Someone who joined with the invite code is walked through three steps the
     first time they sign in: their worlds (#/library), their books
     (#/books/pick), then Step inside (#/start). "+ Add a world" opens the
     Library after that.
   - Their worlds start neutral (real endings, no favorites or ships, every
     section on) but wear your home-card photos and name colors, which your
     account publishes to library/wallpapers (publishWallpapers below).
   Also here: the limits for every account, and deleting an account. */

// Every account, yours too: 250 photos, 200 worlds, 200 books. A Firebase
// function (functions/index.js) removes anything added past these, so they
// hold even if someone gets around the app.
const MAX = { photos: 250, worlds: 200, books: 200 };

// Your account: the original one (not joined by invite, not made from a share).
// (Accounts made in the App Store app have settings.trial and are never the owner.)
const isOwner = () => !!(state.settings && state.settings.seeded && !state.settings.libraryMode && !state.settings.sharedFrom && !state.settings.trial);

function photoCount() {
  return state.items.filter(i => i.photo).length
    + state.worlds.filter(w => w.cardPhoto).length
    + state.worlds.filter(w => w.look && w.look.photo).length
    + state.books.reduce((n, b) => n + (b.cover ? 1 : 0) + (b.map ? 1 : 0) + (b.look && b.look.photo ? 1 : 0), 0);
}
// ---------- the free trial (accounts made in the App Store app) ----------
// 3 worlds, 3 books and 10 photos (card photos and backgrounds count too), then
// "Unlock everything" ($4.99, once): up to 200 worlds, 200 books and 250 photos.
// Accounts from before (your family's) have no trial. settings.trial can't be
// changed from the app; settings.unlocked only turns on, after buying (firestore.rules).
const TRIAL = { worlds: 3, books: 3, photos: 10 };
// Apple's price in the buyer's own currency, once DB.checkUnlock has asked (app.js).
let unlockPrice = '$4.99';
const onTrial = () => !!(state.settings && state.settings.trial && !state.settings.unlocked);
function photoCap() {
  const s = state.settings || {};
  if (DB.demo && !s.trial) return Infinity;
  return onTrial() ? TRIAL.photos : MAX.photos;
}
// A limit reached on the trial: says so, and offers the unlock. Its message
// still shows wherever the error lands (a form, a toast).
function trialLimit(what) {
  setTimeout(() => showUnlock(what), 50);
  return new Error(`The free version holds ${what}.`);
}
function checkWorldRoom(n = 1) {
  if (onTrial() && state.worlds.length + n > TRIAL.worlds) throw trialLimit(`${TRIAL.worlds} worlds`);
  if (state.worlds.length + n > MAX.worlds) throw new Error(`You’ve reached ${MAX.worlds} worlds. Delete one to add another.`);
}
function checkBookRoom(n = 1) {
  if (onTrial() && state.books.length + n > TRIAL.books) throw trialLimit(`${TRIAL.books} books`);
  if (state.books.length + n > MAX.books) throw new Error(`You’ve reached ${MAX.books} books. Delete one to add another.`);
}
// Throws a friendly message when adding n photos would pass the limit.
function checkPhotoRoom(n = 1) {
  const cap = photoCap();
  if (cap === Infinity || !n) return;
  const have = photoCount();
  if (have + n <= cap) return;
  if (onTrial()) throw trialLimit(`${TRIAL.photos} photos`);
  const left = Math.max(0, cap - have);
  throw new Error(left
    ? `You can add ${left} more photo${left === 1 ? '' : 's'} (the limit is ${cap}).`
    : `You’ve reached ${cap} photos. Delete a few to add more.`);
}

// "Unlock everything": the one-time purchase, through Apple (store.js).
// It pops up at a trial limit, and sits at the top of both gear menus (app.js).
const unlockPerks = () => `<ul class="unlock-list">
        <li>Up to ${MAX.worlds} shows/movies</li>
        <li>Up to ${MAX.books} books</li>
        <li>Up to ${MAX.photos} photos</li>
        <li>One time purchase, no subscription, and no ads!</li>
      </ul>
      <button type="button" class="btn primary block" id="buy">Unlock for ${esc(unlockPrice)}</button>
      <button type="button" class="linkish" id="restore">Restore purchase</button>
      <p class="error" id="uerr" hidden></p>`;
function wireUnlock(root, close) {
  const fail = m => { $('#uerr', root).textContent = m; $('#uerr', root).hidden = false; };
  $('#buy', root).onclick = () => busy($('#buy', root), async () => {
    if (!DB.buyUnlock) return fail('Purchases work in the App Store app.');
    if (await DB.buyUnlock()) { state.settings.unlocked = true; close(); toast('Everything’s unlocked. Thank you!'); refresh(); }
  }, 'Opening the App Store…');
  $('#restore', root).onclick = () => busy($('#restore', root), async () => {
    if (!DB.restoreUnlock) return fail('Purchases work in the App Store app.');
    if (await DB.restoreUnlock()) { state.settings.unlocked = true; close(); toast('Your purchase is restored'); refresh(); } else fail('No purchase found for this Apple ID.');
  }, 'Checking…');
}
function showUnlock(reason) {
  if ($('.unlock-modal')) return;
  openModal(`<div class="unlock">
      <div class="lib-crest" aria-hidden="true">${CREST}</div>
      <h2>Unlock everything</h2>
      ${reason ? `<p class="muted small">The free version holds ${esc(reason)}.</p>` : ''}
      ${unlockPerks()}
      <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-close>Not now</button></div></div>`, wireUnlock, 'small-modal unlock-modal');
}

// ---------- the App Store app's "Add a world": built-in looks, under their own names ----------
// Tapping a look asks for the world's name (you type it), then makes the world
// with that look and no tracker yet (set one up in its settings).
function renderLooksPick() {
  const looks = Object.entries(Themes.BUILT_IN);
  view.innerHTML = `<div class="library">
    <header class="w-head"><a class="back" href="#/">‹ Worlds</a></header>
    <header class="lib-head"><div class="lib-crest" aria-hidden="true">${CREST}</div>
      <h1 class="lib-title">Add a world</h1>
      <p class="lib-sub">Pick a look for its door and pages, or build your own.</p></header>
    <div class="shelf"><a class="tile add-tile" href="#/new"><span class="plus" aria-hidden="true">+</span><span class="tile-name">Build your own</span></a>
      ${looks.map(([k, b]) => `<div class="tile pickable" role="button" tabindex="0" data-look="${k}"><span class="tile-art" aria-hidden="true"></span>
        <span class="tile-name">${esc(b.label)}</span></div>`).join('')}</div>
  </div>`;
  $$('[data-look]').forEach(el => {
    const theme = el.dataset.look;
    Themes.apply(el, { theme });
    const pick = () => {
      try { checkWorldRoom(1); } catch (e) { return; }
      formModal({
        title: `${Themes.BUILT_IN[theme].label}`,
        fields: [{ key: 'name', label: 'Name your world', placeholder: 'The show, movie or series' }],
        onSave: async v => {
          if (!v.name) throw new Error('Give your world a name.');
          checkWorldRoom(1);
          const order = Math.max(-1, ...state.worlds.map(w => w.order ?? 0)) + 1;
          const id = await DB.addWorld({ ...neutralWorld({ name: v.name, theme, track: null }, order), canonOn: false });
          location.hash = `#/w/${id}`;
        },
      });
    };
    el.onclick = pick;
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
  });
}

// Your home-card photos and name colors, for everyone else's new worlds.
let lastWallpapers = null;
function publishWallpapers() {
  if (!isOwner() || DB.demo) return;
  const data = {};
  state.worlds.filter(w => w.theme !== 'custom').forEach(w => {
    const p = w.cardPhoto;
    data[w.theme] = { photo: p ? { url: p.url, thumbUrl: p.thumbUrl, w: p.w || null, h: p.h || null } : null, ink: w.cardInk || null, pos: w.cardPos || null, shade: w.cardShade !== false };
  });
  const json = JSON.stringify(data);
  if (json === lastWallpapers) return;
  lastWallpapers = json;
  DB.saveWallpapers(data).catch(e => console.warn('Could not publish wallpapers', e));
}

// A built-in world with nothing personal in it.
function neutralWorld(starter, order) {
  return {
    name: starter.name, theme: starter.theme, track: starter.track,
    canonOn: true, canonParts: { ending: true, ships: true, headcanons: true }, cutoff: null, ending: '',
    ficsOn: true, watched: [], rounds: 0, order,
  };
}

// ---------- first sign-in: three steps ----------
// 1 Pick your worlds (#/library)  2 Pick your books (#/books/pick)
// 3 Step inside your worlds (#/start): worlds or books first?
// Nothing is saved until step 3; closing the app part way starts over.
let onboard = null; // { worlds: Set of themes, books: Map of library id -> shelf }
const isOnboarding = () => !!(state.settings && state.settings.libraryMode && !state.settings.seeded);
function onboardPicks() {
  if (!onboard) onboard = { worlds: new Set(), books: new Map() };
  return onboard;
}
const stepDots = n => `<div class="step-dots" aria-label="Step ${n} of 3">${[1, 2, 3].map(i => `<span${i === n ? ' class="on"' : ''}></span>`).join('')}</div>`;

// Built-in worlds onto this person's shelf, wearing your card photos and name colors.
// Returns { theme: new world id }.
async function addLibraryWorlds(themes) {
  const walls = state.wallpapers || {};
  const ids = {};
  let order = Math.max(-1, ...state.worlds.map(w => w.order ?? 0)) + 1;
  for (const s of Themes.STARTERS.filter(x => themes.has(x.theme))) {
    const data = neutralWorld(s, order++);
    const wall = walls[s.theme];
    if (wall && wall.ink) data.cardInk = wall.ink;
    if (wall && wall.pos) data.cardPos = wall.pos;
    if (wall && wall.shade === false) data.cardShade = false;
    const id = ids[s.theme] = await DB.addWorld(data);
    // Their own copy of your card photo, so it never depends on your account.
    if (wall && wall.photo && DB.copyPhoto) {
      try {
        const photo = await DB.copyPhoto('worlds', id, wall.photo);
        await DB.updateWorld({ id }, { cardPhoto: photo });
      } catch (e) { console.warn('Card photo not copied', e); }
    }
  }
  return ids;
}

function renderLibraryPick() {
  const wizard = isOnboarding();
  const have = new Set(state.worlds.map(w => w.theme));
  const choices = Themes.STARTERS.filter(s => !have.has(s.theme));
  const walls = state.wallpapers || {};
  // During sign-up the picks live in onboard, so going Back (or a redraw) keeps them.
  const picked = wizard ? onboardPicks().worlds : new Set();

  view.innerHTML = `<div class="library">
    ${wizard ? stepDots(1) : '<header class="w-head"><a class="back" href="#/">‹ Worlds</a></header>'}
    <header class="lib-head"><div class="lib-crest" aria-hidden="true">${CREST}</div>
      <h1 class="lib-title">${wizard ? 'Pick your worlds' : 'The Library'}</h1>
      <p class="lib-sub">${wizard ? 'Movies &amp; shows. Tap the doors you want. You can add more anytime.' : 'Pick a door to add, or build your own.'}</p></header>
    <div class="shelf">${wizard ? '' : '<a class="tile add-tile" href="#/new"><span class="plus" aria-hidden="true">+</span><span class="tile-name">Build your own</span></a>'}
      ${choices.map(s => `<div class="tile pickable${picked.has(s.theme) ? ' picked' : ''}" role="button" tabindex="0" aria-pressed="${picked.has(s.theme)}" data-theme-pick="${s.theme}">
        <span class="tile-art" aria-hidden="true"></span><span class="pick-check" aria-hidden="true">✓</span>
        <span class="tile-name">${esc(s.name)}</span></div>`).join('')}</div>
    ${wizard ? '<div class="pick-bar"><button class="btn primary block" id="next">Next: pick your books ›</button></div>'
      : choices.length ? '<div class="pick-bar"><button class="btn primary block" id="go" disabled>Pick a door</button></div>' : ''}
  </div>`;

  $$('[data-theme-pick]').forEach(el => {
    const theme = el.dataset.themePick;
    Themes.apply(el, { theme });
    const wall = walls[theme];
    if (wall && wall.photo) { el.classList.add('has-photo'); el.style.setProperty('--card-photo', `url('${wall.photo.thumbUrl || wall.photo.url}')`); }
    if (wall) { cardInk(el, wall.ink); cardPos(el, wall.pos); el.classList.toggle('no-shade', wall.shade === false); }
    const toggle = () => {
      if (picked.has(theme)) picked.delete(theme); else picked.add(theme);
      el.classList.toggle('picked', picked.has(theme));
      el.setAttribute('aria-pressed', picked.has(theme));
      const go = $('#go');
      if (!go) return;
      go.disabled = !picked.size;
      go.textContent = !picked.size ? 'Pick a door' : `Add ${picked.size === 1 ? 'this door' : `${picked.size} doors`}`;
    };
    el.onclick = toggle;
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
  });

  // Sign-up: on to the books (if the library has any to pick), else the last step.
  const next = $('#next');
  if (next) next.onclick = () => busy(next, async () => { location.hash = (await afterWorldsPick()) || '#/start'; }, '…');

  const go = $('#go');
  if (go) {
    go.onclick = () => busy(go, async () => {
      await addLibraryWorlds(picked);
      toast(picked.size === 1 ? 'Door added' : `${picked.size} doors added`);
      location.hash = '#/';
    }, 'Opening doors…');
  }
}

// Step 3: everything picked goes on the shelves, then in through the chosen side.
function renderStart() {
  if (!isOnboarding()) { location.replace('#/'); return; }
  const o = onboardPicks();
  view.innerHTML = `<div class="library start-page">
    ${stepDots(3)}
    <header class="w-head"><a class="back" href="${o.hadBooks ? '#/books/pick' : '#/library'}">‹ Back</a></header>
    <header class="lib-head"><h1 class="lib-title">Step inside your worlds</h1>
      <p class="lib-sub">Where to first? You can flip between them anytime from the icon at the top.</p></header>
    <div class="start-doors">
      <button class="start-door" data-side="worlds"><span class="lib-crest">${CREST}</span><span class="start-name">My Worlds</span><span class="start-sub">Movies &amp; shows</span></button>
      <button class="start-door" data-side="books"><span class="lib-crest">${BOOK_CREST}</span><span class="start-name">My Books</span><span class="start-sub">Reading</span></button>
    </div>
    <p class="muted small center start-note" id="startnote"></p>
  </div>`;
  $$('.start-door').forEach(btn => {
    btn.onclick = async () => {
      if (view.dataset.starting) return;
      view.dataset.starting = '1';
      $$('.start-door').forEach(b => { b.disabled = true; });
      const note = $('#startnote');
      try {
        const choices = o.books.size ? libChoices(await bookLibrary()) : [];
        // Books picked for Read: one "when did you finish?" for all of them.
        const toRead = [...o.books].filter(([, sh]) => sh === 'read').map(([id]) => choices.find(x => x.id === id)).filter(Boolean);
        let end = '';
        if (toRead.length) {
          end = await askFinish(toRead.map(e => e.title));
          if (end === null) { $$('.start-door').forEach(b => { b.disabled = false; }); return; }
          celebrateFinish(toRead, end);
        }
        note.textContent = o.worlds.size ? 'Opening your doors…' : 'Getting things ready…';
        const ids = await addLibraryWorlds(o.worlds);
        let n = 0;
        for (const [id, shelf] of o.books) {
          const e = choices.find(x => x.id === id);
          note.textContent = `Shelving ${++n} of ${o.books.size}…`;
          if (e) await addFromLibrary(e, shelf, ids, end);
        }
        await DB.saveSettings({ seeded: true, booksPicked: true });
        Object.assign(state.settings, { seeded: true, booksPicked: true });
        onboard = null;
        rememberSide(btn.dataset.side);
        location.hash = btn.dataset.side === 'books' ? '#/books' : '#/';
      } catch (e) {
        console.error(e);
        note.textContent = e.message || 'Something went wrong. Try again.';
        $$('.start-door').forEach(b => { b.disabled = false; });
      } finally {
        delete view.dataset.starting;
      }
    };
  });
}

// ---------- deleting an account ----------
function deleteAccountFlow() {
  openModal(`<h2>Delete my account?</h2>
    <p>This erases every world, photo, quote, note and fic you’ve saved, and your login. It can’t be undone.</p>
    <label class="field"><span class="field-label">Type your password to confirm</span><input type="password" id="pw" autocomplete="current-password"></label>
    <label class="check" style="margin-top:12px"><input type="checkbox" id="sure"><span>Yes, delete everything</span></label>
    <p class="error" id="err" hidden></p>
    <div class="actions"><button class="btn" data-close>Keep my account</button><span class="spacer"></span><button class="btn danger" id="del">Delete</button></div>`,
  (root, close) => {
    $('#del', root).onclick = e => {
      const err = $('#err', root);
      const fail = msg => { err.textContent = msg; err.hidden = false; };
      if (!$('#sure', root).checked) return fail('Check the box to confirm.');
      const pw = $('#pw', root).value;
      if (!pw) return fail('Type your password.');
      busy(e.target, async () => {
        try {
          await DB.deleteAccount(pw, (n, total) => { e.target.textContent = `Deleting… ${Math.round((n / total) * 100)}%`; });
          close();
          try { localStorage.removeItem('fw-folded'); } catch {}
          toast('Your account is deleted');
        } catch (x) {
          fail(x.code === 'auth/wrong-password' || x.code === 'auth/invalid-credential' ? 'That password isn’t right.'
            : x.code === 'auth/admin-restricted-operation' || x.code === 'auth/operation-not-allowed' ? 'Deleting accounts is turned off right now.'
            : friendlyError(x));
        }
      }, 'Deleting…');
    };
  });
}
