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
const isSharedOwner = world => {
  const sh = world.sharedId && state.shared[world.sharedId];
  return !!(sh && sh.doc && sh.doc.owner === DB.myUid());
};
const sharedDoc = world => (world.sharedId && state.shared[world.sharedId] && state.shared[world.sharedId].doc) || null;

// The world as its Rewatch should see it: the shared tracker when there is one.
function withShared(world) {
  const d = sharedDoc(world);
  if (!d || d.gone) return world;
  return { ...world, track: d.track, watched: d.watched || [], rounds: d.rounds || 0, firstWatch: !!d.firstWatch };
}

// Listen to every shared world this account has a door for.
function syncSharedWatches() {
  if (!DB.watchShared) return;
  const want = new Set(state.worlds.filter(w => w.sharedId).map(w => w.sharedId));
  Object.keys(sharedStops).forEach(sid => {
    if (!want.has(sid)) { sharedStops[sid](); delete sharedStops[sid]; delete state.shared[sid]; }
  });
  want.forEach(sid => {
    if (sharedStops[sid]) return;
    sharedStops[sid] = DB.watchShared(sid, view => {
      state.shared[sid] = view;
      const world = state.worlds.find(w => w.sharedId === sid);
      const d = view.doc;
      // Ended by the owner, or no longer a member: keep a personal copy.
      if (world && d && !d.gone && (d.ended || !(d.members || []).includes(DB.myUid()))) detachShared(world, view);
      else if (world && d && d.gone && !d.error) detachShared(world, view);
      else if (state.loaded) refresh();
    });
  });
}

// ---------- sharing a world ----------
function shareSettingsHtml(world) {
  const d = sharedDoc(world);
  if (!world.sharedId) {
    return `<h2 class="form-h">Share</h2>
      <p class="muted small">Share this world’s Rewatch tracker and notes with family. You’ll each keep your own look.</p>
      <button type="button" class="btn small" id="share-go">Share this world…</button>`;
  }
  if (!d || d.gone) return '<h2 class="form-h">Share</h2><p class="muted small">Loading…</p>';
  const names = Object.entries(d.names || {}).filter(([u]) => (d.members || []).includes(u)).map(([, n]) => n);
  const pending = (d.invited || []);
  const owner = d.owner === DB.myUid();
  return `<h2 class="form-h">Share</h2>
    <p class="small">Shared Rewatch with <b>${esc(names.join(', ') || 'just you so far')}</b>.</p>
    ${pending.length ? `<p class="muted small">Waiting on: ${pending.map(esc).join(', ')}</p>` : ''}
    <div class="row-btns">
      ${owner ? '<button type="button" class="btn small" id="share-go">Invite someone…</button><button type="button" class="btn small ghost danger-text" id="share-stop">Stop sharing</button>'
        : '<button type="button" class="btn small ghost danger-text" id="share-leave">Leave shared world</button>'}
    </div>`;
}

function wireShareSettings(world) {
  const go = $('#share-go'), stop = $('#share-stop'), leave = $('#share-leave');
  if (go) go.onclick = () => shareWorldFlow(world);
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
    <p>What’s shared: <b>the Rewatch tracker and notes</b>. Watched marks are shared; everyone’s notes show side by side.</p>
    <p class="muted small" style="margin-top:6px">Boards, quotes, favorites, canon and fics stay your own for now.</p>
    <label class="field"><span class="field-label">Their email (the one they sign in with)</span><input type="email" id="to" autocapitalize="off" autocomplete="off" inputmode="email"></label>
    <label class="field"><span class="field-label">Your name (shown on your notes)</span><input id="me" value="${esc(myName())}"></label>
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
        if (me !== state.settings.displayName) { await DB.saveSettings({ displayName: me }); state.settings.displayName = me; }
        if (world.sharedId) {
          await DB.inviteToShared(world.sharedId, to);
          await DB.updateShared(world.sharedId, { [`names.${DB.myUid()}`]: me });
        } else {
          await startSharing(world, me, to);
        }
        close();
        toast(`Invite sent. It shows up for them the next time they open the app.`);
      }, 'Sending…');
    };
  });
}

// Turns your world into a shared one: tracker + your rewatch notes move to shared/{sid}.
async function startSharing(world, me, email) {
  const sid = await DB.createShared({
    name: world.name, theme: world.theme, sections: { rewatch: true },
    names: { [DB.myUid()]: me }, invited: [email],
    track: world.track, watched: [...watchedOf(world)], rounds: world.rounds || 0, firstWatch: !!world.firstWatch,
    look: {
      look: world.look || null, cardPhoto: world.cardPhoto || null, cardInk: world.cardInk || null,
      cardPos: world.cardPos || null, cardShade: world.cardShade !== false,
    },
  });
  for (const n of itemsIn(world.id, 'epnote')) {
    await DB.addSharedNote(sid, { step: n.step, text: n.text, byName: me });
    await DB.deleteItem(n);
  }
  await DB.updateWorld(world, { sharedId: sid });
}

// ---------- being invited ----------
let offered = false;
async function offerJoins() {
  if (offered || !DB.pendingShares) return;
  offered = true;
  const list = await DB.pendingShares().catch(() => []);
  for (const d of list) {
    if (state.worlds.some(w => w.sharedId === d.id)) continue;
    const from = (d.names || {})[d.owner] || 'Someone';
    await new Promise(resolve => openModal(`<form id="jf" novalidate><h2>${esc(from)} shared ${esc(d.name)} with you</h2>
      <p>You’ll share its <b>Rewatch tracker and notes</b>. It becomes a new door; your own worlds don’t change.</p>
      <label class="field"><span class="field-label">Your name (shown on your notes)</span><input id="me" value="${esc(myName())}"></label>
      <div class="actions"><button type="button" class="btn ghost" id="no">No thanks</button><button type="button" class="btn" data-close>Not now</button><span class="spacer"></span><button class="btn primary" id="yes">Join</button></div></form>`,
    (root, close) => {
      const done = () => { close(); resolve(); };
      root.addEventListener('click', e => { if (e.target === root || e.target.closest('[data-close]')) resolve(); });
      $('#no', root).onclick = () => { DB.declineShared(d.id).catch(() => {}); done(); };
      $('#jf', root).onsubmit = e => {
        e.preventDefault();
        const me = $('#me', root).value.trim() || myName();
        busy($('#yes', root), async () => { await joinSharedWorld(d, me); done(); toast(`${d.name} is on your shelf`); }, 'Joining…');
      };
    }));
  }
}

async function joinSharedWorld(d, me) {
  await DB.joinShared(d.id, me);
  if (me !== state.settings.displayName) { await DB.saveSettings({ displayName: me }); state.settings.displayName = me; }
  const from = (d.names || {})[d.owner] || '';
  const L = d.look || {};
  const order = Math.max(-1, ...state.worlds.map(w => w.order ?? 0)) + 1;
  const data = {
    name: from ? `${d.name} (with ${from})` : d.name, theme: d.theme, sharedId: d.id, track: d.track,
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
    if (d) Object.assign(patch, { track: d.track, watched: d.watched || [], rounds: d.rounds || 0, firstWatch: !!d.firstWatch });
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
    await DB.updateWorld(world, patch);
    toast(`${world.name} is your own again`);
  } catch (e) { console.error(e); toast(friendlyError(e), true); detached.delete(sid); }
}
