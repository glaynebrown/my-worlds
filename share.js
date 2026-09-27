/* Sharing a copy of your worlds with someone (your sister).

   You: open the hidden link  …/my-worlds/#/share  once, type her email, send.
     That writes a one-time copy to shares/{her email} (see firestore.rules).
   Her: add her login in Firebase; the first time she signs in, the app finds
     the copy, builds her own worlds from it (photos copied into her own
     storage), and deletes the copy. After that the two accounts never touch.

   What goes: every world (look, card photo, tracker, canon ending/cutoff),
   mood boards, quotes, favorites, ships, headcanons.
   What stays yours: fics, rewatch notes, your wishlist, watched marks, and
   the Zutara ship with its photos. She gets a Zukka ship on Avatar instead. */

const SHARE_KINDS = ['pin', 'quote', 'fav', 'ship', 'shippic', 'headcanon'];
const KEEP_SHIPS = /^zutara$/i; // ships that stay only in your account

function buildShare() {
  const skipShips = new Set(state.items.filter(i => i.kind === 'ship' && KEEP_SHIPS.test((i.name || '').trim())).map(i => i.id));
  const items = state.items
    .filter(i => SHARE_KINDS.includes(i.kind) && !skipShips.has(i.id) && !(i.kind === 'shippic' && skipShips.has(i.ship)))
    .map(i => ({ ...i }));
  const worlds = state.worlds.map(w => {
    const copy = { ...w, watched: [], rounds: 0 };
    delete copy.at;
    if (w.theme === 'avatar') {
      // Her Avatar keeps a My Canon page with ships on it (for Zukka).
      copy.canonOn = true;
      copy.canonParts = { ending: false, headcanons: false, ...(w.canonParts || {}), ships: true };
      if (!items.some(i => i.world === w.id && i.kind === 'ship' && /^zukka$/i.test(i.name || ''))) {
        items.push({ id: `zukka-${w.id}`, world: w.id, kind: 'ship', name: 'Zukka', note: '', colors: ['#b8352b', '#2f6f9f'], t: Date.now() });
      }
    }
    return copy;
  });
  return { worlds, items };
}

function renderShare() {
  const { worlds, items } = buildShare();
  const photos = items.filter(i => i.photo).length + worlds.filter(w => w.cardPhoto).length;
  view.innerHTML = `<div class="page">
    <header class="w-head"><a class="back" href="#/">‹ Worlds</a></header>
    <header class="lib-head"><div class="lib-crest" aria-hidden="true">${CREST}</div>
      <h1 class="lib-title">Share a copy</h1><p class="lib-sub">Her own worlds, starting from yours.</p></header>
    <form class="card form-card" id="sf" novalidate>
      <p style="margin-top:16px"><b>She gets:</b> ${worlds.length} worlds with their looks and trackers, plus ${items.length} saved things (boards, quotes, favorites, ships, headcanons) and ${photos} photos. Nothing starts marked watched.</p>
      <p class="muted small"><b>Stays yours:</b> Zutara and its photos, your fics, rewatch notes and wishlist. Her Avatar gets a Zukka ship.</p>
      <label class="field"><span class="field-label">Her email (the one you add in Firebase)</span><input type="email" id="to" autocomplete="off" autocapitalize="off" inputmode="email"></label>
      <div class="actions"><span class="spacer"></span><a class="btn" href="#/">Cancel</a><button class="btn primary" id="send">Send the copy</button></div>
    </form>
    <div id="sent"></div>
  </div>`;
  $('#sf').onsubmit = e => {
    e.preventDefault();
    const to = $('#to').value.trim().toLowerCase();
    busy($('#send'), async () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('That email doesn’t look right.');
      if (DB.demo) throw new Error('Sample mode can’t share. Try it in the real app.');
      await DB.createShare(to, worlds, items);
      $('#sf').hidden = true;
      $('#sent').innerHTML = `<div class="card form-card" style="padding:18px">
        <p><b>Sent.</b> It’s waiting for ${esc(to)}.</p>
        <p class="muted small" style="margin-top:8px">Next: add her in Firebase (Authentication → Users → Add user) with that same email. When she signs in for the first time, her worlds get set up from this copy. Sending again replaces it.</p>
        <p style="margin-top:14px"><a class="btn" href="#/">Back to my worlds</a></p></div>`;
    }, 'Sending…');
  };
}

// ---------- her side: first sign-in ----------
async function importShare(share) {
  seeding = true; // keeps the built-in starters from being added on top
  const total = share.worlds.length + share.items.length;
  let done = 0;
  const step = () => {
    done++;
    view.innerHTML = `<p class="loading">Setting up your worlds… ${Math.round((done / total) * 100)}%</p>`;
  };
  const copyPhoto = async (folder, id, photo) => {
    if (!photo) return photo;
    try { return await DB.copyPhoto(folder, id, photo); } catch (e) { console.warn('Kept the original photo link', e); return photo; }
  };
  try {
    state.importing = true;
    view.innerHTML = '<p class="loading">Setting up your worlds…</p>';
    const worldIds = {}, shipIds = {};
    for (const { id, ...w } of share.worlds) {
      const nid = DB.newId('worlds');
      worldIds[id] = nid;
      const data = { ...w, t: w.t || Date.now() };
      if (w.cardPhoto) data.cardPhoto = await copyPhoto('worlds', nid, w.cardPhoto);
      if (w.look && w.look.photo) data.look = { ...w.look, photo: await copyPhoto('worlds', nid, w.look.photo) };
      await DB.setWorld(nid, data);
      step();
    }
    // Ships first, so ship photos can point at the new ships.
    const ordered = [...share.items.filter(i => i.kind === 'ship'), ...share.items.filter(i => i.kind !== 'ship')];
    for (const { id, ...it } of ordered) {
      if (!worldIds[it.world]) { step(); continue; }
      const nid = DB.newId('items');
      if (it.kind === 'ship') shipIds[id] = nid;
      const data = { ...it, world: worldIds[it.world] };
      if (it.kind === 'shippic') data.ship = shipIds[it.ship] || null;
      if (it.photo) data.photo = await copyPhoto('items', nid, it.photo);
      await DB.setItem(nid, data);
      step();
    }
    const all = Themes.STARTERS.map(w => w.theme);
    await DB.saveSettings({ seeded: true, seededThemes: all, sharedFrom: share.email });
    Object.assign(state.settings, { seeded: true, seededThemes: all });
    await DB.deleteShare(share).catch(e => console.warn('Could not remove the shared copy', e));
    toast('Your worlds are ready');
  } catch (e) {
    console.error(e);
    toast(friendlyError(e), true);
  } finally {
    state.importing = false;
    seeding = false;
    route();
  }
}
