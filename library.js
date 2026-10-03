/* The Library: the built-in worlds anyone can add, plus "Build your own".
   - Someone who joined with the invite code picks their doors here the first
     time they sign in (#/library), and "+ Add a world" opens it after that.
   - Their worlds start neutral (real endings, no favorites or ships, every
     section on) but wear your home-card photos and name colors, which your
     account publishes to library/wallpapers (publishWallpapers below).
   Also here: the 500-photo limit for everyone but you, and deleting an account. */

const PHOTO_CAP = 500;

// Your account: the original one (not joined by invite, not made from a share).
const isOwner = () => !!(state.settings && state.settings.seeded && !state.settings.libraryMode && !state.settings.sharedFrom);

function photoCount() {
  return state.items.filter(i => i.photo).length
    + state.worlds.filter(w => w.cardPhoto).length
    + state.worlds.filter(w => w.look && w.look.photo).length
    + state.books.reduce((n, b) => n + (b.cover ? 1 : 0) + (b.map ? 1 : 0) + (b.look && b.look.photo ? 1 : 0), 0);
}
// Throws a friendly message when adding n photos would pass the limit.
function checkPhotoRoom(n = 1) {
  if (isOwner() || DB.demo) return;
  const have = photoCount();
  if (have + n > PHOTO_CAP) {
    const left = Math.max(0, PHOTO_CAP - have);
    throw new Error(left
      ? `You can add ${left} more photo${left === 1 ? '' : 's'} (the limit is ${PHOTO_CAP}).`
      : `You’ve reached ${PHOTO_CAP} photos. Delete a few to add more.`);
  }
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

function renderLibraryPick() {
  const firstTime = !state.worlds.length;
  const have = new Set(state.worlds.map(w => w.theme));
  const choices = Themes.STARTERS.filter(s => !have.has(s.theme));
  const walls = state.wallpapers || {};
  const picked = new Set();

  view.innerHTML = `<div class="library">
    ${firstTime ? '' : '<header class="w-head"><a class="back" href="#/">‹ Worlds</a></header>'}
    <header class="lib-head"><div class="lib-crest" aria-hidden="true">${CREST}</div>
      <h1 class="lib-title">The Library</h1>
      <p class="lib-sub">${firstTime ? 'Pick the doors you want. You can add more anytime.' : 'Pick a door to add, or build your own.'}</p></header>
    <div class="shelf">${choices.map(s => `<div class="tile pickable" role="button" tabindex="0" aria-pressed="false" data-theme-pick="${s.theme}">
        <span class="tile-art" aria-hidden="true"></span><span class="pick-check" aria-hidden="true">✓</span>
        <span class="tile-name">${esc(s.name)}</span></div>`).join('')}
      <a class="tile add-tile" href="#/new"><span class="plus" aria-hidden="true">+</span><span class="tile-name">Build your own</span></a></div>
    ${choices.length ? '<div class="pick-bar"><button class="btn primary block" id="go" disabled>Pick a door</button></div>' : ''}
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
      go.disabled = !picked.size;
      go.textContent = !picked.size ? 'Pick a door' : firstTime ? `Step inside (${picked.size})` : `Add ${picked.size === 1 ? 'this door' : `${picked.size} doors`}`;
    };
    el.onclick = toggle;
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
  });

  const go = $('#go');
  if (go) {
    go.onclick = () => busy(go, async () => {
      let order = Math.max(-1, ...state.worlds.map(w => w.order ?? 0)) + 1;
      for (const s of Themes.STARTERS.filter(x => picked.has(x.theme))) {
        const data = neutralWorld(s, order++);
        const wall = walls[s.theme];
        if (wall && wall.ink) data.cardInk = wall.ink;
        if (wall && wall.pos) data.cardPos = wall.pos;
        if (wall && wall.shade === false) data.cardShade = false;
        const id = await DB.addWorld(data);
        // Their own copy of your card photo, so it never depends on your account.
        if (wall && wall.photo && DB.copyPhoto) {
          try {
            const photo = await DB.copyPhoto('worlds', id, wall.photo);
            await DB.updateWorld({ id }, { cardPhoto: photo });
          } catch (e) { console.warn('Card photo not copied', e); }
        }
      }
      if (!state.settings.seeded) {
        await DB.saveSettings({ seeded: true });
        state.settings.seeded = true;
      }
      toast(picked.size === 1 ? 'Door added' : `${picked.size} doors added`);
      location.hash = '#/';
    }, 'Opening doors…');
  }
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
