/* Inside a world: Mood board, Quotes, Favorites, My Canon (optional), Fics
   and Rewatch. Every add/edit happens in a pop-up (formModal in app.js), so
   the page itself never holds half-typed text when new data arrives. */

const SECTIONS = [
  ['board', 'Board'], ['quotes', 'Quotes'], ['favs', 'Favorites'],
  ['canon', 'My Canon'], ['fics', 'Fics'], ['rewatch', 'Rewatch'],
];

const byNewest = (a, b) => (b.t || 0) - (a.t || 0);
const byOldest = (a, b) => (a.t || 0) - (b.t || 0);
const empty = (world, text) => `<p class="empty">${esc(text || Themes.info(world).empty)}</p>`;
const addBtn = (id, label) => `<button class="btn primary add-btn" id="${id}"><span aria-hidden="true">+</span> ${esc(label)}</button>`;

function renderWorld(world, section) {
  world = withShared(world);
  const sections = SECTIONS.filter(([k]) => (k !== 'canon' || world.canonOn) && (k !== 'fics' || world.ficsOn !== false));
  if (!sections.some(([k]) => k === section)) section = 'board';
  const colors = Themes.info(world).tabColors || {};

  view.innerHTML = `<div class="page world">
    <header class="w-head">
      <a class="back" href="#/">‹ Worlds</a>
      <a class="gear" href="#/w/${world.id}/settings" aria-label="World settings"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/></svg></a>
    </header>
    <div class="w-hero"><h1 class="w-title">${esc(world.name)}</h1><div class="w-flourish" aria-hidden="true"></div></div>
    <nav class="w-tabs" aria-label="Sections">${sections.map(([k, label]) =>
      `<a href="#/w/${world.id}/${k}" style="${colors[k] ? `--tab:${colors[k]}` : ''}" ${k === section ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    <section class="w-body" id="wb" style="${colors[section] ? `--tab:${colors[section]}` : ''}"></section>
  </div>`;

  const body = $('#wb');
  ({ board: drawBoard, quotes: drawQuotes, favs: drawFavs, canon: drawCanon, fics: drawFics, rewatch: drawRewatch })[section](world, body);
}

// Little filter chips (by character, by ship). Remembered per world + section.
function chips(world, key, values) {
  const uniq = [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  if (uniq.length < 2) return { html: '', pick: null };
  const fk = `${world.id}:${key}`;
  let pick = state.filters[fk];
  if (pick && !uniq.includes(pick)) pick = state.filters[fk] = null;
  const html = `<div class="chips" data-fk="${esc(fk)}"><button class="chip ${pick ? '' : 'on'}" data-v="">All</button>${uniq.map(v =>
    `<button class="chip ${v === pick ? 'on' : ''}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
  return { html, pick };
}
function wireChips(body, redraw) {
  const row = $('.chips', body);
  if (!row) return;
  row.onclick = e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    state.filters[row.dataset.fk] = b.dataset.v || null;
    redraw();
  };
}

// ---------- Mood board ----------
// A photo board: used for the world's mood board and for each ship's page.
// newItem = the fields every added photo gets ({ world, kind, ... }).
// The page redraws as each photo arrives, so upload progress lives out here.
const uploads = {};
function photoBoard(world, body, pins, newItem, emptyText) {
  const key = `${newItem.kind}:${newItem.ship || world.id}`;
  body.insertAdjacentHTML('beforeend', `<label class="btn primary add-btn"><span aria-hidden="true">+</span> Add photos<input type="file" accept="image/*" multiple hidden class="pinfile"></label>
    <p class="muted small progress" ${uploads[key] ? '' : 'hidden'}>${esc(uploads[key] || '')}</p>
    ${pins.length ? `<div class="board">${pins.map(p => `<button class="pin" data-id="${p.id}"><img src="${esc(p.photo && p.photo.thumbUrl)}" alt="${esc(p.caption || 'Photo')}" loading="lazy" ${p.photo ? `width="${p.photo.w}" height="${p.photo.h}"` : ''}>${p.caption || byLine(p) ? `<span class="pin-cap">${esc(p.caption || '')}${byLine(p)}</span>` : ''}</button>`).join('')}</div>` : empty(world, emptyText)}`);

  $('.pinfile', body).onchange = async e => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    try { checkPhotoRoom(files.length); } catch (x) { toast(x.message, true); return; }
    const show = text => {
      uploads[key] = text;
      const prog = $('.progress');
      if (prog) { prog.textContent = text || ''; prog.hidden = !text; }
    };
    let done = 0;
    try {
      for (const f of files) {
        show(`Adding ${done + 1} of ${files.length}…`);
        await addItemFor(world, { ...newItem, caption: '' }, await Photos.prepare(f));
        done++;
      }
      toast(done === 1 ? 'Photo added' : `${done} photos added`);
    } catch (x) { console.error(x); toast(friendlyError(x), true); }
    show(null);
  };

  $$('.pin', body).forEach(el => {
    el.onclick = () => {
      const pin = findItem(el.dataset.id);
      // Offline, the full-size photo may not be saved on the phone yet; the small one always is.
      if (!canEdit(pin)) {
        return openModal(`<img class="viewer-img" src="${esc(pin.photo.url)}" onerror="this.onerror=null;this.src='${esc(pin.photo.thumbUrl)}'" alt="">
          ${pin.caption ? `<p style="margin-top:10px">${esc(pin.caption)}</p>` : ''}<p class="muted small" style="margin-top:8px">Added by ${esc(pin.byName || 'someone else')}.</p>
          <div class="actions"><span class="spacer"></span><button class="btn" data-close>Close</button></div>`, null, 'viewer');
      }
      openModal(`<img class="viewer-img" src="${esc(pin.photo.url)}" onerror="this.onerror=null;this.src='${esc(pin.photo.thumbUrl)}'" alt="">
        <label class="field"><span class="field-label">Caption (optional)</span><input id="cap" value="${esc(pin.caption || '')}"></label>
        <div class="actions"><button class="btn ghost danger-text" id="del">Delete</button><span class="spacer"></span><button class="btn" data-close>Close</button><button class="btn primary" id="save">Save</button></div>`,
      (root, close) => {
        $('#save', root).onclick = e => busy(e.target, async () => { await updateItemFor(pin, { caption: $('#cap', root).value.trim() }); close(); });
        $('#del', root).onclick = () => { close(); confirmBox('Delete this photo?', 'It’s removed for good.', 'Delete', () => deleteItemFor(pin)); };
      }, 'viewer');
    };
  });
}

function drawBoard(world, body) {
  body.innerHTML = '';
  photoBoard(world, body, itemsFor(world, 'pin').sort(byNewest), { world: world.id, kind: 'pin' });
}

// ---------- Quotes ----------
function quoteForm(world, q) {
  if (q && !canEdit(q)) return viewOnly(q, `<h2>Quote</h2><p class="quote-text" style="margin-top:8px">${esc(q.text)}</p>${q.who || q.where ? `<p class="muted small">— ${esc([q.who, q.where].filter(Boolean).join(', '))}</p>` : ''}`);
  formModal({
    title: q ? 'Edit quote' : 'Add a quote',
    values: q || {},
    fields: [
      { key: 'text', label: 'Quote', type: 'textarea' },
      { key: 'who', label: 'Who said it', placeholder: world.theme === 'twd' ? 'Daryl' : '' },
      { key: 'where', label: 'Where (optional)', placeholder: world.track && world.track.type === 'list' ? 'Which film' : 'S2 E5' },
    ],
    onSave: async v => {
      if (!v.text) throw new Error('Type the quote first.');
      if (q) await updateItemFor(q, v); else await addItemFor(world, { world: world.id, kind: 'quote', ...v });
    },
    onDelete: q && (() => confirmBox('Delete this quote?', '', 'Delete', () => deleteItemFor(q))),
  });
}

function drawQuotes(world, body) {
  const all = itemsFor(world, 'quote').sort(byNewest);
  const { html, pick } = chips(world, 'who', all.map(q => q.who));
  const list = pick ? all.filter(q => q.who === pick) : all;
  body.innerHTML = `${addBtn('addq', 'Add a quote')}${html}
    ${list.length ? `<div class="quotes">${list.map(q => `<button class="quote card" data-id="${q.id}">
      <span class="quote-text">${esc(q.text)}</span>
      ${q.who || q.where ? `<span class="quote-by">— ${esc([q.who, q.where].filter(Boolean).join(', '))}</span>` : ''}${byLine(q)}</button>`).join('')}</div>` : empty(world)}`;
  $('#addq').onclick = () => quoteForm(world);
  wireChips(body, () => drawQuotes(world, body));
  $$('.quote', body).forEach(el => { el.onclick = () => quoteForm(world, findItem(el.dataset.id)); });
}

// ---------- Favorites ----------
const favsOf = world => itemsFor(world, 'fav').sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || byOldest(a, b));
const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');

function favForm(world, f) {
  if (f && !canEdit(f)) return viewOnly(f, `<h2>${esc(f.name)}</h2>${f.quote ? `<p style="margin-top:8px"><i>“${esc(f.quote)}”</i></p>` : ''}${f.note ? `<p>${esc(f.note)}</p>` : ''}`);
  formModal({
    title: f ? `Edit ${f.name}` : 'Add a favorite',
    values: f || {},
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'photo', label: 'Photo', type: 'photo' },
      { key: 'quote', label: 'Favorite line (optional)', type: 'textarea' },
      { key: 'note', label: 'Why I love them (optional)', type: 'textarea' },
    ],
    extra: f ? `<div class="row-btns"><button type="button" class="btn small" data-move="-1">Move up</button><button type="button" class="btn small" data-move="1">Move down</button></div>` : '',
    onSave: async (v, { photo, dropPhoto }) => {
      if (!v.name) throw new Error('Add a name.');
      if (photo && !(f && f.photo)) checkPhotoRoom(1);
      if (f) await updateItemFor(f, v, photo, dropPhoto);
      else await addItemFor(world, { world: world.id, kind: 'fav', order: favsOf(world).length, ...v }, photo);
    },
    onDelete: f && (() => confirmBox(`Remove ${f.name}?`, '', 'Remove', () => deleteItemFor(f))),
  });
  if (!f) return;
  $$('[data-move]').forEach(b => {
    b.onclick = () => {
      const list = favsOf(world);
      const i = list.findIndex(x => x.id === f.id), j = i + Number(b.dataset.move);
      if (j < 0 || j >= list.length) return toast(j < 0 ? 'Already first.' : 'Already last.');
      [list[i], list[j]] = [list[j], list[i]];
      Promise.all(list.map((x, k) => (x.order === k ? null : updateItemFor(x, { order: k }))))
        .then(() => toast(j < i ? 'Moved up' : 'Moved down'), e => toast(friendlyError(e), true));
    };
  });
}

function drawFavs(world, body) {
  const list = favsOf(world);
  body.innerHTML = `${addBtn('addf', 'Add a favorite')}
    ${list.length ? `<div class="favs">${list.map((f, i) => `<button class="fav card" data-id="${f.id}">
      <span class="fav-rank">${i + 1}</span>
      <span class="fav-photo">${f.photo ? `<img src="${esc(f.photo.thumbUrl)}" alt="" loading="lazy">` : `<span class="fav-initials">${esc(initials(f.name))}</span>`}</span>
      <span class="fav-name">${esc(f.name)}</span>${byLine(f)}
      ${f.quote ? `<span class="fav-quote">“${esc(f.quote)}”</span>` : ''}
      ${f.note ? `<span class="fav-note">${esc(f.note)}</span>` : ''}</button>`).join('')}</div>` : empty(world)}`;
  $('#addf').onclick = () => favForm(world);
  $$('.fav', body).forEach(el => { el.onclick = () => favForm(world, findItem(el.dataset.id)); });
}

// ---------- My Canon ----------
// Which parts My Canon shows (picked in world settings). Older worlds show all three.
const canonParts = world => ({ ending: true, ships: true, headcanons: true, ...(world.canonParts || {}) });
const shipPhotos = ship => (ship._sid
  ? ((state.shared[ship._sid] || {}).items || []).map(i => ({ ...i, world: ship.world, _sid: ship._sid }))
  : state.items).filter(i => i.kind === 'shippic' && i.ship === ship.id).sort(byNewest);

function endingForm(world) {
  formModal({
    title: 'My ending',
    values: { ending: world.ending },
    fields: [{ key: 'ending', label: 'How it really ends', type: 'textarea', big: true, placeholder: 'In my version…' }],
    onSave: v => setCanonField(world, { ending: v.ending }),
  });
}

function shipForm(world, s) {
  if (s && !canEdit(s)) return viewOnly(s, `<h2>${esc(s.name)}</h2>${s.note ? `<p style="margin-top:8px">${esc(s.note)}</p>` : ''}`);
  formModal({
    title: s ? `Edit ${s.name}` : 'Add a ship',
    values: s || {},
    fields: [
      { key: 'name', label: 'Ship name', placeholder: 'Zutara' },
      { key: 'colors', label: 'Colors', type: 'colors', palette: Themes.palette(world) },
      { key: 'note', label: 'Notes (optional)', type: 'textarea', placeholder: 'Endgame.' },
    ],
    onSave: async v => {
      if (!v.name) throw new Error('Name the ship.');
      if (s) await updateItemFor(s, v); else await addItemFor(world, { world: world.id, kind: 'ship', ...v });
    },
    onDelete: s && (() => {
      const pics = shipPhotos(s);
      confirmBox(`Remove ${s.name}?`, pics.length ? `Its ${pics.length} photo${pics.length === 1 ? '' : 's'} will be deleted too.` : '', 'Remove', async () => {
        for (const p of pics) await deleteItemFor(p);
        await deleteItemFor(s);
        if (parseHash()[2] === 'ship') location.hash = `#/w/${world.id}/canon`;
      });
    }),
  });
}

// A ship's own page: its colors across the top, then a photo board.
function renderShip(world, shipId) {
  world = withShared(world);
  const found = findItem(shipId);
  const ship = found && found.kind === 'ship' ? found : null;
  if (!ship) { location.replace(`#/w/${world.id}/canon`); return; }
  const [a, b] = ship.colors || Themes.palette(world).map(p => p[1]);
  view.innerHTML = `<div class="page world">
    <header class="w-head"><a class="back" href="#/w/${world.id}/canon">‹ My Canon</a><button class="linkish edit-ship" id="edit">Edit</button></header>
    <div class="ship ship-hero" style="--a:${a};--b:${b}"><span class="ship-name">${esc(ship.name)}</span>${ship.note ? `<span class="ship-note">${esc(ship.note)}</span>` : ''}</div>
    <section class="w-body" id="wb"></section></div>`;
  $('#edit').onclick = () => shipForm(world, ship);
  photoBoard(world, $('#wb'), shipPhotos(ship), { world: world.id, kind: 'shippic', ship: ship.id }, `No photos of ${ship.name} yet.`);
}

function headcanonForm(world, h) {
  if (h && !canEdit(h)) return viewOnly(h, `<h2>Headcanon</h2><p style="margin-top:8px">${esc(h.text).replace(/\n/g, '<br>')}</p>`);
  formModal({
    title: h ? 'Edit headcanon' : 'Add a headcanon',
    values: h || {},
    fields: [{ key: 'text', label: 'In my world…', type: 'textarea' }],
    onSave: async v => {
      if (!v.text) throw new Error('Write the headcanon first.');
      if (h) await updateItemFor(h, v); else await addItemFor(world, { world: world.id, kind: 'headcanon', ...v });
    },
    onDelete: h && (() => confirmBox('Delete this headcanon?', '', 'Delete', () => deleteItemFor(h))),
  });
}

function cutoffSelect(world, steps) {
  if (!steps.length || world.track.type === 'collection') return '';
  const groups = new Map();
  steps.forEach((s, i) => {
    const g = world.track.type === 'list' ? 0 : s.group;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(`<option value="${i}" ${world.cutoff === i ? 'selected' : ''}>${esc(world.track.type === 'list' ? s.label : s.title ? `${s.short} · ${s.title}` : s.short)}</option>`);
  });
  return `<label class="field cutoff-field"><span class="field-label">My story ends after</span>
    <select id="cutoff"><option value="">The real ending (no cutoff)</option>
    ${[...groups].map(([g, opts]) => `<optgroup label="${esc(Themes.groupName(world.track, g))}">${opts.join('')}</optgroup>`).join('')}</select></label>`;
}

function drawCanon(world, body) {
  world = withShared(world);
  const steps = Themes.steps(world.track, world.theme);
  const cut = world.cutoff != null && steps[world.cutoff];
  const ships = itemsFor(world, 'ship').sort(byOldest);
  const heads = itemsFor(world, 'headcanon').sort(byNewest);
  const info = Themes.info(world);
  const parts = canonParts(world);

  // Only ships, and just one: that ship's page fills My Canon.
  if (!parts.ending && !parts.headcanons && ships.length === 1) {
    const ship = ships[0];
    const [a, b] = ship.colors || Themes.palette(world).map(p => p[1]);
    body.innerHTML = `<button class="ship ship-hero" id="edit-ship" style="--a:${a};--b:${b}" aria-label="Edit ${esc(ship.name)}"><span class="ship-name">${esc(ship.name)}</span>${ship.note ? `<span class="ship-note">${esc(ship.note)}</span>` : ''}</button>`;
    photoBoard(world, body, shipPhotos(ship), { world: world.id, kind: 'shippic', ship: ship.id }, `No photos of ${ship.name} yet.`);
    body.insertAdjacentHTML('beforeend', '<p class="center" style="margin-top:22px"><button class="btn small" id="adds">+ Add another ship</button></p>');
    $('#edit-ship').onclick = () => shipForm(world, ship);
    $('#adds').onclick = () => shipForm(world);
    return;
  }

  body.innerHTML = `
    ${parts.ending ? `<div class="card canon-end">
      ${cut ? `<div class="the-end"><span class="the-end-word">${esc(info.theEnd)}</span><span class="the-end-at">${esc(cut.title && world.track.type !== 'list' ? `${cut.short} · ${cut.title}` : cut.label)}</span></div>` : ''}
      ${cutoffSelect(world, steps)}
      <div class="ending-text">${world.ending ? esc(world.ending).replace(/\n/g, '<br>') : '<span class="muted">Write how it really ends, in your version.</span>'}</div>
      <button class="btn small" id="edit-end">${world.ending ? 'Edit my ending' : 'Write my ending'}</button>
    </div>` : ''}

    ${parts.ships ? `<h2 class="sec-h">Ships</h2>
    ${ships.length ? `<div class="ships">${ships.map(s => {
      const [a, b] = s.colors || Themes.palette(world).map(p => p[1]);
      const pics = shipPhotos(s);
      return `<a class="ship" href="#/w/${world.id}/ship/${s.id}" style="--a:${a};--b:${b}"><span class="ship-name">${esc(s.name)}</span>${s.note ? `<span class="ship-note">${esc(s.note)}</span>` : ''}${byLine(s)}
        ${pics.length ? `<span class="ship-strip">${pics.slice(0, 4).map(p => `<img src="${esc(p.photo.thumbUrl)}" alt="" loading="lazy">`).join('')}${pics.length > 4 ? `<span class="ship-more">+${pics.length - 4}</span>` : ''}</span>` : '<span class="ship-hint">Tap to add photos</span>'}</a>`;
    }).join('')}</div>` : ''}
    <button class="btn small" id="adds">+ Add a ship</button>` : ''}

    ${parts.headcanons ? `<h2 class="sec-h">Headcanons</h2>
    ${heads.length ? `<div class="heads">${heads.map(h => `<button class="head card" data-id="${h.id}">${esc(h.text).replace(/\n/g, '<br>')}${byLine(h)}</button>`).join('')}</div>` : ''}
    <button class="btn small" id="addh">+ Add a headcanon</button>` : ''}`;

  const on = (sel, fn) => { const el = $(sel, body); if (el) el.onclick = fn; };
  on('#edit-end', () => endingForm(world));
  on('#adds', () => shipForm(world));
  on('#addh', () => headcanonForm(world));
  const sel = $('#cutoff');
  if (sel) {
    sel.onchange = () => {
      const v = sel.value === '' ? null : Number(sel.value);
      setCanonField(world, { cutoff: v }).then(() => toast(v == null ? 'Back to the real ending' : `Your story ends at ${steps[v].short || steps[v].label}`), e => toast(friendlyError(e), true));
    };
  }
  $$('.head', body).forEach(el => { el.onclick = () => headcanonForm(world, findItem(el.dataset.id)); });
}

// ---------- Fics ----------
// AO3 links get tidied to the work itself (not a chapter or comments page).
function tidyLink(url) {
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const ao3 = /archiveofourown\.org\/(?:collections\/[^/]+\/)?works\/(\d+)/i.exec(url);
  return ao3 ? `https://archiveofourown.org/works/${ao3[1]}` : url;
}

function ficForm(world, f) {
  if (f && !canEdit(f)) return viewOnly(f, `<h2>${esc(f.title)}</h2>${f.author ? `<p class="muted small">by ${esc(f.author)}</p>` : ''}${f.note ? `<p style="margin-top:8px">${esc(f.note)}</p>` : ''}${f.url ? `<p style="margin-top:10px"><a class="btn small" href="${esc(f.url)}" target="_blank" rel="noopener">Open on AO3 ↗</a></p>` : ''}`);
  const ships = [...new Set(itemsFor(world, 'ship').map(s => s.name).concat(itemsFor(world, 'fic').map(x => x.ship)).filter(Boolean))];
  formModal({
    title: f ? 'Edit fic' : 'Save a fic',
    values: f || {},
    fields: [
      { key: 'url', label: 'AO3 link', type: 'url', placeholder: 'archiveofourown.org/works/…' },
      { key: 'title', label: 'Title' },
      { key: 'author', label: 'Author (optional)' },
      { key: 'ship', label: 'Ship (optional)', placeholder: ships[0] || '' },
      { key: 'note', label: 'Note to self (optional)', type: 'textarea', placeholder: 'The one where…' },
    ],
    onSave: async v => {
      v.url = tidyLink(v.url);
      if (!v.url && !v.title) throw new Error('Paste the link or type the title.');
      if (!v.title) {
        const id = /works\/(\d+)/.exec(v.url);
        v.title = id ? `AO3 work ${id[1]}` : 'Untitled fic';
      }
      if (f) await updateItemFor(f, v); else await addItemFor(world, { world: world.id, kind: 'fic', ...v });
    },
    onDelete: f && (() => confirmBox('Remove this fic?', 'Only the saved link is removed, not the fic.', 'Remove', () => deleteItemFor(f))),
  });
  // Ship suggestions from this world's ships and earlier fics.
  if (ships.length) {
    const input = $('[name="ship"]');
    const dl = document.createElement('datalist');
    dl.id = 'shiplist';
    dl.innerHTML = ships.map(s => `<option value="${esc(s)}">`).join('');
    input.after(dl);
    input.setAttribute('list', 'shiplist');
  }
}

function drawFics(world, body) {
  const all = itemsFor(world, 'fic').sort(byNewest);
  const { html, pick } = chips(world, 'ship', all.map(f => f.ship));
  const list = pick ? all.filter(f => f.ship === pick) : all;
  body.innerHTML = `${addBtn('addfic', 'Save a fic')}${html}
    ${list.length ? `<div class="fics">${list.map(f => `<div class="fic card">
      <a class="fic-main" href="${esc(f.url || '#')}" target="_blank" rel="noopener">
        <span class="fic-title">${esc(f.title)}</span>
        ${f.author ? `<span class="fic-by">by ${esc(f.author)}</span>` : ''}${byLine(f)}
        ${f.ship ? `<span class="tag">${esc(f.ship)}</span>` : ''}
        ${f.note ? `<span class="fic-note">${esc(f.note)}</span>` : ''}
      </a>
      <button class="fic-edit" data-id="${f.id}" aria-label="Edit ${esc(f.title)}">Edit</button></div>`).join('')}</div>` : empty(world)}`;
  $('#addfic').onclick = () => ficForm(world);
  wireChips(body, () => drawFics(world, body));
  $$('.fic-edit', body).forEach(el => { el.onclick = () => ficForm(world, findItem(el.dataset.id)); });
}

// ---------- Rewatch ----------
// Episode/movie notes are items of kind 'epnote', matched to a step by its
// full label ("Season 5, Episode 1" or a film title), so they survive a rewatch restart.
function epNoteForm(world, step, note) {
  formModal({
    title: `Notes · ${step.title || step.short}`,
    values: note || {},
    fields: [{ key: 'text', label: step.title && world.track.type !== 'list' ? `${step.short} · ${step.label}` : step.label, type: 'textarea', big: true, placeholder: 'What stood out this time…' }],
    onSave: async v => {
      const sid = world.sharedId && sectionShared(world, 'rewatch') ? world.sharedId : null;
      if (sid) {
        if (note && !v.text) return DB.deleteSharedNote(sid, note);
        if (!v.text) return;
        if (note) return DB.updateSharedNote(sid, note, { text: v.text, byName: shareName(world) });
        return DB.addSharedNote(sid, { step: step.key, text: v.text, byName: shareName(world) });
      }
      if (note && !v.text) return deleteItemFor(note);
      if (!v.text) return;
      if (note) await updateItemFor(note, v); else await addItemFor(world, { world: world.id, kind: 'epnote', step: step.key, ...v });
    },
    onDelete: note && (() => confirmBox('Delete this note?', '', 'Delete', () => (world.sharedId && sectionShared(world, 'rewatch') ? DB.deleteSharedNote(world.sharedId, note) : deleteItemFor(note)))),
  });
}

// Folded Disney-style sections, remembered on this phone only.
function foldedSections(worldId) {
  try { return (JSON.parse(localStorage.getItem('fw-folded') || '{}')[worldId]) || []; } catch { return []; }
}
function foldSection(worldId, g, folded) {
  try {
    const all = JSON.parse(localStorage.getItem('fw-folded') || '{}');
    const set = new Set(all[worldId] || []);
    if (folded) set.add(g); else set.delete(g);
    all[worldId] = [...set];
    localStorage.setItem('fw-folded', JSON.stringify(all));
  } catch {}
}

// Which episodes/films are watched: a list of step indexes, so skipping is fine.
// (Older saves kept only "watched through" in world.at.)
const watchedOf = world => new Set(Array.isArray(world.watched)
  ? world.watched
  : [...Array(Math.max(0, (world.at ?? -1) + 1)).keys()]);

const NOTE_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18M4 7h4M4 12h4M4 17h4M11 8h5M11 12h5"/></svg>';

function drawRewatch(world, body) {
  // A shared world's tracker, watched marks and notes live in shared/{sid} (together.js).
  if (world.sharedId && (!state.shared[world.sharedId] || !state.shared[world.sharedId].doc)) { body.innerHTML = '<p class="empty">Opening the shared tracker…</p>'; return; }
  const sid = world.sharedId && sectionShared(world, 'rewatch') ? world.sharedId : null;
  const sh = sid ? state.shared[sid] : null;
  world = withShared(world);
  if (world.track && world.track.type === 'collection') return drawCollection(world, body);
  const steps = Themes.steps(world.track, world.theme);
  if (!steps.length) {
    body.innerHTML = `<p class="empty">No rewatch tracker for this world.</p>
      <p class="center"><a class="btn small" href="#/w/${world.id}/settings">Set one up</a></p>`;
    return;
  }
  const watched = watchedOf(world);
  const cutoff = world.canonOn && canonParts(world).ending && world.cutoff != null ? world.cutoff : null;
  const end = cutoff ?? steps.length - 1;
  // A world made while watching for the first time counts "First watch", then Rewatch #1, #2…
  const rounds = world.rounds || 0;
  const roundName = n => (world.firstWatch ? (n === 0 ? 'First watch' : `Rewatch #${n}`) : `Rewatch #${n + 1}`);
  const info = Themes.info(world);
  const isList = world.track.type === 'list';
  const allShared = sh ? sh.notes : null;
  const notes = new Map((allShared ? allShared.filter(n => n.by === DB.myUid()) : itemsFor(world, 'epnote')).map(n => [n.step, n]));
  const noteAt = i => notes.get(steps[i].key);   // your own note
  const anyNote = i => (allShared ? allShared.some(n => n.step === steps[i].key) : !!noteAt(i));
  const others = sh ? Object.entries(sh.doc.names || {}).filter(([u]) => u !== DB.myUid() && (sh.doc.members || []).includes(u)).map(([, n]) => n) : [];
  const name = i => (isList ? steps[i].label : steps[i].short);

  // The episode shown in the big card. Arrows move it without changing
  // anything saved; it starts just after the furthest one watched.
  const curKey = `${world.id}:cur`;
  if (state.filters[curKey] == null || state.filters[curKey] >= steps.length) {
    const furthest = Math.max(-1, ...[...watched].filter(i => i <= end));
    state.filters[curKey] = Math.min(furthest + 1, end);
  }
  const cur = state.filters[curKey];
  const curSeen = watched.has(cur);
  const seenInCanon = [...watched].filter(i => i <= end).length;
  const theEnd = cur === end && curSeen;

  const hero = `<div class="card rw-hero${theEnd ? ' done' : ''}">
      <span class="rw-round">${roundName(rounds)}</span>
      ${sid ? `<span class="rw-shared">${others.length ? `Shared with ${esc(others.join(' & '))}` : 'Shared · waiting for them to join'}</span>` : ''}
      <div class="rw-nav">
        <button class="rw-arrow" id="prev" aria-label="Previous" ${cur <= 0 ? 'disabled' : ''}>‹</button>
        <div class="rw-now">
          ${isList
            ? `<span class="rw-next${(steps[cur].title || '').length > 22 ? ' long' : ''}">${esc(steps[cur].title || name(cur))}</span>`
            : `<button class="rw-next rw-title-btn${(steps[cur].title || '').length > 22 ? ' long' : ''}" id="retitle" aria-label="Edit this episode’s title">${esc(steps[cur].title || name(cur))}</button>`}
          <span class="muted small">${esc(isList ? steps[cur].short : steps[cur].label)}</span>
        </div>
        <button class="rw-arrow" id="next" aria-label="Next" ${cur >= steps.length - 1 ? 'disabled' : ''}>›</button>
      </div>
      ${theEnd ? `<div class="the-end"><span class="the-end-word">${esc(info.theEnd)}</span>${cutoff != null ? '<span class="the-end-at">Your story ends here.</span>' : ''}</div>` : ''}
      ${cutoff != null && cur > cutoff ? `<span class="muted small">${esc(info.notCanon || 'Not canon')}</span>` : ''}
      <div class="rw-actions">
        <button class="btn watch-btn${curSeen ? ' on' : ''}" id="watched" aria-pressed="${curSeen}">${curSeen ? 'Watched ✓' : 'Watched it'}</button>
        <button class="note-btn${noteAt(cur) ? ' has-note' : ''}" id="note-cur" aria-label="Notes on ${esc(name(cur))}" title="Notes on ${esc(name(cur))}">${NOTE_ICON}</button>
      </div>
      <div class="rw-bar"><span style="width:${Math.round((seenInCanon / (end + 1)) * 100)}%"></span></div>
      <span class="muted small">${seenInCanon} of ${end + 1} watched</span>
      ${theEnd ? `<button class="btn primary" id="again">Start ${roundName(rounds + 1).replace('R', 'r')}</button>` : ''}
      ${watched.size ? '<button class="btn small ghost" id="reset">Reset tracker</button>' : ''}
    </div>`;

  // The grid: one row of numbered squares per season (or a checklist of titles).
  const cell = i => {
    const cls = [watched.has(i) ? 'seen' : '', i === cur ? 'current' : '', cutoff != null && i > cutoff ? 'beyond' : '', anyNote(i) ? 'has-note' : ''].join(' ');
    const mark = cutoff === i ? '<span class="cut-mark" aria-hidden="true"></span>' : '';
    return isList
      ? `<button class="rw-item ${cls}" data-i="${i}" aria-pressed="${watched.has(i)}"><span class="rw-check" aria-hidden="true"></span><span>${esc(steps[i].label)}${world.track.labels ? ` <span class="muted small">· ${esc(steps[i].short)}</span>` : /\((\d{4})\)$/.test(world.track.items[i]) ? ` <span class="muted small">· ${world.track.items[i].slice(-5, -1)}</span>` : ''}</span>${cutoff === i ? `<span class="cut-note">${esc(info.theEnd)}</span>` : ''}</button>`
      : `<button class="rw-ep ${cls}" data-i="${i}" aria-label="${esc(steps[i].label)}${steps[i].title ? `: ${esc(steps[i].title)}` : ''}" title="${esc(steps[i].title || '')}" aria-pressed="${watched.has(i)}">${steps[i].e}</button>${mark}`;
  };
  let grid;
  if (isList && world.track.sections) {
    // Each section folds closed with its arrow; remembered on this phone.
    const shut = foldedSections(world.id);
    const groups = [];
    steps.forEach((s, i) => { (groups[s.group] = groups[s.group] || []).push(i); });
    grid = groups.map((idx, g) => `<details class="rw-section" data-g="${g}" ${shut.includes(g) ? '' : 'open'}><summary class="rw-season-name">${esc(Themes.groupName(world.track, g))}<span class="fold-caret" aria-hidden="true"></span></summary><div class="rw-list">${idx.map(cell).join('')}</div></details>`).join('');
  } else if (isList) {
    grid = `<div class="rw-list">${steps.map((_, i) => cell(i)).join('')}</div>`;
  } else {
    const groups = [];
    steps.forEach((s, i) => { (groups[s.group] = groups[s.group] || []).push(i); });
    const row = (idx, g) => `<div class="rw-season"><span class="rw-season-name">${esc(Themes.groupName(world.track, g))}</span><div class="rw-eps">${idx.map(cell).join('')}</div></div>`;
    const inCanon = groups.map((idx, g) => [idx, g]).filter(([idx]) => cutoff == null || idx[0] <= cutoff);
    const outside = groups.map((idx, g) => [idx, g]).filter(([idx]) => cutoff != null && idx[0] > cutoff);
    const openOutside = cutoff != null && steps[cur].group > steps[cutoff].group;
    grid = inCanon.map(([idx, g]) => row(idx, g)).join('')
      + (outside.length ? `<details class="not-canon" ${openOutside ? 'open' : ''}><summary>${esc(info.notCanon || 'Not canon')} <span class="muted small">(${esc(Themes.groupName(world.track, outside[0][1]))}–${outside[outside.length - 1][1] + 1})</span></summary>${outside.map(([idx, g]) => row(idx, g)).join('')}</details>` : '');
  }

  // All notes, in watch order. Shared: everyone's, side by side, with names.
  const stepTitle = i => `${esc(name(i))}${!isList && steps[i].title ? ` · ${esc(steps[i].title)}` : ''}`;
  const sharedNotesHtml = () => {
    const rows = steps.map((s, i) => [i, allShared.filter(n => n.step === s.key).sort((a, b) => (a.by === DB.myUid() ? -1 : b.by === DB.myUid() ? 1 : a.t - b.t))]).filter(([, l]) => l.length);
    return `${rows.length
      ? `<div class="ep-notes">${rows.map(([i, list]) => `<div class="ep-note card shared-note"><span class="ep-note-at">${stepTitle(i)}</span>
          ${list.map(n => `<button class="note-by${n.by === DB.myUid() ? ' mine' : ''}" ${n.by === DB.myUid() ? `data-note="${i}"` : 'disabled'}><span class="note-who">${esc(n.by === DB.myUid() ? 'Me' : (n.byName || 'Someone'))}</span><span class="ep-note-text">${esc(n.text)}</span></button>`).join('')}</div>`).join('')}</div>`
      : '<p class="muted small">No notes yet. Tap the notebook next to “Watched it” to write about an episode. Everyone’s notes show here side by side.</p>'}`;
  };
  const noted = steps.map((s, i) => [i, noteAt(i)]).filter(([, n]) => n);
  const notesInner = allShared ? sharedNotesHtml() : `${noted.length
    ? `<div class="ep-notes">${noted.map(([i, n]) => `<button class="ep-note card" data-note="${i}"><span class="ep-note-at">${esc(name(i))}${!isList && steps[i].title ? ` · ${esc(steps[i].title)}` : ''}</span><span class="ep-note-text">${esc(n.text)}</span></button>`).join('')}</div>`
    : '<p class="muted small">No notes yet. Tap the notebook next to “Watched it” to write about an episode.</p>'}`;

  const canPick = world.track.shuffle && steps.some((_, i) => !watched.has(i));
  // "The list" / "Episodes" and the notes fold closed with their arrows (remembered on this phone).
  const shutBlocks = foldedSections(`${world.id}:blocks`);
  const block = (key, head, inner) => `<details class="rw-block" data-block="${key}" ${shutBlocks.includes(key) ? '' : 'open'}><summary class="block-head">${head}</summary>${inner}</details>`;
  const notesHtml = block('notes', `<h2 class="sec-h">${allShared ? 'Our notes' : 'My notes'}<span class="fold-caret" aria-hidden="true"></span></h2>`, notesInner);
  body.innerHTML = `${hero}<details class="rw-block" data-block="list" ${shutBlocks.includes('list') ? '' : 'open'}><summary class="block-head list-head"><h2 class="sec-h">${isList ? 'The list' : 'Episodes'}<span class="fold-caret" aria-hidden="true"></span></h2>${canPick ? `<button class="btn small pick-btn" id="pick"><svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" aria-hidden=\"true\"><path d=\"M12 2l2.2 6.3L20.5 10.5l-6.3 2.2L12 19l-2.2-6.3L3.5 10.5l6.3-2.2z\" fill=\"currentColor\"/></svg><span>Pick one for me</span></button>` : ''}</summary>
    <p class="muted small">Tap one to mark it watched (or not). Skipping is fine.</p>${grid}</details>${notesHtml}`;

  const go = i => { state.filters[curKey] = i; drawRewatch(world, body); };
  const save = (set, msg) => DB.updateWorld(world, { watched: [...set].sort((a, b) => a - b) })
    .then(() => msg && toast(msg), e => toast(friendlyError(e), true));
  const toggle = i => {
    const set = new Set(watched);
    if (set.has(i)) set.delete(i); else set.add(i);
    return set;
  };

  // Tap the episode's name to give it a title (or clear it to go back to Season/Episode).
  const rt = $('#retitle');
  if (rt) {
    rt.onclick = () => formModal({
      title: steps[cur].label,
      values: { title: (world.track.titles && world.track.titles[cur]) || steps[cur].title || '' },
      fields: [{ key: 'title', label: 'Episode title', placeholder: steps[cur].label }],
      onSave: async v => {
        const total = steps.length;
        const titles = Array.from({ length: total }, (_, i) => (world.track.titles && world.track.titles[i]) || '');
        titles[cur] = v.title;
        const track = { ...world.track };
        if (titles.some(Boolean)) track.titles = titles; else delete track.titles;
        if (sid) await DB.updateShared(sid, { track }); else await DB.updateWorld(world, { track });
      },
    });
  }
  $('#prev').onclick = () => go(cur - 1);
  $('#next').onclick = () => go(cur + 1);
  // Shared: one mark at a time, so two people tapping at once don't undo each other.
  const setOne = i => (sid
    ? DB.toggleSharedWatched(sid, i, !watched.has(i)).catch(e => toast(friendlyError(e), true))
    : save(toggle(i)));
  $('#watched').onclick = () => setOne(cur);
  $('#note-cur').onclick = () => epNoteForm(world, steps[cur], noteAt(cur));
  $$('[data-note]', body).forEach(el => {
    el.onclick = () => { const i = Number(el.dataset.note); epNoteForm(world, steps[i], noteAt(i)); };
  });
  $$('[data-i]', body).forEach(el => {
    el.onclick = () => {
      const i = Number(el.dataset.i);
      state.filters[curKey] = i;
      setOne(i);
    };
  });
  // Movie night: a random one not watched yet this time around.
  $$('.rw-section', body).forEach(d => {
    d.addEventListener('toggle', () => foldSection(world.id, Number(d.dataset.g), !d.open));
  });
  $$('.rw-block', body).forEach(d => {
    d.addEventListener('toggle', () => foldSection(`${world.id}:blocks`, d.dataset.block, !d.open));
  });
  const pick = $('#pick');
  if (pick) {
    pick.onclick = e => {
      e.preventDefault(); e.stopPropagation(); // don't fold the list
      const left = steps.map((_, i) => i).filter(i => !watched.has(i) && i !== cur);
      const pool = left.length ? left : steps.map((_, i) => i).filter(i => !watched.has(i));
      const i = pool[Math.floor(Math.random() * pool.length)];
      toast(`Tonight: ${steps[i].title || steps[i].label}`);
      go(i);
    };
  }
  const reset = $('#reset');
  if (reset) {
    reset.onclick = () => confirmBox('Reset the tracker?', 'This clears every watched mark. Your notes stay.', 'Reset', async () => {
      if (sid) await DB.updateShared(sid, { watched: [] }); else await DB.updateWorld(world, { watched: [] });
      state.filters[curKey] = null;
      toast('Tracker reset. Notes kept.');
    });
  }
  const again = $('#again');
  if (again) {
    again.onclick = () => (sid ? DB.updateShared(sid, { watched: [], rounds: rounds + 1 }) : DB.updateWorld(world, { watched: [], rounds: rounds + 1 }))
      .then(() => { state.filters[curKey] = null; toast(`${roundName(rounds + 1)} begins`); refresh(); }, e => toast(friendlyError(e), true));
  }
}

// ---------- Rewatch for a Collection (sections of movies and shows) ----------
// Sections fold; inside them movies are one checkbox and shows fold open to
// seasons of episodes. The same title in two sections shares one mark (its
// first place, step.same). The top card follows the section you pick in
// "Watching", and so do the arrows and "Pick one for me".
function remember(key, value) {
  try {
    const all = JSON.parse(localStorage.getItem('fw-coll') || '{}');
    if (value === undefined) return all[key];
    all[key] = value;
    localStorage.setItem('fw-coll', JSON.stringify(all));
  } catch {}
  return undefined;
}

function drawCollection(world, body) {
  const sid = world.sharedId && sectionShared(world, 'rewatch') ? world.sharedId : null;
  const sh = sid ? state.shared[sid] : null;
  const steps = Themes.steps(world.track, world.theme);
  const watched = watchedOf(world);
  const seen = i => watched.has(steps[i].same);
  const rounds = world.rounds || 0;
  const roundName = n => (world.firstWatch ? (n === 0 ? 'First watch' : `Rewatch #${n}`) : `Rewatch #${n + 1}`);
  const groupCount = (world.track.sections || [{}]).length;

  // Notes (shared: everyone's, side by side).
  const allShared = sh ? sh.notes : null;
  const notes = new Map((allShared ? allShared.filter(n => n.by === DB.myUid()) : itemsFor(world, 'epnote')).map(n => [n.step, n]));
  const noteAt = i => notes.get(steps[i].key);
  const anyNote = i => (allShared ? allShared.some(n => n.step === steps[i].key) : !!noteAt(i));
  const others = sh ? Object.entries(sh.doc.names || {}).filter(([u]) => u !== DB.myUid() && (sh.doc.members || []).includes(u)).map(([, n]) => n) : [];

  // Which section the top card follows.
  const secKey = `${world.id}:sec`;
  let sec = state.filters[secKey] ?? remember(secKey);
  if (sec == null || sec >= groupCount) {
    const firstOpen = steps.findIndex((_, i) => !seen(i));
    sec = firstOpen >= 0 ? steps[firstOpen].group : 0;
  }
  state.filters[secKey] = sec;
  const inSec = steps.map((s, i) => i).filter(i => steps[i].group === sec);
  const curKey = `${world.id}:cur`;
  if (state.filters[curKey] == null || !inSec.includes(state.filters[curKey])) {
    state.filters[curKey] = inSec.find(i => !seen(i)) ?? inSec[inSec.length - 1] ?? 0;
  }
  const cur = state.filters[curKey];
  const pos = inSec.indexOf(cur);
  const st = steps[cur] || {};
  const curSeen = seen(cur);
  const seenInSec = inSec.filter(seen).length;
  const allDone = steps.length && steps.every((_, i) => seen(i));
  const bigTitle = st.movie ? st.title : (st.title || st.short);
  const small = st.movie ? [Themes.groupName(world.track, st.group), st.year].filter(Boolean).join(' · ') : `${st.show} · Season ${st.season + 1}, Episode ${st.e}`;

  const hero = `<div class="card rw-hero">
      <span class="rw-round">${roundName(rounds)}</span>
      ${sid ? `<span class="rw-shared">${others.length ? `Shared with ${esc(others.join(' & '))}` : 'Shared · waiting for them to join'}</span>` : ''}
      ${groupCount > 1 ? `<label class="coll-pick"><span>Watching</span><select id="secpick">${(world.track.sections || []).map((s, g) => `<option value="${g}" ${g === sec ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>` : ''}
      <div class="rw-nav">
        <button class="rw-arrow" id="prev" aria-label="Previous" ${pos <= 0 ? 'disabled' : ''}>‹</button>
        <div class="rw-now">
          ${st.movie
            ? `<span class="rw-next${(bigTitle || '').length > 22 ? ' long' : ''}">${esc(bigTitle)}</span>`
            : `<button class="rw-next rw-title-btn${(bigTitle || '').length > 22 ? ' long' : ''}" id="retitle" aria-label="Edit this episode’s title">${esc(bigTitle)}</button>`}
          <span class="muted small">${esc(small)}</span>
        </div>
        <button class="rw-arrow" id="next" aria-label="Next" ${pos >= inSec.length - 1 ? 'disabled' : ''}>›</button>
      </div>
      <div class="rw-actions">
        <button class="btn watch-btn${curSeen ? ' on' : ''}" id="watched" aria-pressed="${curSeen}">${curSeen ? 'Watched ✓' : 'Watched it'}</button>
        <button class="note-btn${noteAt(cur) ? ' has-note' : ''}" id="note-cur" aria-label="Notes" title="Notes">${NOTE_ICON}</button>
      </div>
      <div class="rw-bar"><span style="width:${Math.round((seenInSec / Math.max(1, inSec.length)) * 100)}%"></span></div>
      <span class="muted small">${seenInSec} of ${inSec.length} watched${groupCount > 1 ? ` in ${esc(Themes.groupName(world.track, sec))}` : ''}</span>
      ${inSec.some(i => !seen(i) && i !== cur) ? '<button class="btn small pick-btn" id="pick"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 2l2.2 6.3L20.5 10.5l-6.3 2.2L12 19l-2.2-6.3L3.5 10.5l6.3-2.2z" fill="currentColor"/></svg><span>Pick one for me</span></button>' : ''}
      ${allDone ? `<button class="btn primary" id="again">Start ${roundName(rounds + 1).replace('R', 'r')}</button>` : ''}
      ${watched.size ? '<button class="btn small ghost" id="reset">Reset tracker</button>' : ''}
    </div>`;

  // Sections > movies and shows > seasons > episodes.
  const shutSecs = foldedSections(world.id);
  const openShows = foldedSections(`${world.id}:shows`); // shows start folded; this lists the open ones
  const entries = [];
  steps.forEach((s, i) => {
    const last = entries[entries.length - 1];
    if (last && last.entry === s.entry) last.idx.push(i);
    else entries.push({ entry: s.entry, group: s.group, idx: [i] });
  });
  const cls = i => [seen(i) ? 'seen' : '', i === cur ? 'current' : '', anyNote(i) ? 'has-note' : ''].join(' ');
  const entryHtml = en => {
    const first = steps[en.idx[0]];
    if (first.movie) {
      const i = en.idx[0];
      return `<button class="rw-item ${cls(i)}" data-i="${i}" aria-pressed="${seen(i)}"><span class="rw-check" aria-hidden="true"></span><span>${esc(first.title)}${first.year ? ` <span class="muted small">· ${first.year}</span>` : ''}</span></button>`;
    }
    const done = en.idx.filter(seen).length;
    const seasons = [];
    en.idx.forEach(i => { (seasons[steps[i].season] = seasons[steps[i].season] || []).push(i); });
    return `<details class="coll-show" data-show="${en.entry}" ${openShows.includes(en.entry) ? 'open' : ''}>
      <summary class="rw-item${done === en.idx.length ? ' seen' : ''}"><span class="rw-check" aria-hidden="true"></span><span>${esc(first.show)} <span class="muted small">· ${done}/${en.idx.length}</span></span><span class="fold-caret" aria-hidden="true"></span></summary>
      <div class="coll-seasons">${seasons.map((idx, s) => `<div class="rw-season"><span class="rw-season-name">Season ${s + 1}</span><div class="rw-eps">${idx.map(i =>
        `<button class="rw-ep ${cls(i)}" data-i="${i}" aria-label="${esc(steps[i].label)}${steps[i].title ? `: ${esc(steps[i].title)}` : ''}" aria-pressed="${seen(i)}">${steps[i].e}</button>`).join('')}</div></div>`).join('')}</div>
    </details>`;
  };
  const grid = (world.track.sections || [{ name: '' }]).map((s, g) => {
    const list = entries.filter(en => en.group === g).map(entryHtml).join('');
    return world.track.sections
      ? `<details class="rw-section" data-g="${g}" ${shutSecs.includes(g) ? '' : 'open'}><summary class="rw-season-name">${esc(s.name)}<span class="fold-caret" aria-hidden="true"></span></summary><div class="rw-list">${list}</div></details>`
      : `<div class="rw-list">${list}</div>`;
  }).join('');

  // Notes list.
  const stepTitle = i => (steps[i].movie ? esc(steps[i].title) : `${esc(steps[i].show)} · ${esc(steps[i].short)}${steps[i].title ? ` · ${esc(steps[i].title)}` : ''}`);
  const firstOf = key => steps.findIndex(s => s.key === key);
  let notesInner;
  if (allShared) {
    const keys = [...new Set(allShared.map(n => n.step))].map(k => [firstOf(k), k]).filter(([i]) => i >= 0).sort((a, b) => a[0] - b[0]);
    notesInner = keys.length
      ? `<div class="ep-notes">${keys.map(([i, k]) => `<div class="ep-note card shared-note"><span class="ep-note-at">${stepTitle(i)}</span>
          ${allShared.filter(n => n.step === k).map(n => `<button class="note-by${n.by === DB.myUid() ? ' mine' : ''}" ${n.by === DB.myUid() ? `data-note="${i}"` : 'disabled'}><span class="note-who">${esc(n.by === DB.myUid() ? 'Me' : (n.byName || 'Someone'))}</span><span class="ep-note-text">${esc(n.text)}</span></button>`).join('')}</div>`).join('')}</div>`
      : '<p class="muted small">No notes yet. Tap the notebook next to “Watched it” to write about something. Everyone’s notes show here side by side.</p>';
  } else {
    const noted = [...notes.values()].map(n => [firstOf(n.step), n]).filter(([i]) => i >= 0).sort((a, b) => a[0] - b[0]);
    notesInner = noted.length
      ? `<div class="ep-notes">${noted.map(([i, n]) => `<button class="ep-note card" data-note="${i}"><span class="ep-note-at">${stepTitle(i)}</span><span class="ep-note-text">${esc(n.text)}</span></button>`).join('')}</div>`
      : '<p class="muted small">No notes yet. Tap the notebook next to “Watched it” to write about something.</p>';
  }
  const shutBlocks = foldedSections(`${world.id}:blocks`);
  const block = (key, head, inner) => `<details class="rw-block" data-block="${key}" ${shutBlocks.includes(key) ? '' : 'open'}><summary class="block-head${key === 'list' ? ' list-head' : ''}">${head}</summary>${inner}</details>`;
  body.innerHTML = hero
    + block('list', '<h2 class="sec-h">The list<span class="fold-caret" aria-hidden="true"></span></h2>', `<p class="muted small">Tap a movie or episode to mark it watched (or not).</p>${grid}`)
    + block('notes', `<h2 class="sec-h">${allShared ? 'Our notes' : 'My notes'}<span class="fold-caret" aria-hidden="true"></span></h2>`, notesInner);

  // ----- actions -----
  const go = i => { state.filters[curKey] = i; drawCollection(world, body); };
  const setOne = i => {
    const at = steps[i].same, on = !watched.has(at);
    if (sid) return DB.toggleSharedWatched(sid, at, on).catch(e => toast(friendlyError(e), true));
    const set = new Set(watched);
    if (on) set.add(at); else set.delete(at);
    return DB.updateWorld(world, { watched: [...set].sort((a, b) => a - b) }).catch(e => toast(friendlyError(e), true));
  };
  const sp = $('#secpick');
  if (sp) {
    sp.onchange = () => {
      state.filters[secKey] = Number(sp.value);
      remember(secKey, Number(sp.value));
      state.filters[curKey] = null;
      drawCollection(world, body);
    };
  }
  $('#prev').onclick = () => go(inSec[pos - 1]);
  $('#next').onclick = () => go(inSec[pos + 1]);
  $('#watched').onclick = () => setOne(cur);
  $('#note-cur').onclick = () => epNoteForm(world, st, noteAt(cur));
  const rt = $('#retitle');
  if (rt) {
    rt.onclick = () => formModal({
      title: st.label,
      values: { title: st.title || '' },
      fields: [{ key: 'title', label: 'Episode title', placeholder: st.label }],
      onSave: async v => {
        const titles = Array.from({ length: steps.length }, (_, i) => (world.track.titles && world.track.titles[i]) || '');
        titles[st.same] = v.title;
        const track = { ...world.track };
        if (titles.some(Boolean)) track.titles = titles; else delete track.titles;
        if (sid) await DB.updateShared(sid, { track }); else await DB.updateWorld(world, { track });
      },
    });
  }
  $$('[data-i]', body).forEach(el => {
    el.onclick = () => {
      const i = Number(el.dataset.i);
      // Tapping something in another section makes that section the one you're watching.
      if (steps[i].group !== sec) { state.filters[secKey] = steps[i].group; remember(secKey, steps[i].group); }
      state.filters[curKey] = i;
      setOne(i);
    };
  });
  $$('[data-note]', body).forEach(el => { el.onclick = () => { const i = Number(el.dataset.note); epNoteForm(world, steps[i], noteAt(i)); }; });
  $$('.rw-section', body).forEach(d => d.addEventListener('toggle', () => foldSection(world.id, Number(d.dataset.g), !d.open)));
  $$('.coll-show', body).forEach(d => d.addEventListener('toggle', () => foldSection(`${world.id}:shows`, Number(d.dataset.show), d.open)));
  $$('.rw-block', body).forEach(d => d.addEventListener('toggle', () => foldSection(`${world.id}:blocks`, d.dataset.block, !d.open)));
  const pick = $('#pick');
  if (pick) {
    pick.onclick = () => {
      const pool = inSec.filter(i => !seen(i) && i !== cur);
      // A show counts once: land on its next unwatched episode.
      const byEntry = [...new Set(pool.map(i => steps[i].entry))];
      const entry = byEntry[Math.floor(Math.random() * byEntry.length)];
      const i = pool.find(j => steps[j].entry === entry);
      toast(`Tonight: ${steps[i].movie ? steps[i].title : `${steps[i].show}, ${steps[i].short}`}`);
      go(i);
    };
  }
  const reset = $('#reset');
  if (reset) {
    reset.onclick = () => confirmBox('Reset the tracker?', 'This clears every watched mark. Your notes stay.', 'Reset', async () => {
      if (sid) await DB.updateShared(sid, { watched: [] }); else await DB.updateWorld(world, { watched: [] });
      state.filters[curKey] = null;
      toast('Tracker reset. Notes kept.');
    });
  }
  const again = $('#again');
  if (again) {
    again.onclick = () => (sid ? DB.updateShared(sid, { watched: [], rounds: rounds + 1 }) : DB.updateWorld(world, { watched: [], rounds: rounds + 1 }))
      .then(() => { state.filters[curKey] = null; toast(`${roundName(rounds + 1)} begins`); refresh(); }, e => toast(friendlyError(e), true));
  }
}
