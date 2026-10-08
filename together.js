/* Shared worlds: two or three family members share one world's Rewatch
   (Step 1: the tracker and everyone's notes, side by side).

   - Whoever shares it (the owner) turns their world into a shared one: its
     tracker, watched marks and rewatch notes move to shared/{sid}.
   - Someone invited by email sees "…wants to share … Join?" and gets a new,
     separate door that points at the same shared tracker. It starts with the
     owner's look; after that each person's look is their own.
   - Watched marks are one set for the group. Notes are per person and shown
     side by side; each person edits only their own.
   - Leaving (or the owner stopping) turns it back into a normal world that
     keeps a personal copy of the tracker and all the notes. */

// state.shared (in app.js): sid -> { doc, notes }
const sharedStops = {};     // sid -> stop listening
function stopAllShared() { Object.keys(sharedStops).forEach(sid => { sharedStops[sid](); delete sharedStops[sid]; }); }
const detached = new Set(); // shared ids already turned back into a personal world (only ever once)

const myName = () => (state.settings && state.settings.displayName)
  || ((state.user && state.user.email) || 'Me').split('@')[0].replace(/^./, c => c.toUpperCase());
// The name you go by in one shared world (set when you shared or joined it).
const shareName = world => {
  const d = sharedDoc(world);
  return (d && d.names && d.names[DB.myUid()]) || myName();
};
// A shared world's name without an old "(with Bella)" ending, and the small
// "Shared with Bella" line shown under it on the door and the world's title.
const plainName = world => (world.sharedId ? world.name.replace(/\s*\(with [^)]*\)\s*$/, '') : world.name);
function sharedWithLine(world) {
  if (!world.sharedId) return '';
  const d = sharedDoc(world);
  if (d && !d.gone) {
    const others = Object.entries(d.names || {}).filter(([u]) => u !== DB.myUid() && (d.members || []).includes(u)).map(([, n]) => n);
    return others.length ? `Shared with ${others.join(' & ')}` : 'Shared';
  }
  const old = /\(with ([^)]*)\)\s*$/.exec(world.name);
  return old ? `Shared with ${old[1]}` : 'Shared';
}
// After changing your nickname: offer to use it in shares that still show another name.
function offerNameInShares(name) {
  const sids = Object.entries(state.shared || {}).filter(([, v]) => v && v.doc && !v.doc.gone && !v.doc.ended
    && (v.doc.members || []).includes(DB.myUid()) && ((v.doc.names || {})[DB.myUid()] || '') !== name).map(([sid]) => sid);
  if (!sids.length || !name) return;
  confirmBox(`Use “${name}” in your shared worlds too?`, `${sids.length === 1 ? 'One shared world or buddy read shows' : `${sids.length} shared worlds and buddy reads show`} a different name for you. This updates it there, on your old notes too.`,
    'Use it', async () => {
      for (const sid of sids) await DB.updateShared(sid, { [`names.${DB.myUid()}`]: name });
      toast('Updated in your shared worlds');
    });
}
const isSharedOwner = world => {
  const sh = world.sharedId && state.shared[world.sharedId];
  return !!(sh && sh.doc && sh.doc.owner === DB.myUid());
};
const sectionNames = d => SHARE_SECTIONS.filter(([k]) => (d.sections || { rewatch: true })[k])
  .map(([k, l]) => (k === 'rewatch' && (d.sections || {}).rewatchMarks === false ? 'Rewatch list (you each keep your own watched marks)' : l.replace(' (tracker + notes)', '')));
const sharedDoc = world => (world.sharedId && state.shared[world.sharedId] && state.shared[world.sharedId].doc) || null;

// The world as its Rewatch should see it: the shared tracker when there is one.
function withShared(world) {
  const d = sharedDoc(world);
  if (!d || d.gone) return world;
  const sec = d.sections || { rewatch: true };
  // Rewatch shared: everyone gets the same list. Watched marks are shared too
  // unless "Share watched marks too" is off, then each person keeps their own.
  const out = !sec.rewatch ? { ...world }
    : sec.rewatchMarks === false ? { ...world, track: d.track }
    : { ...world, track: d.track, watched: d.watched || [], rounds: d.rounds || 0, firstWatch: !!d.firstWatch };
  if (sec.canon) {
    const c = d.canon || {};
    Object.assign(out, { canonOn: true, canonParts: c.canonParts || { ending: true, ships: true, headcanons: true }, ending: c.ending || '', cutoff: c.cutoff ?? null });
  }
  if (sec.fics) out.ficsOn = true;
  if (sec.map) Object.assign(out, { mapOn: true, map: d.map || null }); // a buddy read's shared map
  return out;
}

// ---------- which sections are shared, and routing saves to the right place ----------
const SHARE_SECTIONS = [['rewatch', 'Rewatch (tracker + notes)'], ['board', 'Board'], ['quotes', 'Quotes'], ['favs', 'Favorites'], ['canon', 'My Canon'], ['fics', 'Fics']];
// (bnote and mapmark are a book's reading notes and map pins; see books.js.)
const SECTION_OF = { pin: 'board', quote: 'quotes', fav: 'favs', ship: 'canon', shippic: 'canon', headcanon: 'canon', fic: 'fics', bnote: 'notes', mapmark: 'map' };
const KINDS_OF = { board: ['pin'], quotes: ['quote'], favs: ['fav'], canon: ['ship', 'headcanon', 'shippic'], fics: ['fic'], notes: ['bnote'], map: ['mapmark'] };

const marksShared = world => sectionShared(world, 'rewatch') && (sharedDoc(world).sections || {}).rewatchMarks !== false;
function sectionShared(world, section) {
  const d = sharedDoc(world);
  return !!(d && !d.gone && (d.sections || {})[section]);
}
const sharedItemsOf = (world, kind) => {
  const sid = world.sharedId, v = state.shared[sid];
  return ((v && v.items) || []).filter(i => i.kind === kind).map(i => ({ ...i, world: world.id, _sid: sid }));
};
// A section's things: shared ones if that section is shared, otherwise your own.
function itemsFor(world, kind) {
  return world.sharedId && sectionShared(world, SECTION_OF[kind]) ? sharedItemsOf(world, kind) : itemsIn(world.id, kind);
}
function findItem(id) {
  const mine = state.items.find(i => i.id === id);
  if (mine) return mine;
  for (const w of [...state.worlds, ...state.books].filter(x => x.sharedId)) {
    const hit = ((state.shared[w.sharedId] || {}).items || []).find(i => i.id === id);
    if (hit) return { ...hit, world: w.id, _sid: w.sharedId };
  }
  return null;
}
const canEdit = item => !item || !item._sid || item.by === DB.myUid();
const byLine = item => (item && item._sid && item.by !== DB.myUid() ? `<span class="by-line">from ${esc(item.byName || 'someone')}</span>` : '');
const byTag = item => (item && item._sid && item.by !== DB.myUid() ? ` <span class="by-tag">· ${esc(item.byName || 'Someone')}</span>` : '');

function addItemFor(world, data, prepared) {
  if (world.sharedId && sectionShared(world, SECTION_OF[data.kind])) {
    const { world: _w, ...rest } = data;
    return DB.addSharedItem(world.sharedId, { ...rest, byName: shareName(world) }, prepared);
  }
  return DB.addItem(data, prepared);
}
const updateItemFor = (item, patch, prepared, dropPhoto) =>
  (item._sid ? DB.updateSharedItem(item._sid, item, patch, prepared, dropPhoto) : DB.updateItem(item, patch, prepared, dropPhoto));
const deleteItemFor = item => (item._sid ? DB.deleteSharedItem(item._sid, item) : DB.deleteItem(item));
// Ending text / story cutoff: shared when My Canon is shared.
function setCanonField(world, patch) {
  if (world.sharedId && sectionShared(world, 'canon')) {
    const p = {};
    Object.entries(patch).forEach(([k, v]) => { p[`canon.${k}`] = v; });
    return DB.updateShared(world.sharedId, p);
  }
  return world._book ? DB.updateBook(world, patch) : DB.updateWorld(world, patch);
}

// Something another person added: shown, not editable.
function viewOnly(item, html) {
  openModal(`${html}<p class="muted small" style="margin-top:12px">Added by ${esc(item.byName || 'someone else')}. Only they can change it.</p>
    <div class="actions"><span class="spacer"></span><button class="btn" data-close>Close</button></div>`);
}

// Your things in the given sections move into the shared world (photos stay where they are).
async function moveIntoShared(world, sid, sections, me) {
  const kinds = sections.flatMap(s => KINDS_OF[s] || []);
  const shipIds = {};
  const mine = kinds.flatMap(k => itemsIn(world.id, k)).sort((a, b) => (a.kind === 'ship' ? -1 : b.kind === 'ship' ? 1 : 0));
  for (const it of mine) {
    const { id, world: _w, ...data } = it;
    if (data.kind === 'shippic') data.ship = shipIds[data.ship] || data.ship;
    const nid = await DB.addSharedItem(sid, { ...data, byName: me });
    if (it.kind === 'ship') shipIds[id] = nid;
    await DB.deleteItemOnly(it);
  }
}

// Listen to every shared world this account has a door for.
function syncSharedWatches() {
  if (!DB.watchShared) return;
  const want = new Set([...state.worlds, ...state.books].filter(w => w.sharedId).map(w => w.sharedId));
  Object.keys(sharedStops).forEach(sid => {
    if (!want.has(sid)) { sharedStops[sid](); delete sharedStops[sid]; delete state.shared[sid]; }
  });
  want.forEach(sid => {
    if (sharedStops[sid]) return;
    sharedStops[sid] = DB.watchShared(sid, view => {
      // Notes and items show each person's current name for this share, so a
      // renamed person's older notes update too (byName is only the fallback).
      const names = (view.doc && view.doc.names) || {};
      const named = x => (names[x.by] ? { ...x, byName: names[x.by] } : x);
      view = { ...view, notes: (view.notes || []).map(named), items: (view.items || []).map(named) };
      state.shared[sid] = view;
      if (typeof queueWidgetSync === 'function') queueWidgetSync();
      const world = state.worlds.find(w => w.sharedId === sid) || state.books.find(b => b.sharedId === sid);
      const d = view.doc;
      // Ended by the owner, or no longer a member: keep a personal copy.
      if (world && d && !d.gone && (d.ended || !(d.members || []).includes(DB.myUid()))) detachShared(world, view);
      else if (world && d && d.gone && !d.error) detachShared(world, view);
      else if (state.loaded) refresh();
    });
  });
}

// ---------- sharing a world ----------
// "Your name in this world": everyone in a share can change their own name.
const myShareNameHtml = (world, label) => `<label class="field share-me"><span class="field-label">${label}</span>
    <span class="inline-save"><input id="share-me" value="${esc(shareName(world))}" autocomplete="off"><button type="button" class="btn small" id="share-me-save" hidden>Save</button></span></label>`;
function wireMyShareName(world) {
  const input = $('#share-me'), save = $('#share-me-save');
  if (!input || !save) return;
  input.oninput = () => { save.hidden = !input.value.trim() || input.value.trim() === shareName(world); };
  input.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (!save.hidden) save.click(); } };
  save.onclick = () => busy(save, async () => {
    const me = input.value.trim();
    if (!me) throw new Error('Add your name.');
    await DB.updateShared(world.sharedId, { [`names.${DB.myUid()}`]: me });
    save.hidden = true;
    toast('Name saved. Everyone sees it now, on your old notes too.');
  }, 'Saving…');
}

function shareSettingsHtml(world) {
  const d = sharedDoc(world);
  if (!world.sharedId) {
    return `<h2 class="form-h">Share</h2>
      <p class="muted small">Share this world with family: pick which sections you share. You’ll each keep your own look.</p>
      <button type="button" class="btn small" id="share-go">Share this world…</button>`;
  }
  if (!d || d.gone) return '<h2 class="form-h">Share</h2><p class="muted small">Loading…</p>';
  const names = Object.entries(d.names || {}).filter(([u]) => u !== DB.myUid() && (d.members || []).includes(u)).map(([, n]) => n);
  const pending = (d.invited || []);
  const owner = d.owner === DB.myUid();
  const sec = d.sections || { rewatch: true };
  return `<h2 class="form-h">Share</h2>
    <p class="small">${names.length ? `Shared with <b>${esc(names.join(', '))}</b>.` : 'Shared, but no one has joined yet.'}</p>
    ${pending.length ? `<p class="muted small">Waiting on: ${pending.map(esc).join(', ')}</p>` : ''}
    ${myShareNameHtml(world, 'Your name in this world')}
    <span class="field-label" style="margin-top:12px">Shared sections</span>
    <div class="share-secs">${SHARE_SECTIONS.map(([k, label]) => `<label class="check"><input type="checkbox" data-secset="${k}" ${sec[k] ? 'checked' : ''} ${owner ? '' : 'disabled'}><span>${label}</span></label>`
      + (k === 'rewatch' ? `<label class="check sub-check"><input type="checkbox" data-secset="rewatchMarks" ${sec.rewatchMarks !== false ? 'checked' : ''} ${owner && sec.rewatch ? '' : 'disabled'}><span>Share watched marks too</span></label>` : '')).join('')}</div>
    ${owner ? '<button type="button" class="btn small" id="share-secs-save" hidden>Save shared sections</button>' : '<p class="muted small">Only the person who shared it can change these.</p>'}
    <div class="row-btns">
      ${owner ? '<button type="button" class="btn small" id="share-go">Invite someone…</button><button type="button" class="btn small ghost danger-text" id="share-stop">Stop sharing</button>'
        : '<button type="button" class="btn small ghost danger-text" id="share-leave">Leave shared world</button>'}
    </div>
    ${othersIn(d).length ? safetyHtml(d) : ''}`;
}

function wireShareSettings(world) {
  wireMyShareName(world);
  const go = $('#share-go'), stop = $('#share-stop'), leave = $('#share-leave'), secSave = $('#share-secs-save');
  if (secSave) {
    $$('[data-secset]').forEach(c => { c.onchange = () => { secSave.hidden = false; }; });
    secSave.onclick = () => busy(secSave, async () => {
      const d = sharedDoc(world), was = d.sections || { rewatch: true };
      const now = Object.fromEntries($$('[data-secset]').map(c => [c.dataset.secset, c.checked]));
      if (!Object.values(now).some(Boolean)) throw new Error('Keep at least one section shared, or tap Stop sharing.');
      const turnedOn = Object.keys(now).filter(k => now[k] && !(k === 'rewatchMarks' ? was[k] !== false && was.rewatch : was[k]));
      const patch = { sections: now };
      // Marks turned off: you keep the marks as they were. Turned back on: the group starts from yours.
      if (was.rewatch && was.rewatchMarks !== false && !now.rewatchMarks) {
        await DB.updateWorld(world, { watched: d.watched || [], rounds: d.rounds || 0, firstWatch: !!d.firstWatch });
      }
      if (now.rewatch && now.rewatchMarks && turnedOn.includes('rewatchMarks') && !turnedOn.includes('rewatch')) {
        Object.assign(patch, { watched: [...watchedOf(world)], rounds: world.rounds || 0, firstWatch: !!world.firstWatch });
      }
      // Newly shared: your own things there join the shared world.
      if (turnedOn.includes('rewatch')) Object.assign(patch, { track: world.track, watched: [...watchedOf(world)], rounds: world.rounds || 0, firstWatch: !!world.firstWatch });
      if (turnedOn.includes('canon') && !d.canon) patch.canon = { ending: world.ending || '', cutoff: world.cutoff ?? null, canonParts: canonParts(world) };
      await DB.updateShared(world.sharedId, patch);
      const me = shareName(world);
      if (turnedOn.includes('rewatch')) {
        for (const n of itemsIn(world.id, 'epnote')) { await DB.addSharedNote(world.sharedId, { step: n.step, text: n.text, byName: me }); await DB.deleteItem(n); }
      }
      await moveIntoShared(world, world.sharedId, turnedOn.filter(k => k !== 'rewatch'), me);
      secSave.hidden = true;
      toast('Shared sections saved');
    }, 'Saving…');
  }
  if (go) go.onclick = () => shareWorldFlow(world);
  const d = sharedDoc(world);
  if (d && !d.gone) wireSafety(document, d, () => { location.hash = `#/w/${world.id}/rewatch`; });
  if (stop) stop.onclick = () => confirmBox('Stop sharing?', 'Everyone keeps their own copy of the tracker and all the notes, but it stops being shared.', 'Stop sharing', async () => {
    await DB.updateShared(world.sharedId, { ended: true });
    await detachShared(world, state.shared[world.sharedId]);
    location.hash = `#/w/${world.id}/rewatch`;
  });
  if (leave) leave.onclick = () => confirmBox('Leave this shared world?', 'You keep your own copy of the tracker and everyone’s notes as they are now.', 'Leave', async () => {
    const sid = world.sharedId;
    await detachShared(world, state.shared[sid]);
    await DB.leaveShared(sid).catch(e => console.warn(e));
    location.hash = `#/w/${world.id}/rewatch`;
  });
}

function shareWorldFlow(world) {
  if (!world.track) return toast('Set up a Rewatch tracker for this world first.', true);
  openModal(`<form id="sf" novalidate><h2>Share ${esc(world.name)}</h2>
    ${world.sharedId ? '<p class="muted small">They’ll join with the sections already shared.</p>' : `<span class="field-label" style="margin-top:12px">What to share</span>
    <div class="share-secs">${SHARE_SECTIONS.map(([k, label]) => `<label class="check"><input type="checkbox" data-sec="${k}" ${k === 'rewatch' ? 'checked' : ''}><span>${label}</span></label>`
      + (k === 'rewatch' ? '<label class="check sub-check"><input type="checkbox" data-sec="rewatchMarks" checked><span>Share watched marks too</span></label>' : '')).join('')}</div>
    <p class="muted small">Unchecking “Share watched marks too” shares the list itself but keeps each person’s watching separate.</p>
    <p class="muted small">Anything unchecked stays private to each of you. What you already have in checked sections moves into the shared world.</p>`}
    <label class="field"><span class="field-label">Their email (the one they sign in with)</span><input type="email" id="to" autocapitalize="off" autocomplete="off" inputmode="email"></label>
    <label class="field"><span class="field-label">Your name for this share (shown on your notes)</span><input id="me" value="${esc(world.sharedId ? shareName(world) : myName())}"></label>
    <p class="error" id="err" hidden></p>
    <div class="actions"><button type="button" class="btn" data-close>Cancel</button><span class="spacer"></span><button class="btn primary" id="send">Send invite</button></div></form>`,
  (root, close) => {
    $('#sf', root).onsubmit = e => {
      e.preventDefault();
      const to = $('#to', root).value.trim().toLowerCase(), me = $('#me', root).value.trim(), err = $('#err', root);
      const fail = m => { err.textContent = m; err.hidden = false; };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return fail('That email doesn’t look right.');
      if (to === DB.myEmail()) return fail('That’s your own email.');
      if (!me) return fail('Add your name.');
      busy($('#send', root), async () => {
        // The name typed here is only for this share; your nickname stays as it is.
        if (world.sharedId) {
          await DB.inviteToShared(world.sharedId, to);
          await DB.updateShared(world.sharedId, { [`names.${DB.myUid()}`]: me });
        } else {
          const secs = $$('[data-sec]', root).filter(c => c.checked).map(c => c.dataset.sec);
          if (!secs.length) throw new Error('Pick at least one thing to share.');
          await startSharing(world, me, to, secs);
        }
        close();
        toast(`Invite sent. It shows up for them the next time they open the app.`);
      }, 'Sending…');
    };
  });
}

// Turns your world into a shared one: tracker + your rewatch notes move to shared/{sid}.
async function startSharing(world, me, email, secs = ['rewatch', 'rewatchMarks']) {
  const sections = Object.fromEntries(SHARE_SECTIONS.map(([k]) => [k, secs.includes(k)]));
  sections.rewatchMarks = secs.includes('rewatchMarks');
  const sid = await DB.createShared({
    name: world.name, theme: world.theme, sections,
    canon: { ending: world.ending || '', cutoff: world.cutoff ?? null, canonParts: canonParts(world) },
    names: { [DB.myUid()]: me }, invited: [email],
    track: world.track, watched: [...watchedOf(world)], rounds: world.rounds || 0, firstWatch: !!world.firstWatch,
    look: {
      look: world.look || null, cardPhoto: world.cardPhoto || null, cardInk: world.cardInk || null,
      cardPos: world.cardPos || null, cardShade: world.cardShade !== false,
    },
  });
  if (sections.rewatch) {
    for (const n of itemsIn(world.id, 'epnote')) {
      await DB.addSharedNote(sid, { step: n.step, text: n.text, byName: me });
      await DB.deleteItem(n);
    }
  }
  await moveIntoShared(world, sid, secs.filter(s => s !== 'rewatch'), me);
  await DB.updateWorld(world, { sharedId: sid });
}

// ---------- being invited ----------
let offered = false;
async function offerJoins() {
  if (offered || !DB.pendingShares) return;
  offered = true;
  const list = await DB.pendingShares().catch(() => []);
  for (const d of list) {
    if (state.worlds.some(w => w.sharedId === d.id) || state.books.some(b => b.sharedId === d.id)) continue;
    if (isBlocked(d.owner)) { DB.declineShared(d.id).catch(() => {}); continue; } // from someone you blocked
    if (d.type === 'book') { await offerBuddyRead(d); continue; } // books.js
    const from = (d.names || {})[d.owner] || 'Someone';
    await new Promise(resolve => openModal(`<form id="jf" novalidate><h2>${esc(from)} shared ${esc(d.name)} with you</h2>
      <p>You’ll share: <b>${esc(sectionNames(d).join(', '))}</b>. Anything else in it stays private to each of you. It becomes a new door; your own worlds don’t change.</p>
      <label class="field join-name"><span class="field-label">Your name: this is how ${esc(from)} will see you</span><input id="me" value="${esc(myName())}"></label>
      <div class="actions"><button type="button" class="btn ghost" id="no">No thanks</button><button type="button" class="btn" data-close>Not now</button><span class="spacer"></span><button class="btn primary" id="yes">Join</button></div>
      ${safetyHtml(d)}</form>`,
    (root, close) => {
      const done = () => { close(); resolve(); };
      root.addEventListener('click', e => { if (e.target === root || e.target.closest('[data-close]')) resolve(); });
      $('#no', root).onclick = () => { DB.declineShared(d.id).catch(() => {}); done(); };
      wireSafety(root, d, () => { DB.declineShared(d.id).catch(() => {}); done(); });
      $('#jf', root).onsubmit = e => {
        e.preventDefault();
        const me = $('#me', root).value.trim() || myName();
        busy($('#yes', root), async () => { await joinSharedWorld(d, me); done(); toast(`${d.name} is on your shelf`); }, 'Joining…');
      };
    }));
  }
}

async function joinSharedWorld(d, me) {
  checkWorldRoom(1);
  await DB.joinShared(d.id, me);
  const from = (d.names || {})[d.owner] || '';
  const L = d.look || {};
  const order = Math.max(-1, ...state.worlds.map(w => w.order ?? 0)) + 1;
  const data = {
    name: d.name, theme: d.theme, sharedId: d.id, track: d.track,
    canonOn: true, canonParts: { ending: true, ships: true, headcanons: true }, cutoff: null, ending: '',
    ficsOn: true, watched: [], rounds: 0, order,
  };
  if (L.look) data.look = { ...L.look, photo: null };
  if (L.cardInk) data.cardInk = L.cardInk;
  if (L.cardPos) data.cardPos = L.cardPos;
  if (L.cardShade === false) data.cardShade = false;
  const id = await DB.addWorld(data);
  // Their own copies of the owner's pictures, so each person can change theirs freely.
  const copy = async p => { try { return await DB.copyPhoto('worlds', id, p); } catch { return p; } };
  const patch = {};
  if (L.cardPhoto) patch.cardPhoto = await copy(L.cardPhoto);
  if (L.look && L.look.photo) patch.look = { ...data.look, photo: await copy(L.look.photo) };
  if (Object.keys(patch).length) await DB.updateWorld({ id }, patch);
}

// ---------- leaving / ending: back to a normal world with a personal copy ----------
async function detachShared(world, view) {
  const sid = world.sharedId;
  if (!sid || detached.has(sid)) return;
  detached.add(sid);
  try {
    const d = view && view.doc && !view.doc.gone ? view.doc : null;
    const patch = { sharedId: null };
    if (d && (d.sections || { rewatch: true }).rewatch) {
      patch.track = d.track;
      if ((d.sections || {}).rewatchMarks !== false) Object.assign(patch, { watched: d.watched || [], rounds: d.rounds || 0, firstWatch: !!d.firstWatch });
    }
    // Everyone's notes become this person's own: theirs as written, others' with names.
    const byStep = {};
    ((view && view.notes) || []).forEach(n => { (byStep[n.step] = byStep[n.step] || []).push(n); });
    for (const [step, list] of Object.entries(byStep)) {
      const mine = list.filter(n => n.by === DB.myUid());
      const text = list.length === 1 && mine.length
        ? mine[0].text
        : list.map(n => `${n.by === DB.myUid() ? 'Me' : (n.byName || 'Someone')}: ${n.text}`).join('\n\n');
      await DB.addItem({ world: world.id, kind: 'epnote', step, text });
    }
    // Everything in the shared sections becomes this person's own copy (with their own copies of photos).
    const sec = (d && d.sections) || {};
    if (d && sec.canon) Object.assign(patch, { canonOn: true, ending: (d.canon && d.canon.ending) || '', cutoff: d.canon ? d.canon.cutoff ?? null : null, canonParts: (d.canon && d.canon.canonParts) || canonParts(world) });
    if (d && sec.fics) patch.ficsOn = true;
    // A buddy read's map comes along too (your own copy of the picture).
    if (d && sec.map) {
      patch.mapOn = true;
      patch.map = d.map || null;
      if (d.map && d.mapBy !== DB.myUid()) { try { patch.map = await DB.copyPhoto('books', world.id, d.map); } catch (e) { console.warn('Kept the map link', e); } }
    }
    const shared = ((view && view.items) || []).filter(i => sec[SECTION_OF[i.kind]]);
    const shipIds = {};
    const ordered = [...shared.filter(i => i.kind === 'ship'), ...shared.filter(i => i.kind !== 'ship')];
    for (const it of ordered) {
      const { id, by, byName, _sid, ...data } = it;
      const nid = DB.newId ? DB.newId('items') : null;
      if (data.kind === 'shippic') data.ship = shipIds[data.ship] || null;
      if (data.photo && by !== DB.myUid()) {
        try { data.photo = await DB.copyPhoto('items', nid || id, data.photo); } catch (e) { console.warn('Kept the photo link', e); }
      }
      const newId = nid ? (await DB.setItem(nid, { ...data, world: world.id }), nid) : await DB.addItem({ ...data, world: world.id });
      if (it.kind === 'ship') shipIds[id] = newId;
    }
    if (world._book) await DB.updateBook(world, patch); else await DB.updateWorld(world, patch);
    toast(`${world.name} is your own again`);
  } catch (e) { console.error(e); toast(friendlyError(e), true); detached.delete(sid); }
}

// ---------- Report and Block ----------
// Block: no more invites from that person, and you leave (or stop, if you
// started it) any world or buddy read you share with them. It asks first, and
// Account & help → Blocked people undoes it. Report: an email to the app's
// maker about a share, with what's needed to find it.
const REPORT_EMAIL = 'keepsakeapps@gmail.com';
const blockedList = () => (state.settings && state.settings.blocked) || [];
const isBlocked = uid => blockedList().some(b => b.uid === uid);
// Everyone in a share but you (the person who started it too), as [uid, name].
const othersIn = d => [...new Set([d.owner, ...(d.members || [])])].filter(u => u && u !== DB.myUid())
  .map(u => [u, (d.names || {})[u] || 'Someone']);

function reportShare(d) {
  const who = othersIn(d).map(([u, n]) => `${n} (${u})`).join(', ');
  const body = `What happened? Write it here:\n\n\n\n(Please keep the lines below so I can find it.)\nShared: ${d.name}\nPeople: ${who}\nShare: ${d.id}\nMy account: ${DB.myUid()}`;
  openModal(`<h2>Report this</h2>
    <p>Something offensive or unwanted in <b>${esc(d.name)}</b>? Tell me and I’ll look into it. I can remove people who misuse sharing.</p>
    <p class="muted small">It opens an email to ${REPORT_EMAIL} with the details filled in. You can also block them so they can’t send you anything again.</p>
    <div class="actions"><button type="button" class="btn" data-close>Cancel</button><span class="spacer"></span>
      <a class="btn primary" data-close href="mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(`My Worlds report: ${d.name}`)}&body=${encodeURIComponent(body)}">Write the email</a></div>`, null, 'small-modal');
}

// Leaves every world and buddy read shared with uid (or stops it, if it's yours).
async function leaveSharesWith(uid) {
  for (const item of [...state.worlds, ...state.books].filter(x => x.sharedId)) {
    const sh = state.shared[item.sharedId], d = sh && sh.doc;
    if (!d || d.gone || d.ended || !othersIn(d).some(([u]) => u === uid)) continue;
    const sid = item.sharedId;
    if (d.owner === DB.myUid()) { await DB.updateShared(sid, { ended: true }); await detachShared(item, sh); }
    else { await detachShared(item, sh); await DB.leaveShared(sid).catch(e => console.warn(e)); }
  }
}

function blockPerson(uid, name, after) {
  confirmBox(`Block ${name}?`, `You won’t get invites from ${name} anymore, and you’ll leave anything you share with them. You can unblock them anytime in Account & help.`, 'Block', async () => {
    const blocked = [...blockedList().filter(b => b.uid !== uid), { uid, name }];
    await DB.saveSettings({ blocked });
    state.settings.blocked = blocked;
    await leaveSharesWith(uid);
    if (after) after();
    toast(`${name} is blocked`);
    refresh();
  });
}

// The Report · Block links under an invite, or in a shared world's / buddy read's settings.
const safetyHtml = d => `<p class="safety-row"><button type="button" class="linkish" data-report>Report</button>`
  + `<span aria-hidden="true">·</span><button type="button" class="linkish danger-text" data-block>Block${othersIn(d).length === 1 ? ` ${esc(othersIn(d)[0][1])}` : '…'}</button></p>`;
function wireSafety(root, d, after) {
  const rep = $('[data-report]', root), blk = $('[data-block]', root);
  if (rep) rep.onclick = () => reportShare(d);
  if (blk) blk.onclick = () => {
    const people = othersIn(d);
    if (people.length === 1) return blockPerson(people[0][0], people[0][1], after);
    openModal(`<h2>Block who?</h2><div class="block-pick">${people.map(([u, n]) => `<button type="button" class="btn block" data-u="${esc(u)}">${esc(n)}</button>`).join('')}</div>
      <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button></div>`, (r, close) => {
      $$('[data-u]', r).forEach(b => { b.onclick = () => { close(); const p = people.find(([u]) => u === b.dataset.u); blockPerson(p[0], p[1], after); }; });
    }, 'small-modal');
  };
}

// Account & help → Blocked people: unblock someone.
function blockedMenu() {
  const list = blockedList();
  openModal(`<h2>Blocked people</h2>
    ${list.length ? `<p class="muted small">They can’t send you invites. Unblock someone to let them share with you again.</p>
      <div class="blocked-list">${list.map(b => `<div class="blocked-row"><span>${esc(b.name)}</span><button type="button" class="btn small" data-unblock="${esc(b.uid)}">Unblock</button></div>`).join('')}</div>`
      : '<p class="muted small">No one is blocked.</p>'}
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-close>Done</button></div>`, (root, close) => {
    $$('[data-unblock]', root).forEach(btn => {
      btn.onclick = () => busy(btn, async () => {
        const blocked = blockedList().filter(b => b.uid !== btn.dataset.unblock);
        await DB.saveSettings({ blocked });
        state.settings.blocked = blocked;
        close();
        toast('Unblocked');
        blockedMenu();
      }, 'Unblocking…');
    });
  }, 'small-modal');
}
