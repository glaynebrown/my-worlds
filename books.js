/* Books: the other side of My Worlds (the Worlds | Books switch at the top).

   - The bookcase (#/books): your shelves, each a row of spines. A spine's
     thickness comes from the book's page count; its title wears the book's
     font and color. Currently reading books have a bookmark ribbon. Hold a
     book to drag it (to another spot, or onto another shelf). Each shelf has
     its own sort; books in a series always stand together, in order.
   - Tapping a book pulls it off the shelf: the cover grows big, swings open,
     a page turns, and you're inside (#/b/ID) with its tabs:
     About · Notes · Quotes · Reviews · Board · Map (optional) · Canon (optional).
   - Reviews: "Copy for review" puts a ready-made prompt plus your notes on the
     clipboard for Claude; "Paste Claude's reply" fills both reviews back in.
   - Stats (#/books/stats): the yearly goal, pages, formats, months.
   - Buddy reads: a book shared like a shared world (together.js), with
     shared/{sid}.type = 'book'. Stars, dates and reviews stay personal.

   Data: users/{uid}/books (store.js); a book's notes, quotes, photos and map
   pins are ordinary items with world = the book's id. Shelves and goals live
   in settings (users/{uid}): shelves [{ id, name, sort }], goals { 2026: 30 }. */

const DEFAULT_SHELVES = [
  { id: 'reading', name: 'Currently reading', sort: 'started' },
  { id: 'read', name: 'Read', sort: 'finished' },
  { id: 'want', name: 'Want to read', sort: 'drag' },
  { id: 'dnf', name: 'DNF', sort: 'added', off: true }, // hidden until turned on in Edit shelves
];
const SORTS = [
  ['drag', 'My order'], ['title', 'Title A–Z'], ['author', 'Author A–Z'],
  ['finished', 'Date finished'], ['started', 'Date started'], ['added', 'Date added'], ['rating', 'Rating'],
];
const SORT_SHORT = { drag: 'My order', title: 'Title', author: 'Author', finished: 'Finished', started: 'Started', added: 'Added', rating: 'Rating' };
const BOOK_TABS = [['about', 'About'], ['notes', 'Notes'], ['quotes', 'Quotes'], ['reviews', 'Reviews'], ['board', 'Board'], ['map', 'Map'], ['canon', 'Canon'], ['fics', 'Fics']];
const BOOK_SHARE = [['notes', 'Notes'], ['quotes', 'Quotes'], ['board', 'Board'], ['map', 'Map'], ['canon', 'My Canon'], ['fics', 'Fics']];
// Which tabs a book shows: Reviews unless turned off; Map, Canon and Fics only when turned on.
const bookTabs = b => BOOK_TABS.filter(([k]) => (k !== 'reviews' || b.reviewsOn !== false) && (k !== 'map' || b.mapOn)
  && (k !== 'canon' || b.canonOn) && (k !== 'fics' || b.ficsOn === true));
const SPINE_COLORS = [['#5b1f1f', 'Oxblood'], ['#1f3a5b', 'Navy'], ['#24452f', 'Forest'], ['#4a3222', 'Leather'], ['#c9a35a', 'Gold'], ['#ece2cb', 'Cream'], ['#1c1814', 'Black']];

const GEAR = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"/></svg>';
// An open book, for the Books side's crest (the Worlds side has the doorway).
const BOOK_CREST = `<svg viewBox="0 0 64 64" width="56" height="56"><path d="M32 18c-6-4-14-5-22-4v34c8-1 16 0 22 4 6-4 14-5 22-4V14c-8-1-16 0-22 4z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M32 18v34" stroke="currentColor" stroke-width="2"/><path d="M15 22c5-.4 9 .2 12 1.6M15 28c5-.4 9 .2 12 1.6M15 34c5-.4 9 .2 12 1.6M37 23.6c3-1.4 7-2 12-1.6M37 29.6c3-1.4 7-2 12-1.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".6"/><path d="M42 14v14l3-2.4 3 2.4V14" fill="currentColor" opacity=".9"/><path d="M32 6l1.2 2.8 3 .3-2.3 1.9.7 2.9L32 12.4 29.4 14l.7-2.9-2.3-1.9 3-.3z" fill="currentColor"/></svg>`;

// ---------- little helpers ----------
const bookById = id => state.books.find(b => b.id === id);
// Every shelf (Edit shelves), and the ones turned on (everywhere else).
const allShelves = () => (state.settings && state.settings.shelves) || DEFAULT_SHELVES;
const shelvesOf = () => { const on = allShelves().filter(s => !s.off); return on.length ? on : allShelves().slice(0, 1); };
const shelfOf = b => (shelvesOf().some(s => s.id === b.shelf) ? b.shelf : shelvesOf()[0].id);
const hasShelf = id => shelvesOf().some(s => s.id === id);
const pad2 = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
function fmtDate(iso, withYear) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });
}
const readsOf = b => (Array.isArray(b.reads) && b.reads.length ? b.reads : [{ start: '', end: '', physical: true, audio: false }]);
const curReadIdx = b => readsOf(b).length - 1;
const audioOnly = r => !!(r && r.audio && !r.physical);
const lastEnd = b => readsOf(b).map(r => r.end).filter(Boolean).sort().pop() || '';
const lastStart = b => readsOf(b).map(r => r.start).filter(Boolean).sort().pop() || '';
const coverOf = b => (b.cover && b.cover.url) || b.coverUrl || null;
const coverSmall = b => (b.cover && b.cover.thumbUrl) || b.coverThumb || b.coverUrl || null;
const lookOf = b => ({ ...Themes.BOOK_PRESETS[0], ...(b.look || {}) });
const seriesKey = b => (b.series || '').trim().toLowerCase();
const titleKey = t => (t || '').toLowerCase().replace(/^(the|a|an)\s+/, '');
const authorKey = a => { const p = (a || '').split(',')[0].trim().split(/\s+/); return `${p.pop() || ''} ${p.join(' ')}`.toLowerCase(); };
const hashOf = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const readName = (i, n) => (n < 2 ? 'My read' : i === 0 ? 'First read' : `Re-read #${i}`);
const formatName = r => (r.physical && r.audio ? 'physical book + audiobook' : r.audio ? 'audiobook' : 'physical book');
const inReading = b => shelfOf(b) === 'reading';

// A cover picture (or one drawn in the book's look when there's none).
function coverHtml(b, cls = '', big) {
  const src = big ? coverOf(b) : coverSmall(b);
  const fallback = big ? coverSmall(b) : null;
  if (src) return `<img class="cover-img ${cls}" src="${esc(src)}" ${fallback && fallback !== src ? `onerror="this.onerror=null;this.src='${esc(fallback)}'"` : ''} alt="Cover of ${esc(b.title)}" loading="lazy">`;
  return `<span class="gen-cover ${cls}" data-cover-for="${esc(b.id)}"><span class="gc-title">${esc(b.title)}</span>${b.author ? `<span class="gc-author">${esc(b.author)}</span>` : ''}</span>`;
}
// Drawn covers wear their book's look.
function paintCovers(root = document) {
  $$('[data-cover-for]', root).forEach(el => { const b = bookById(el.dataset.coverFor); if (b) Themes.apply(el, b); });
}

// ---------- spines ----------
function spineStyle(b) {
  const pages = Number(b.pages) || 0;
  const w = pages ? Math.round(Math.min(64, Math.max(16, 12 + pages / 14))) : 28;
  const h = 138 + (hashOf(b.title || b.id) % 6) * 6; // a little uneven, like a real shelf
  let bg, ink;
  if (b.theme === 'custom' || !b.theme) {
    const l = lookOf(b);
    bg = l.bg;
    ink = Themes.isDark(l.bg) ? (Themes.isDark(l.card) ? '#f3e9d2' : l.card) : l.ink;
  } else {
    bg = THEME_COLOR[b.theme] || '#4a3222';
    ink = Themes.isDark(bg) ? '#f1e7d4' : '#2b221a';
  }
  const font = b.spineFont || Themes.headFont(b);
  return { w, h, bg: b.spineBg || bg, ink: b.spineInk || ink, font };
}

const cssColor = c => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#4a3222');
// The title's size: as big as the spine allows, smaller for long titles, and
// on a thick book a long title wraps onto a second line instead.
function spineFit(b, s) {
  const room = s.h - (b.series && b.seriesNo ? 62 : 46);
  const n = Math.max(4, (b.title || '').length);
  const one = Math.min(s.w * 0.44, 18, room / (n * 0.56));
  if (one >= 10.5 || s.w < 30) return { fs: Math.max(8.5, one), lines: 1 };
  return { fs: Math.max(8.5, Math.min(s.w * 0.34, 15, (room * 2) / (n * 0.56))), lines: 2 };
}
// After drawing: shrink any title that still doesn't fit (fonts differ in
// width), and let a thick book's title wrap to two lines if it has to.
function fitSpines(root = document) {
  const fit = el => {
    const slot = el.closest('.slot');
    const min = el.closest('.mini-case') ? 6 : 8.5;
    let fs = parseFloat(getComputedStyle(el).fontSize);
    const over = () => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    while (over() && fs > min) { fs -= 0.5; el.style.fontSize = `${fs}px`; }
    if (min > 6 && over() && slot && !slot.classList.contains('two-line') && slot.offsetWidth >= 30) {
      slot.classList.add('two-line');
      fs = Math.min(parseFloat(getComputedStyle(slot).getPropertyValue('--w')) * 0.34, 15);
      el.style.fontSize = `${fs}px`;
      while (over() && fs > 8.5) { fs -= 0.5; el.style.fontSize = `${fs}px`; }
    }
  };
  const all = () => $$('.slot:not(.add-slot) .spine-title', root).forEach(fit);
  all();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (root === document || root.isConnected) all(); });
}

function spineHtml(b) {
  const s = spineStyle(b);
  Themes.loadFont(s.font);
  const reading = inReading(b);
  const fit = spineFit(b, s);
  return `<div class="slot${fit.lines > 1 ? ' two-line' : ''}" style="--w:${s.w}px;--h:${s.h}px;--fs:${fit.fs.toFixed(1)}px;--sb:${cssColor(s.bg)};--si:${cssColor(s.ink)};--sf:'${esc(s.font.replace(/'/g, ''))}'">
    ${reading ? '<span class="ribbon" aria-hidden="true"></span>' : ''}
    <button class="spine" data-book="${esc(b.id)}" aria-label="${esc(b.title)}${b.author ? ` by ${esc(b.author)}` : ''}">
      ${b.series && b.seriesNo ? `<span class="spine-no">${esc(b.seriesNo)}</span>` : ''}<span class="spine-title">${esc(b.title)}</span></button></div>`;
}

function sortBooks(list, sort) {
  const byTitle = (a, b) => titleKey(a.title).localeCompare(titleKey(b.title));
  const by = {
    drag: (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.t || 0) - (b.t || 0),
    title: byTitle,
    author: (a, b) => authorKey(a.author).localeCompare(authorKey(b.author)) || byTitle(a, b),
    finished: (a, b) => lastEnd(b).localeCompare(lastEnd(a)) || (b.t || 0) - (a.t || 0),
    started: (a, b) => lastStart(b).localeCompare(lastStart(a)) || (b.t || 0) - (a.t || 0),
    added: (a, b) => (b.t || 0) - (a.t || 0),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || byTitle(a, b),
  }[sort] || ((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const sorted = [...list].sort(by);
  // A series stands together, in order, where its first book would be.
  const out = [], placed = new Set();
  sorted.forEach(b => {
    if (placed.has(b.id)) return;
    const key = seriesKey(b);
    const group = key ? sorted.filter(x => seriesKey(x) === key)
      .sort((x, y) => (parseFloat(x.seriesNo) || 999) - (parseFloat(y.seriesNo) || 999) || byTitle(x, y)) : [b];
    group.forEach(x => { out.push(x); placed.add(x.id); });
  });
  return out;
}
const booksOn = shelfId => sortBooks(state.books.filter(b => shelfOf(b) === shelfId), (shelvesOf().find(s => s.id === shelfId) || {}).sort || 'drag');

// Moving a book onto Currently reading / Read fills in today's date if it has none yet.
function shelfMovePatch(b, shelfId) {
  const patch = { shelf: shelfId };
  const reads = readsOf(b).map(r => ({ ...r }));
  const cur = reads[reads.length - 1];
  if (shelfId === 'reading' && !cur.start) { cur.start = today(); patch.reads = reads; }
  if (shelfId === 'read' && !cur.end) { cur.end = today(); patch.reads = reads; }
  return patch;
}

// ---------- the bookcase ----------
let newBookShelf = null;
const goalFor = y => Number(((state.settings || {}).goals || {})[y]) || 0;
function finishesIn(year) {
  const out = [];
  state.books.forEach(b => {
    if (shelfOf(b) === 'dnf') return;
    readsOf(b).forEach((r, i) => { if (r.end && r.end.startsWith(String(year))) out.push({ book: b, read: r, i }); });
  });
  return out.sort((a, b) => a.read.end.localeCompare(b.read.end));
}

function renderBooks() {
  rememberSide('books');
  const nick = (state.settings && state.settings.displayName) || '';
  const year = new Date().getFullYear();
  const goal = goalFor(year), done = finishesIn(year).length;
  const caseHtml = sh => {
    const list = booksOn(sh.id);
    return `<section class="case" data-shelf="${esc(sh.id)}">
      <header class="case-head"><h2 class="case-name">${esc(sh.name)}</h2></header>
      <div class="case-row">${list.map(spineHtml).join('')}
        <div class="slot add-slot" style="--w:30px;--h:110px"><button class="spine add-spine" data-add="${esc(sh.id)}" aria-label="Add a book to ${esc(sh.name)}">+</button></div></div>
    </section>`;
  };
  view.innerHTML = `<div class="library books-home">
    ${nick ? `<p class="lib-me">${esc(nick)}</p>` : ''}${sideToggle('books')}
    <header class="lib-head"><button class="lib-crest crest-link" id="bcrest" aria-label="Menu">${BOOK_CREST}</button>
      <h1 class="lib-title">My Worlds</h1>
      <a class="goal-line" href="#/books/stats">${goal
        ? `<span>${year} · ${done} of ${goal} books</span><span class="goal-bar"><span style="width:${Math.min(100, Math.round((done / goal) * 100))}%"></span></span>`
        : `<span>${done ? `${done} finished in ${year} · ` : ''}Set a ${year} reading goal ›</span>`}</a></header>
    <div class="bookcase" id="case">${shelvesOf().map(caseHtml).join('')}</div>
    ${state.books.length ? '' : `<p class="empty">Your bookcase is empty. Tap a + to put your first book on a shelf.</p>
      ${isOwner() ? '' : '<p class="center"><a class="btn primary" href="#/books/pick">Pick from the library</a></p>'}`}
  </div>`;

  $('#bcrest').onclick = () => openModal(`<div class="crest-menu">
      <button class="btn block" id="m-add">+ Add a book</button>
      <a class="btn block" href="#/books/stats" data-close>Reading goal &amp; stats</a>
      <button class="btn block" id="m-shelves">Edit shelves</button>
      <button class="btn block ghost" id="out">Sign out</button></div>`, (root, close) => {
    $('#m-add', root).onclick = () => { close(); newBookShelf = hasShelf('reading') ? 'reading' : shelvesOf()[0].id; location.hash = '#/books/new'; };
    $('#m-shelves', root).onclick = () => { close(); shelvesForm(); };
    $('#out', root).onclick = () => { close(); confirmBox('Sign out?', 'Your books stay saved in your account.', 'Sign out', () => DB.signOut()); };
  }, 'small-modal');
  fitSpines(view);
  enableSpineDrag($('#case'));
}

function saveShelves(list) {
  state.settings.shelves = list;
  return DB.saveSettings({ shelves: list });
}

function shelvesForm() {
  const before = allShelves();
  let list = before.map(s => ({ ...s }));
  openModal(`<h2>Shelves</h2><div id="slist" class="shelf-edits"></div>
    <button type="button" class="btn small" id="sadd">+ Add a shelf</button>
    <p class="muted small">With My order, hold a book on the shelf to drag it. Books in a series always stand together, in order. A hidden shelf keeps its name and settings for later. Removing a shelf moves its books to the first one showing.</p>
    <div class="actions"><span class="spacer"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="ssave">Save</button></div>`, (root, close) => {
    const draw = () => {
      $('#slist', root).innerHTML = list.map((s, i) => `<div class="shelf-edit">
        <div class="se-top"><input value="${esc(s.name)}" data-i="${i}" aria-label="Shelf name">
        <button type="button" class="btn small ghost" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Move up">↑</button>
        <button type="button" class="btn small ghost" data-down="${i}" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button>
        <button type="button" class="btn small ghost danger-text" data-del="${i}" ${list.length > 1 ? '' : 'disabled'} aria-label="Remove">✕</button></div>
        <label class="switch se-show"><input type="checkbox" data-showi="${i}" ${s.off ? '' : 'checked'}><span class="track"></span><span>Show on my bookcase</span></label>
        <label class="se-sort"><span>Sort by</span><select data-sorti="${i}">${SORTS.map(([k, l]) => `<option value="${k}" ${(s.sort || 'drag') === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>`).join('');
      $$('[data-i]', root).forEach(inp => { inp.oninput = () => { list[+inp.dataset.i].name = inp.value; }; });
      $$('[data-sorti]', root).forEach(sel => { sel.onchange = () => { list[+sel.dataset.sorti].sort = sel.value; }; });
      $$('[data-showi]', root).forEach(c => { c.onchange = () => { list[+c.dataset.showi].off = !c.checked; }; });
      $$('[data-up]', root).forEach(b => { b.onclick = () => { const i = +b.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); }; });
      $$('[data-down]', root).forEach(b => { b.onclick = () => { const i = +b.dataset.down; [list[i + 1], list[i]] = [list[i], list[i + 1]]; draw(); }; });
      $$('[data-del]', root).forEach(b => { b.onclick = () => { list.splice(+b.dataset.del, 1); draw(); }; });
    };
    draw();
    $('#sadd', root).onclick = () => { list.push({ id: `s${Date.now().toString(36)}`, name: '', sort: 'drag' }); draw(); $$('[data-i]', root).pop().focus(); };
    $('#ssave', root).onclick = e => busy(e.target, async () => {
      list = list.map(s => ({ ...s, name: s.name.trim() }));
      if (list.some(s => !s.name)) throw new Error('Give every shelf a name.');
      if (!list.some(s => !s.off)) throw new Error('Keep at least one shelf showing.');
      const hiding = list.find(s => s.off && state.books.some(b => b.shelf === s.id));
      if (hiding) throw new Error(`“${hiding.name}” has books on it. Move them to another shelf before hiding it.`);
      list = list.map(s => ({ ...s, off: !!s.off }));
      const firstOn = list.find(s => !s.off);
      const gone = before.filter(o => !list.some(s => s.id === o.id)).map(s => s.id);
      const moving = state.books.filter(b => gone.includes(shelfOf(b)));
      // A shelf switched to "My order" starts from the order its books stand in now.
      for (const s2 of list) {
        const was = before.find(o => o.id === s2.id);
        if (was && (s2.sort || 'drag') === 'drag' && (was.sort || 'drag') !== 'drag') {
          const now = booksOn(s2.id);
          await Promise.all(now.map((b, k) => (b.order === k ? null : DB.updateBook(b, { order: k }))));
        }
      }
      await saveShelves(list);
      await Promise.all(moving.map(b => DB.updateBook(b, { shelf: firstOn.id })));
      close();
      toast(moving.length ? `Shelves saved. ${moving.length} book${moving.length === 1 ? '' : 's'} moved to ${firstOn.name}.` : 'Shelves saved');
      renderBooks();
    });
  });
}

// ---------- dragging books around the bookcase ----------
// Same feel as the doors on the Worlds side: hold a book (about half a second),
// drag it, let go. Dropping it on another shelf moves it there.
let spineDrag = null;
let spineSorting = false;
function enableSpineDrag(caseEl) {
  if (spineDrag) spineDrag.abort();
  spineDrag = new AbortController();
  const opts = { signal: spineDrag.signal };
  $$('.spine-ghost').forEach(g => g.remove());
  spineSorting = false;

  const HOLD_MS = 450, SLOP = 10;
  let timer = null, start = null, slot = null, ghost = null, offset = null, dragging = false, justDragged = false, from = null;
  const cancelHold = () => { clearTimeout(timer); timer = null; };
  const begin = (sp, x, y) => { slot = sp.parentElement; start = { x, y }; cancelHold(); timer = setTimeout(pickUp, HOLD_MS); };

  function pickUp() {
    timer = null;
    if (!slot || !slot.isConnected) return;
    dragging = spineSorting = true;
    from = slot.closest('.case').dataset.shelf;
    const r = slot.getBoundingClientRect();
    offset = { x: start.x - r.left, y: start.y - r.top };
    ghost = slot.cloneNode(true);
    ghost.classList.add('spine-ghost');
    Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px` });
    document.body.appendChild(ghost);
    slot.classList.add('slot-placeholder');
    caseEl.classList.add('sorting');
    if (navigator.vibrate) navigator.vibrate(8);
  }

  function moveTo(x, y) {
    if (!ghost) return;
    ghost.style.left = `${x - offset.x}px`;
    ghost.style.top = `${y - offset.y}px`;
    const over = document.elementFromPoint(x, y);
    const row = over && over.closest('.case-row');
    if (!row || !caseEl.contains(row)) return;
    const target = over.closest('.slot');
    const addSlot = $('.add-slot', row);
    if (target && target !== slot && target !== addSlot) {
      const r = target.getBoundingClientRect();
      row.insertBefore(slot, x > r.left + r.width / 2 ? target.nextSibling : target);
    } else if (!target || target === addSlot) {
      if (slot.parentElement !== row || slot.nextElementSibling !== addSlot) row.insertBefore(slot, addSlot);
    }
  }

  function drop() {
    if (ghost) ghost.remove();
    ghost = null;
    slot.classList.remove('slot-placeholder');
    caseEl.classList.remove('sorting');
    dragging = spineSorting = false;
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 350);
    const row = slot.parentElement;
    const shelfId = row.closest('.case').dataset.shelf;
    const sh = shelvesOf().find(s => s.id === shelfId);
    const book = bookById($('.spine', slot).dataset.book);
    const patches = {};
    const add = (b, p) => { patches[b.id] = { b, p: { ...(patches[b.id] || {}).p, ...p } }; };
    if (book && shelfOf(book) !== shelfId) add(book, shelfMovePatch(book, shelfId));
    if ((sh.sort || 'drag') === 'drag') {
      $$('.spine[data-book]', row).forEach((el, k) => { const b = bookById(el.dataset.book); if (b && (b.order !== k || patches[b.id])) add(b, { order: k }); });
    } else if (from === shelfId) {
      toast(`“${sh.name}” is sorted by ${SORT_SHORT[sh.sort].toLowerCase()}. To arrange it by hand, pick My order for it in Edit shelves.`);
    }
    const list = Object.values(patches);
    if (list.length) {
      Promise.all(list.map(({ b, p }) => DB.updateBook(b, p)))
        .then(() => { if (book && from !== shelfId) toast(`Moved to ${sh.name}`); }, e => { toast(friendlyError(e), true); refresh(); });
    } else setTimeout(refresh, 0);
    if (missedRefresh) { missedRefresh = false; setTimeout(refresh, 0); }
  }
  const end = () => { cancelHold(); if (dragging) drop(); };

  caseEl.addEventListener('touchstart', e => {
    const sp = e.target.closest('.spine[data-book]');
    if (!sp || e.touches.length > 1) return;
    begin(sp, e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true, ...opts });
  caseEl.addEventListener('touchmove', e => {
    const p = e.touches[0];
    if (dragging) { e.preventDefault(); moveTo(p.clientX, p.clientY); return; }
    if (timer && Math.hypot(p.clientX - start.x, p.clientY - start.y) > SLOP) cancelHold();
  }, { passive: false, ...opts });
  caseEl.addEventListener('touchend', end, opts);
  caseEl.addEventListener('touchcancel', end, opts);
  caseEl.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button > 0) return;
    const sp = e.target.closest('.spine[data-book]');
    if (sp) begin(sp, e.clientX, e.clientY);
  }, opts);
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    if (dragging) { moveTo(e.clientX, e.clientY); return; }
    if (timer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > SLOP) cancelHold();
  }, opts);
  window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') end(); }, opts);

  caseEl.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) { newBookShelf = add.dataset.add; location.hash = '#/books/new'; return; }
    const sp = e.target.closest('.spine[data-book]');
    if (!sp || dragging || justDragged) return;
    openBook(sp, bookById(sp.dataset.book));
  }, opts);
  caseEl.addEventListener('contextmenu', e => { if (e.target.closest('.spine')) e.preventDefault(); }, opts);
}

// ---------- pulling a book off the shelf ----------
// The book grows out of its spine into its cover, the cover swings open onto
// the title page, that page turns to the contents, and you're inside.
const wait = ms => new Promise(r => setTimeout(r, ms));
function openBook(fromEl, b, section = '') {
  if (!b) return;
  const href = `#/b/${b.id}${section ? `/${section}` : ''}`;
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still || !fromEl || !Element.prototype.animate) { location.hash = href; return; }
  const r = fromEl.getBoundingClientRect();
  const W = Math.round(Math.min(window.innerWidth * 0.58, 300)), H = Math.round(W * 1.5);
  const tabs = bookTabs(b).map(([, l]) => l);
  const ov = document.createElement('div');
  ov.className = 'book-open';
  ov.innerHTML = `<div class="bo-stage"><div class="bo-book" style="width:${W}px;height:${H}px">
      <div class="bo-page"><span class="bo-small">Contents</span><ol class="bo-toc">${tabs.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>
      <div class="bo-leaf"><div class="bo-face bo-front bo-title-page"><span class="bo-t">${esc(b.title)}</span>${b.author ? `<span class="bo-a">${esc(b.author)}</span>` : ''}<span class="bo-orn" aria-hidden="true">❦</span></div><div class="bo-face bo-back"></div></div>
      <div class="bo-cover"><div class="bo-face bo-front">${coverHtml(b, 'bo-cover-art', true)}</div><div class="bo-face bo-back bo-endpaper"></div></div>
    </div></div>`;
  document.body.appendChild(ov);
  const stage = $('.bo-stage', ov);
  Themes.apply(stage, b);
  paintCovers(ov);
  const book = $('.bo-book', ov), cover = $('.bo-cover', ov), leaf = $('.bo-leaf', ov);
  // Wait (briefly) for the cover picture, so it doesn't fly out blank.
  const art = $('img.bo-cover-art', ov);
  if (art) art.loading = 'eager';
  const coverReady = art && !art.complete ? Promise.race([new Promise(res => { art.addEventListener('load', res); art.addEventListener('error', res); }), wait(800)]) : Promise.resolve();
  const dx = r.left + r.width / 2 - window.innerWidth / 2, dy = r.top + r.height / 2 - window.innerHeight / 2;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    location.hash = href;
    const fade = ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, fill: 'forwards' });
    fade.onfinish = () => ov.remove();
    setTimeout(() => ov.remove(), 600);
  };
  ov.addEventListener('click', finish);
  setTimeout(finish, 6500); // never stuck

  ov.animate([{ backgroundColor: 'rgba(10,8,6,0)' }, { backgroundColor: 'rgba(10,8,6,.78)' }], { duration: 450, fill: 'forwards' });
  book.style.visibility = 'hidden';
  coverReady.then(() => {
  book.style.visibility = '';
  const grow = book.animate([
    // (No fading here: opacity would flatten the 3D and the turned page would slip under the cover.)
    { transform: `translate(${dx}px, ${dy}px) scale(${r.width / W}, ${r.height / H})` },
    { transform: 'translate(0, 0) scale(1)' },
  ], { duration: 620, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'both' });
  grow.finished
    .then(() => wait(320))
    .then(() => {
      // While the cover opens, the book slides right so the open pages sit in the middle.
      book.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${Math.round(W * 0.42)}px)` }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
      // Closed, the cover sits just above the page (translateZ); open, it settles
      // just below where the turned page will lie, so that page lands on top.
      return cover.animate([{ transform: 'translateZ(2px) rotateY(0deg)' }, { transform: 'translateZ(0px) rotateY(-172deg)' }],
        { duration: 900, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' }).finished;
    })
    .then(() => wait(260))
    .then(() => leaf.animate([{ transform: 'translateZ(1px) rotateY(0deg)' }, { transform: 'translateZ(1px) rotateY(-166deg)' }],
      { duration: 640, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' }).finished)
    .then(() => wait(220))
    .then(finish, finish);
  });
}

// "The books" on a world's page: the books linked to it, as little spines.
function worldBooksHtml(world) {
  const list = sortBooks((state.books || []).filter(b => b.worldId === world.id), 'title');
  if (!list.length) return '';
  return `<div class="w-books"><span class="w-books-h">The books</span><div class="mini-case">${list.map(spineHtml).join('')}</div></div>`;
}
function wireWorldBooks() {
  fitSpines(view);
  $$('.w-books .spine[data-book]').forEach(el => { el.onclick = () => openBook(el, bookById(el.dataset.book)); });
}

// ---------- inside a book ----------
function renderBook(book, section) {
  book = withShared(book);
  const tabs = bookTabs(book);
  if (!tabs.some(([k]) => k === section)) section = 'about';
  view.innerHTML = `<div class="page world book-page">
    <header class="w-head"><a class="back" href="#/books">‹ Books</a>
      <a class="gear" href="#/b/${esc(book.id)}/settings" aria-label="Book settings">${GEAR}</a></header>
    <div class="w-hero"><h1 class="w-title">${esc(book.title)}</h1>
      ${book.author ? `<p class="w-sub b-author">${esc(book.author)}</p>` : ''}
      ${book.sharedId ? `<p class="w-sub">${esc(sharedWithLine(book).replace(/^Shared with/, 'Reading with'))}</p>` : ''}
      <div class="w-flourish" aria-hidden="true"></div></div>
    <nav class="w-tabs many${tabs.length > 7 ? ' lots' : ''}" aria-label="Sections">${tabs.map(([k, label]) =>
      `<a href="#/b/${esc(book.id)}/${k}" ${k === section ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    <section class="w-body" id="wb"></section></div>`;
  const body = $('#wb');
  ({ about: drawAbout, notes: drawNotes, quotes: drawBookQuotes, reviews: drawReviews, board: drawBookBoard, map: drawMap, canon: drawCanon, fics: drawFics })[section](book, body);
  paintCovers(view);
}

// ----- About -----
function starsHtml(rating, id = 'stars') {
  return `<div class="stars" id="${id}" role="group" aria-label="Rating: ${rating || 'none'}">${[1, 2, 3, 4, 5].map(n => {
    const fill = rating >= n ? 100 : rating >= n - 0.5 ? 50 : 0;
    return `<span class="star-wrap"><span class="star" style="--fill:${fill}%"></span>
      <button class="half l" data-v="${n - 0.5}" aria-label="${n - 0.5} stars"></button><button class="half r" data-v="${n}" aria-label="${n} star${n > 1 ? 's' : ''}"></button></span>`;
  }).join('')}${rating ? `<span class="stars-n">${rating}</span>` : ''}</div>`;
}

function progressHtml(book) {
  const r = readsOf(book)[curReadIdx(book)];
  if (r.end || !(inReading(book) || r.start)) return '';
  if (audioOnly(r)) {
    return `<div class="progress-box"><span class="pb-now">${book.chapter ? `On chapter ${esc(book.chapter)}` : 'Listening'}</span>
      <button class="btn small" id="setpos">Update my chapter</button></div>`;
  }
  const p = Number(book.page) || 0, total = Number(book.pages) || 0;
  const pct = total && p ? Math.min(100, Math.round((p / total) * 100)) : 0;
  return `<div class="progress-box"><span class="pb-now">${p ? `Page ${p}${total ? ` of ${total}` : ''}` : 'Just starting'}${pct ? ` <span class="muted small">· ${pct}%</span>` : ''}</span>
    ${total ? `<div class="rw-bar"><span style="width:${pct}%"></span></div>` : ''}
    <button class="btn small" id="setpos">Update my page</button></div>`;
}

function readHtml(r, i, n) {
  return `<div class="card read" data-r="${i}">
    <div class="read-head"><span class="read-n">${readName(i, n)}</span>${i > 0 ? `<button class="linkish danger-text" data-delread="${i}">Remove</button>` : ''}</div>
    <div class="read-dates">
      <label class="mini-field"><span>Started</span><input type="date" data-k="start" value="${esc(r.start || '')}"></label>
      <label class="mini-field"><span>Finished</span><input type="date" data-k="end" value="${esc(r.end || '')}"></label>
    </div>
    <div class="read-format">
      <label class="check"><input type="checkbox" data-k="physical" ${r.physical ? 'checked' : ''}><span>Physical book</span></label>
      <label class="check"><input type="checkbox" data-k="audio" ${r.audio ? 'checked' : ''}><span>Audiobook</span></label>
    </div></div>`;
}

function drawAbout(book, body) {
  const reads = readsOf(book);
  const world = book.worldId && worldById(book.worldId);
  body.innerHTML = `<div class="card about">
      <div class="about-top">
        <button class="about-cover" id="cover" aria-label="See the cover">${coverHtml(book, '', true)}</button>
        <div class="about-info">
          ${book.series ? `<p class="about-series">${esc(book.series)}${book.seriesNo ? ` · Book ${esc(book.seriesNo)}` : ''}</p>` : ''}
          ${starsHtml(book.rating || 0)}
          ${book.pages ? `<p class="muted small">${esc(book.pages)} pages</p>` : ''}
          <label class="mini-field"><span>Shelf</span><select id="shelf">${shelvesOf().map(s => `<option value="${esc(s.id)}" ${shelfOf(book) === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        </div>
      </div>
      ${progressHtml(book)}
      ${world ? `<a class="btn small block world-link" href="#/w/${esc(world.id)}">Open the world · ${esc(plainName(world))}</a>` : ''}
    </div>
    <h2 class="sec-h">Reading dates</h2>
    <div class="reads">${reads.map((r, i) => readHtml(r, i, reads.length)).join('')}</div>
    <button class="btn small" id="reread">+ Start a re-read</button>
    ${book.blurb ? `<h2 class="sec-h">The story</h2><div class="card blurb"><p class="blurb-text" id="blurb">${esc(book.blurb)}</p><button class="linkish" id="more">More</button></div>` : ''}`;

  const save = (patch, msg) => DB.updateBook(book, patch).then(() => msg && toast(msg), e => toast(friendlyError(e), true));

  $$('#stars [data-v]', body).forEach(b => {
    b.onclick = () => { const v = Number(b.dataset.v); save({ rating: v === book.rating ? 0 : v }); };
  });
  $('#shelf', body).onchange = e => {
    const id = e.target.value;
    save(shelfMovePatch(book, id), `Moved to ${shelvesOf().find(s => s.id === id).name}`);
  };
  $('#cover', body).onclick = () => {
    const src = coverOf(book);
    if (!src) { location.hash = `#/b/${book.id}/settings`; return; }
    openModal(`<img class="viewer-img" src="${esc(src)}" alt="Cover"><div class="actions"><span class="spacer"></span><button class="btn" data-close>Close</button></div>`, null, 'viewer');
  };
  const pos = $('#setpos', body);
  if (pos) {
    const audio = audioOnly(reads[reads.length - 1]);
    pos.onclick = () => formModal({
      title: audio ? 'Where am I?' : 'What page am I on?',
      values: audio ? { chapter: book.chapter || '' } : { page: book.page || '' },
      fields: [audio ? { key: 'chapter', label: 'Chapter' } : { key: 'page', label: `Page${book.pages ? ` (of ${book.pages})` : ''}`, type: 'number' }],
      onSave: async v => {
        const { patch, moved } = startedPatch(book, audio ? { chapter: v.chapter } : { page: Number(v.page) || 0 });
        await DB.updateBook(book, patch);
        if (moved) toast('Moved to Currently reading');
      },
    });
  }
  // Dates and format save as soon as they change. Finishing moves it to Read;
  // starting a Want to read moves it to Currently reading.
  $$('.read', body).forEach(card => {
    const i = Number(card.dataset.r);
    $$('[data-k]', card).forEach(inp => {
      inp.onchange = () => {
        const list = reads.map(r => ({ ...r }));
        list[i][inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : inp.value;
        const patch = { reads: list };
        let msg = null;
        const last = i === list.length - 1;
        if (last && inp.dataset.k === 'end' && inp.value && shelfOf(book) === 'reading' && hasShelf('read')) { patch.shelf = 'read'; msg = 'Finished! It’s on your Read shelf.'; }
        if (last && inp.dataset.k === 'start' && inp.value && shelfOf(book) === 'want' && hasShelf('reading')) { patch.shelf = 'reading'; msg = 'Moved to Currently reading'; }
        save(patch, msg);
      };
    });
  });
  $$('[data-delread]', body).forEach(b => {
    b.onclick = () => confirmBox('Remove this re-read?', 'Its dates go away. Notes you wrote during it stay.', 'Remove', () => {
      const list = reads.filter((_, k) => k !== Number(b.dataset.delread));
      return DB.updateBook(book, { reads: list });
    });
  });
  $('#reread', body).onclick = () => {
    const cur = reads[reads.length - 1];
    const patch = { reads: [...reads, { start: today(), end: '', physical: !!cur.physical, audio: !!cur.audio }], page: 0, chapter: '' };
    if (hasShelf('reading')) patch.shelf = 'reading';
    save(patch, 'Re-read started. Enjoy it again!');
  };
  const more = $('#more', body);
  if (more) {
    const text = $('#blurb', body);
    if (text.scrollHeight <= text.clientHeight + 2) more.hidden = true;
    more.onclick = () => { text.classList.toggle('open'); more.textContent = text.classList.contains('open') ? 'Less' : 'More'; };
  }
}

// Starting to read (a first note, or your page) takes a Want to read book to
// Currently reading, with today as its start date if it has none.
function startedPatch(book, patch) {
  if (shelfOf(book) !== 'want' || !hasShelf('reading')) return { patch, moved: false };
  return { patch: { ...patch, ...shelfMovePatch(book, 'reading') }, moved: true };
}

// ----- Notes: thoughts while reading, each with the date and page -----
const notePos = n => (n.page ? Number(n.page) : n.chapter ? parseFloat(n.chapter) || 0 : 0);
function bookNoteForm(book, n) {
  const at = n => [fmtDate(n.date, true), n.page ? `page ${n.page}` : n.chapter ? `chapter ${n.chapter}` : ''].filter(Boolean).join(' · ');
  if (n && !canEdit(n)) return viewOnly(n, `<h2>${esc(n.byName || 'Their')}’s note</h2><p class="muted small">${esc(at(n))}</p><p style="white-space:pre-line;margin-top:10px">${esc(n.text)}</p>`);
  const ri = n ? Math.min(n.read ?? 0, curReadIdx(book)) : curReadIdx(book);
  const audio = n ? (!n.page && !!n.chapter) || audioOnly(readsOf(book)[ri]) : audioOnly(readsOf(book)[ri]);
  formModal({
    title: n ? 'Edit note' : 'Add a note',
    values: n ? { ...n, page: n.page || '' } : { date: today() },
    fields: [
      { key: 'date', label: 'Date', type: 'date' },
      audio ? { key: 'chapter', label: 'Chapter', placeholder: '#' }
        : { key: 'page', label: 'Page', type: 'number', placeholder: book.page ? String(book.page) : '142' },
      { key: 'text', label: 'Thoughts', type: 'textarea', big: true, placeholder: 'What just happened…' },
    ],
    onSave: async v => {
      if (!v.text) throw new Error('Write your thoughts first.');
      const data = { text: v.text, date: v.date || today(), page: audio ? null : (Number(v.page) || null), chapter: audio ? (v.chapter || '') : '' };
      if (n) await updateItemFor(n, data);
      else await addItemFor(book, { world: book.id, kind: 'bnote', read: ri, ...data });
      // Your place in the book follows your newest note.
      if (!n && ri === curReadIdx(book)) {
        const { patch, moved } = startedPatch(book, data.page ? { page: data.page } : data.chapter ? { chapter: data.chapter } : {});
        if (Object.keys(patch).length) await DB.updateBook(book, patch);
        if (moved) toast('Moved to Currently reading');
      }
    },
    onDelete: n && (() => confirmBox('Delete this note?', '', 'Delete', () => deleteItemFor(n))),
  });
}

function drawNotes(book, body) {
  const shared = book.sharedId && sectionShared(book, 'notes');
  const who = n => (n.by && n.by !== DB.myUid() ? (n.byName || 'Someone') : 'Me');
  const all = itemsFor(book, 'bnote').sort((a, b) => (a.read ?? 0) - (b.read ?? 0)
    || (a.date || '').localeCompare(b.date || '') || notePos(a) - notePos(b) || (a.t || 0) - (b.t || 0));
  const { html, pick } = shared ? chips(book, 'noteby', all.map(who)) : { html: '', pick: null };
  const list = pick ? all.filter(n => who(n) === pick) : all;
  const n = readsOf(book).length;
  const card = x => `<button class="bnote card${shared && who(x) !== 'Me' ? ' theirs' : ''}" data-id="${esc(x.id)}">
      <span class="bnote-at">${esc(fmtDate(x.date))}${x.page ? ` · p. ${esc(x.page)}` : x.chapter ? ` · ch. ${esc(x.chapter)}` : ''}${shared ? ` <span class="bnote-who">${esc(who(x))}</span>` : ''}</span>
      <span class="bnote-text">${esc(x.text)}</span></button>`;
  let inner = '';
  if (n > 1) {
    for (let i = 0; i < n; i++) {
      const part = list.filter(x => Math.min(x.read ?? 0, n - 1) === i);
      if (part.length) inner += `<h2 class="sec-h">${esc(readName(i, n))}</h2><div class="bnotes">${part.map(card).join('')}</div>`;
    }
  } else inner = list.length ? `<div class="bnotes">${list.map(card).join('')}</div>` : '';
  body.innerHTML = `${addBtn('addn', 'Add a note')}${html}
    ${inner || `<p class="empty">No notes yet. Jot your thoughts as you read; each one gets the date and your ${audioOnly(readsOf(book)[n - 1]) ? 'chapter' : 'page'}.</p>`}`;
  $('#addn').onclick = () => bookNoteForm(book);
  wireChips(body, () => drawNotes(book, body));
  $$('.bnote', body).forEach(el => { el.onclick = () => bookNoteForm(book, findItem(el.dataset.id)); });
}

// ----- Quotes (page optional) -----
function bookQuoteForm(book, q) {
  if (q && !canEdit(q)) return viewOnly(q, `<h2>Quote</h2><p class="quote-text" style="margin-top:8px">${esc(q.text)}</p>${q.who || q.page ? `<p class="muted small">— ${esc([q.who, q.page ? `p. ${q.page}` : ''].filter(Boolean).join(', '))}</p>` : ''}`);
  formModal({
    title: q ? 'Edit quote' : 'Add a quote',
    values: q ? { ...q, page: q.page || '' } : {},
    fields: [
      { key: 'text', label: 'Quote', type: 'textarea' },
      { key: 'who', label: 'Who said it (optional)' },
      { key: 'page', label: 'Page (optional)', type: 'number' },
    ],
    onSave: async v => {
      if (!v.text) throw new Error('Type the quote first.');
      const data = { text: v.text, who: v.who, page: Number(v.page) || null };
      if (q) await updateItemFor(q, data); else await addItemFor(book, { world: book.id, kind: 'quote', ...data });
    },
    onDelete: q && (() => confirmBox('Delete this quote?', '', 'Delete', () => deleteItemFor(q))),
  });
}

function drawBookQuotes(book, body) {
  const all = itemsFor(book, 'quote').sort((a, b) => (a.page || 1e9) - (b.page || 1e9) || byOldest(a, b));
  const { html, pick } = chips(book, 'who', all.map(q => q.who));
  const list = pick ? all.filter(q => q.who === pick) : all;
  body.innerHTML = `${addBtn('addq', 'Add a quote')}${html}
    ${list.length ? `<div class="quotes">${list.map(q => `<button class="quote card" data-id="${esc(q.id)}">
      <span class="quote-text">${esc(q.text)}</span>
      ${q.who || q.page ? `<span class="quote-by">— ${esc([q.who, q.page ? `p. ${q.page}` : ''].filter(Boolean).join(', '))}</span>` : ''}${byLine(q)}</button>`).join('')}</div>`
      : '<p class="empty">No quotes yet. Save the lines you want to remember.</p>'}`;
  $('#addq').onclick = () => bookQuoteForm(book);
  wireChips(body, () => drawBookQuotes(book, body));
  $$('.quote', body).forEach(el => { el.onclick = () => bookQuoteForm(book, findItem(el.dataset.id)); });
}

// ----- Reviews: two of them, drafted by Claude from your notes -----
function reviewPrompt(book) {
  const notes = itemsFor(book, 'bnote').filter(n => canEdit(n))
    .sort((a, b) => (a.read ?? 0) - (b.read ?? 0) || (a.date || '').localeCompare(b.date || '') || notePos(a) - notePos(b));
  const quotes = itemsFor(book, 'quote').filter(q => canEdit(q)).sort((a, b) => (a.page || 1e9) - (b.page || 1e9));
  const reads = readsOf(book).filter(r => r.start || r.end);
  const lines = [
    `Help me write two reviews of "${book.title}"${book.author ? ` by ${book.author}` : ''}, using my reading notes below.`,
    'Write them in my voice: first person, casual and honest, like I’m telling a friend about it. Keep my opinions and feelings; don’t invent new ones or add plot details I didn’t mention.',
    '',
    '1. A full review. Spoilers are fine.',
    '2. A spoiler-free review: no twists, deaths, endings, or big reveals. Safe for someone who hasn’t read it.',
    '',
    'Format your reply exactly like this, so I can paste it back into my app:',
    'FULL REVIEW:',
    '(the full review)',
    'SPOILER-FREE REVIEW:',
    '(the spoiler-free review)',
    '',
    '---',
    `My rating: ${book.rating ? `${book.rating} out of 5 stars` : 'not rated yet'}`,
  ];
  if (book.series) lines.push(`Series: ${book.series}${book.seriesNo ? `, book ${book.seriesNo}` : ''}`);
  reads.forEach((r, i) => lines.push(`${readName(i, reads.length)}: ${formatName(r)}${r.start ? `, started ${fmtDate(r.start, true)}` : ''}${r.end ? `, finished ${fmtDate(r.end, true)}` : ''}`));
  lines.push('', 'My notes while reading (date · place in the book):');
  if (notes.length) {
    notes.forEach(n => lines.push(`- ${[fmtDate(n.date, true), n.page ? `p. ${n.page}` : n.chapter ? `ch. ${n.chapter}` : ''].filter(Boolean).join(' · ')}: ${n.text.replace(/\s*\n\s*/g, ' / ')}`));
  } else lines.push('- (no notes yet)');
  if (quotes.length) {
    lines.push('', 'Quotes I saved:');
    quotes.forEach(q => lines.push(`- "${q.text.replace(/\s*\n\s*/g, ' / ')}"${q.who ? ` (${q.who}${q.page ? `, p. ${q.page}` : ''})` : q.page ? ` (p. ${q.page})` : ''}`));
  }
  if (book.review || book.reviewSafe) lines.push('', 'What I’ve written so far (build on it):', book.review || '', book.reviewSafe || '');
  return lines.join('\n');
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  Object.assign(ta.style, { position: 'fixed', top: '0', opacity: '0' });
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}

// Finds the two reviews in Claude's reply (headings with or without ** or #).
function splitReviews(text) {
  const clean = text.replace(/\*\*|__/g, '').replace(/^#+\s*/gm, '');
  const m = /FULL REVIEW[^\n:]*:?[ \t]*\n?([\s\S]*?)\n?\s*SPOILER[-\s]?FREE REVIEW[^\n:]*:?[ \t]*\n?([\s\S]*)$/i.exec(clean);
  return m ? { review: m[1].trim(), reviewSafe: m[2].trim() } : null;
}

const COPY_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
function drawReviews(book, body) {
  const card = (key, title, tag, text) => `<div class="card review">
      <div class="rv-head"><h3 class="rv-title">${title}</h3><span class="tag">${tag}</span></div>
      ${text ? `<p class="rv-text">${esc(text)}</p>` : '<p class="muted small">Not written yet.</p>'}
      <div class="row-btns"><button class="btn small icon-btn" data-claude aria-label="Copy for Claude" title="Copy for Claude">${COPY_ICON}</button>
        <button class="btn small" data-edit="${key}">${text ? 'Edit' : 'Write it myself'}</button>
        ${text ? `<button class="btn small ghost" data-copyrv="${key}">Copy review</button>` : ''}</div></div>`;
  body.innerHTML = `${card('review', 'My review', 'Spoilers', book.review)}
    ${card('reviewSafe', 'Spoiler-free review', 'No spoilers', book.reviewSafe)}
    <p class="muted small rv-private">Your reviews and stars are just yours, even in a buddy read.</p>`;

  // Copies the prompt + notes, then shows the steps (and the way back in with Claude's reply).
  const pasteReply = () => openModal(`<form id="pf" novalidate><h2>Paste Claude’s reply</h2>
      <p class="muted small">Paste the whole reply. It fills in both reviews (replacing what’s there now) and you can edit them after.</p>
      <label class="field"><textarea id="reply" rows="10" placeholder="FULL REVIEW: …&#10;SPOILER-FREE REVIEW: …"></textarea></label>
      <p class="error" id="perr" hidden></p>
      <div class="actions">${navigator.clipboard && navigator.clipboard.readText ? '<button type="button" class="btn small ghost" id="fromclip">Paste from clipboard</button>' : ''}<span class="spacer"></span>
      <button type="button" class="btn" data-close>Cancel</button><button class="btn primary" id="psave">Fill in reviews</button></div></form>`, (root, close) => {
    const clip = $('#fromclip', root);
    if (clip) clip.onclick = async () => { try { $('#reply', root).value = await navigator.clipboard.readText(); } catch { toast('Couldn’t read the clipboard. Press and hold in the box to paste.', true); } };
    $('#pf', root).onsubmit = e => {
      e.preventDefault();
      const got = splitReviews($('#reply', root).value);
      const err = $('#perr', root);
      if (!got) { err.textContent = 'I couldn’t find the “FULL REVIEW:” and “SPOILER-FREE REVIEW:” headings. Paste each review into its own box with Edit instead.'; err.hidden = false; return; }
      busy($('#psave', root), async () => { await DB.updateBook(book, got); close(); toast('Both reviews filled in'); });
    };
  });
  $$('[data-claude]', body).forEach(b => {
    b.onclick = async () => {
      const text = reviewPrompt(book);
      const copied = await copyText(text);
      openModal(`<h2>${copied ? 'Copied for Claude' : 'Copy this for Claude'}</h2>
        <p>${copied ? 'Your notes, quotes and rating are on the clipboard with a ready-made prompt.' : 'Press and hold in the box, Select All, then Copy.'}</p>
        ${copied ? '' : `<label class="field"><textarea rows="8" readonly>${esc(text)}</textarea></label>`}
        <ol class="rv-steps"><li>Open Claude, paste it, and send.</li><li>Copy Claude’s whole reply.</li><li>Come back and tap <b>Paste Claude’s reply</b>. It fills in both reviews.</li></ol>
        <div class="actions"><button type="button" class="btn" data-close>Close</button><span class="spacer"></span>
          <a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude ↗</a>
          <button type="button" class="btn primary" id="topaste">Paste Claude’s reply</button></div>`,
      (root, close) => { $('#topaste', root).onclick = () => { close(); pasteReply(); }; });
    };
  });
  $$('[data-edit]', body).forEach(b => {
    const key = b.dataset.edit;
    b.onclick = () => formModal({
      title: key === 'review' ? 'My review' : 'Spoiler-free review',
      values: { text: book[key] || '' },
      fields: [{ key: 'text', label: key === 'review' ? 'Spoilers are fine here' : 'Nothing that would spoil it', type: 'textarea', big: true }],
      onSave: v => DB.updateBook(book, { [key]: v.text }),
    });
  });
  $$('[data-copyrv]', body).forEach(b => { b.onclick = async () => toast(await copyText(book[b.dataset.copyrv]) ? 'Review copied' : 'Couldn’t copy. Press and hold the text instead.'); });
}

// ----- Board -----
function drawBookBoard(book, body) {
  body.innerHTML = '';
  photoBoard(book, body, itemsFor(book, 'pin').sort(byNewest), { world: book.id, kind: 'pin' }, 'No pictures yet. Add the vibe: characters, places, aesthetics.');
}

// ----- Map: a picture you can zoom, with pins -----
let mapState = { id: null, zoom: 1, adding: false, pinching: false };
const mapBusy = () => !!(mapState.pinching);

async function setMapPhoto(book, file) {
  const prepared = await Photos.prepare(file);
  checkPhotoRoom(book.map ? 0 : 1);
  if (book.sharedId && sectionShared(book, 'map')) {
    const d = sharedDoc(book);
    const photo = await DB.uploadBookPhoto(book.id, prepared);
    await DB.updateShared(book.sharedId, { map: photo, mapBy: DB.myUid() });
    if (d.map && d.mapBy === DB.myUid()) DB.removePhoto(d.map);
  } else await DB.setBookPhoto(book, 'map', prepared);
}

function mapPinForm(book, pin, at) {
  if (pin && !canEdit(pin)) return viewOnly(pin, `<h2>${esc(pin.label)}</h2>${pin.note ? `<p style="white-space:pre-line;margin-top:8px">${esc(pin.note)}</p>` : ''}`);
  formModal({
    title: pin ? 'Edit pin' : 'New pin',
    values: pin || {},
    fields: [
      { key: 'label', label: 'Place or moment', placeholder: 'Chapter 12: they reach the river' },
      { key: 'note', label: 'Notes (optional)', type: 'textarea' },
    ],
    onSave: async v => {
      if (!v.label) throw new Error('Name the pin.');
      if (pin) await updateItemFor(pin, v);
      else await addItemFor(book, { world: book.id, kind: 'mapmark', x: at.x, y: at.y, ...v });
    },
    onDelete: pin && (() => confirmBox('Remove this pin?', '', 'Remove', () => deleteItemFor(pin))),
  });
}

function drawMap(book, body) {
  if (mapState.id !== book.id) mapState = { id: book.id, zoom: 1, adding: false, pinching: false };
  const map = book.map;
  const shared = book.sharedId && sectionShared(book, 'map');
  const wireUpload = () => {
    $$('.mapfile', body).forEach(inp => {
      inp.onchange = async () => {
        const f = inp.files[0];
        inp.value = '';
        if (!f) return;
        const label = inp.closest('label');
        const old = label.firstChild.textContent;
        label.firstChild.textContent = 'Adding the map…';
        try { await setMapPhoto(book, f); toast('Map added'); } catch (e) { console.error(e); toast(friendlyError(e), true); }
        if (label.isConnected) label.firstChild.textContent = old;
      };
    });
  };
  if (!map) {
    body.innerHTML = `<div class="card empty-map"><p>Add a map of the world: a photo of the map at the front of the book, or one you found.${shared ? ' Everyone in this buddy read sees the same map.' : ''}</p>
      <label class="btn primary">Choose a map picture<input type="file" accept="image/*" hidden class="mapfile"></label></div>`;
    wireUpload();
    return;
  }
  const pins = itemsFor(book, 'mapmark').sort(byOldest);
  const z = mapState.zoom;
  body.innerHTML = `<div class="map-tools">
      <button class="btn small" id="zout" aria-label="Zoom out" ${z <= 1 ? 'disabled' : ''}>−</button>
      <span class="map-zoom" id="zl">${Math.round(z * 100)}%</span>
      <button class="btn small" id="zin" aria-label="Zoom in" ${z >= 5 ? 'disabled' : ''}>+</button>
      <span class="spacer"></span>
      <button class="btn small${mapState.adding ? ' primary' : ''}" id="addpin">${mapState.adding ? 'Cancel' : '+ Pin'}</button></div>
    <div class="map-view${mapState.adding ? ' adding' : ''}" id="mv"><div class="map-inner" id="mi" style="width:${z * 100}%">
      <img src="${esc(map.url)}" onerror="this.onerror=null;this.src='${esc(map.thumbUrl || map.url)}'" alt="Map" draggable="false">
      ${pins.map((p, i) => `<button class="map-pin" data-id="${esc(p.id)}" style="left:${(p.x * 100).toFixed(3)}%;top:${(p.y * 100).toFixed(3)}%" aria-label="${esc(p.label)}"><span><b>${i + 1}</b></span></button>`).join('')}
    </div></div>
    <p class="muted small map-hint">${mapState.adding ? 'Tap the spot on the map for the new pin.' : 'Pinch or use − and + to zoom. Tap a pin to read it.'}</p>
    ${pins.length ? `<div class="pin-list">${pins.map((p, i) => `<button class="pin-row card" data-id="${esc(p.id)}"><span class="pin-num">${i + 1}</span>
      <span class="pin-txt"><span class="pin-label">${esc(p.label)}</span>${p.note ? `<span class="pin-note">${esc(p.note)}</span>` : ''}${byLine(p)}</span></button>`).join('')}</div>` : ''}
    <div class="row-btns"><label class="btn small ghost">Change map<input type="file" accept="image/*" hidden class="mapfile"></label>
      <button class="btn small ghost danger-text" id="mapdel">Remove map</button></div>`;
  wireUpload();

  const mv = $('#mv', body), mi = $('#mi', body);
  // Zooming keeps the middle of what you're looking at in the middle.
  const setZoom = (nz, redraw) => {
    nz = Math.max(1, Math.min(5, nz));
    const cx = (mv.scrollLeft + mv.clientWidth / 2) / mi.offsetWidth, cy = (mv.scrollTop + mv.clientHeight / 2) / mi.offsetHeight;
    mapState.zoom = nz;
    mi.style.width = `${nz * 100}%`;
    mv.scrollLeft = cx * mi.offsetWidth - mv.clientWidth / 2;
    mv.scrollTop = cy * mi.offsetHeight - mv.clientHeight / 2;
    $('#zl', body).textContent = `${Math.round(nz * 100)}%`;
    if (redraw) { $('#zout', body).disabled = nz <= 1; $('#zin', body).disabled = nz >= 5; }
  };
  $('#zin', body).onclick = () => setZoom(mapState.zoom * 1.5, true);
  $('#zout', body).onclick = () => setZoom(mapState.zoom / 1.5, true);
  let pinch = null;
  mv.addEventListener('touchstart', e => {
    if (e.touches.length !== 2) return;
    const [a, b] = e.touches;
    pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: mapState.zoom };
    mapState.pinching = true;
  }, { passive: true });
  mv.addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = e.touches;
    setZoom(pinch.z * (Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d));
  }, { passive: false });
  const endPinch = () => {
    if (!pinch) return;
    pinch = null;
    mapState.pinching = false;
    $('#zout', body).disabled = mapState.zoom <= 1;
    $('#zin', body).disabled = mapState.zoom >= 5;
    if (missedRefresh) { missedRefresh = false; setTimeout(refresh, 0); }
  };
  mv.addEventListener('touchend', endPinch);
  mv.addEventListener('touchcancel', endPinch);

  $('#addpin', body).onclick = () => { mapState.adding = !mapState.adding; drawMap(book, body); };
  mi.addEventListener('click', e => {
    const pinEl = e.target.closest('.map-pin');
    if (pinEl && !mapState.adding) return mapPinForm(book, findItem(pinEl.dataset.id));
    if (!mapState.adding) return;
    const r = mi.getBoundingClientRect();
    const at = { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
    mapState.adding = false;
    drawMap(book, body);
    mapPinForm(book, null, at);
  });
  $$('.pin-row', body).forEach(el => { el.onclick = () => mapPinForm(book, findItem(el.dataset.id)); });
  $('#mapdel', body).onclick = () => confirmBox('Remove the map?', `The picture is removed${pins.length ? '; the pins stay in case you add a new one' : ''}.`, 'Remove', async () => {
    if (shared) await DB.updateShared(book.sharedId, { map: null });
    else await DB.setBookPhoto(book, 'map', null);
  });
}

// ---------- adding a book / its settings ----------
function cleanBlurb(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  return div.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

// Book search: Open Library first (free, no account, no daily limit to run
// out of), Google Books if that's down. Results carry a cover, pages, year;
// the blurb is fetched once you pick one (pickDetails).
async function searchBooks(q) {
  if (!navigator.onLine) throw new Error('You’re offline. Searching needs an internet connection.');
  try { return await searchOpenLibrary(q); } catch (e) { console.warn('Open Library search failed', e); }
  return searchGoogle(q);
}

async function searchOpenLibrary(q) {
  const fields = 'key,title,author_name,first_publish_year,number_of_pages_median,cover_i';
  const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12&fields=${fields}`);
  if (!r.ok) throw new Error(`Open Library ${r.status}`);
  const data = await r.json();
  return (data.docs || []).map(d => ({
    title: d.title || '', author: (d.author_name || []).slice(0, 2).join(', '), pages: d.number_of_pages_median || '',
    year: d.first_publish_year ? String(d.first_publish_year) : '', blurb: '', olKey: d.key || '',
    thumb: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '',
    big: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : '',
  })).filter(x => x.title);
}

async function searchGoogle(q) {
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12&printType=books`);
  if (!r.ok) throw new Error('Book search isn’t answering right now. Try again in a minute, or type the details in.');
  const data = await r.json();
  return (data.items || []).map(it => {
    const v = it.volumeInfo || {};
    const img = v.imageLinks || {};
    const thumb = (img.thumbnail || img.smallThumbnail || '').replace(/^http:/, 'https:').replace(/&edge=curl/, '');
    return {
      title: v.title || '', author: (v.authors || []).join(', '), pages: v.pageCount || '',
      year: (v.publishedDate || '').slice(0, 4), blurb: cleanBlurb(v.description),
      thumb, big: thumb ? `${thumb}&fife=w800` : '',
    };
  }).filter(x => x.title);
}

// The "what it's about" text for an Open Library pick (best effort; blank if it has none).
async function pickDetails(r) {
  if (r.blurb || !r.olKey) return r.blurb || '';
  try {
    const res = await fetch(`https://openlibrary.org${r.olKey}.json`);
    if (!res.ok) return '';
    const w = await res.json();
    const d = typeof w.description === 'string' ? w.description : (w.description && w.description.value) || '';
    // Trim Open Library's trailing source notes and link lists.
    return d.replace(/\r/g, '').split(/\n-{3,}|\n\(\[source\]|\n\[source\]|\nSee also:|\nContains:/i)[0].trim();
  } catch { return ''; }
}

function renderBookForm(book) {
  const isNew = !book;
  const b = book || { theme: 'custom', look: { ...Themes.BOOK_PRESETS[0] }, shelf: newBookShelf || (hasShelf('want') ? 'want' : shelvesOf()[0].id), mapOn: false, canonOn: false };
  newBookShelf = null;
  let theme = b.theme || 'custom';
  let look = lookOf(b);
  let lookPrepared = null, lookDrop = false, lookTouched = !isNew;
  // The cover: keep it, a photo you chose, one the search found, or none.
  let coverMode = 'keep', coverPrepared = null, found = { url: b.coverUrl || '', thumb: b.coverThumb || '' };
  let sInk = b.spineInk || '', sBg = b.spineBg || '';
  const parts = { ending: true, ships: true, headcanons: true, ...(b.canonParts || {}) };
  const worldKeys = Object.keys(Themes.BUILT_IN);
  const swatchRow = (id, list, cur) => `<div class="swatches ink-swatches" id="${id}">
      <button type="button" class="swatch auto${cur ? '' : ' on'}" data-c="" aria-label="Automatic" title="From the look">A</button>
      ${list.map(([c, n]) => `<button type="button" class="swatch${cur === c ? ' on' : ''}" style="--c:${c}" data-c="${c}" aria-label="${n}" title="${n}"></button>`).join('')}
      <label class="swatch custom-ink${cur && !list.some(([c]) => c === cur) ? ' on' : ''}" title="Any color" style="--c:${esc(cur || '#8a6d3b')}"><input type="color" value="${esc(cur || '#8a6d3b')}" aria-label="Any color"></label></div>`;

  view.innerHTML = `<div class="page form-page book-form">
    <header class="w-head"><a class="back" href="${isNew ? '#/books' : `#/b/${esc(b.id)}`}">‹ ${isNew ? 'Books' : 'Back'}</a></header>
    <h1 class="w-title small-title">${isNew ? 'Add a book' : 'Book settings'}</h1>
    ${isNew ? '<div class="card form-card" id="fromlib" hidden><h2 class="form-h">From the library</h2><div class="lib-row"></div></div>' : ''}
    <div class="card form-card">
      <h2 class="form-h" id="findh">${isNew ? 'Find it' : 'Find the cover &amp; details'}</h2>
      <form id="sf" class="search-row" novalidate><input id="q" type="search" placeholder="Title or author" value="${isNew ? '' : esc(b.title)}" autocomplete="off" enterkeyhint="search"><button class="btn small primary" id="go">Search</button></form>
      <div id="results" class="results"></div>
      ${isNew ? '<p class="muted small">Or type it in yourself below.</p>' : ''}
    </div>
    <form id="bf" novalidate class="card form-card">
      <div class="cover-pick"><div class="cover-prev" id="cprev"></div>
        <div class="photo-btns col"><label class="btn small">Cover photo<input type="file" accept="image/*" hidden id="coverfile"></label>
          <button type="button" class="btn small ghost" id="coverdrop">No cover</button></div></div>
      <label class="field"><span class="field-label">Title</span><input id="title" value="${esc(b.title || '')}"></label>
      <label class="field"><span class="field-label">Author</span><input id="author" value="${esc(b.author || '')}"></label>
      <div class="two-fields">
        <label class="field"><span class="field-label">Series (optional)</span><input id="series" value="${esc(b.series || '')}" list="serieslist" autocomplete="off"></label>
        <label class="field small-field"><span class="field-label">Book #</span><input id="seriesNo" value="${esc(b.seriesNo || '')}" inputmode="decimal"></label>
      </div>
      <datalist id="serieslist">${[...new Set(state.books.map(x => x.series).filter(Boolean))].map(s => `<option value="${esc(s)}">`).join('')}</datalist>
      <label class="field"><span class="field-label">Total pages (sets how thick it stands on the shelf)</span><input id="pages" type="number" inputmode="numeric" min="0" value="${esc(b.pages || '')}"></label>
      <label class="field"><span class="field-label">Shelf</span><select id="shelf">${shelvesOf().map(s => `<option value="${esc(s.id)}" ${shelfOf(b) === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field"><span class="field-label">What it’s about (optional)</span><textarea id="blurb" rows="5">${esc(b.blurb || '')}</textarea></label>

      <h2 class="form-h">The look</h2>
      <span class="field-label">Book looks</span>
      <div class="presets">${Themes.BOOK_PRESETS.map((p, i) => `<button type="button" class="preset" data-i="${i}" style="--pbg:${p.bg};--pcard:${p.card};--pacc:${p.accent};--ptext:${Themes.isDark(p.bg) ? (Themes.isDark(p.card) ? p.ink : p.card) : p.ink}"><span class="preset-dot"></span><span style="font-family:'${p.font}'">${esc(p.name)}</span></button>`).join('')}</div>
      <span class="field-label" style="margin-top:14px">World looks</span>
      <div class="presets">${worldKeys.map(k => `<button type="button" class="preset wlook${theme === k ? ' on' : ''}" data-wtheme="${k}"><span class="preset-dot"></span><span class="wlook-name">${esc(Themes.BUILT_IN[k].label)}</span></button>`).join('')}</div>
      <div id="customlook">
        <div class="color-grid">${[['bg', 'Background'], ['card', 'Cards'], ['ink', 'Text'], ['accent', 'Accent']].map(([k, label]) =>
          `<label class="color-field"><input type="color" id="c-${k}" value="${esc(look[k])}"><span>${label}</span></label>`).join('')}</div>
        <label class="field"><span class="field-label">Title font</span><select id="font">${Themes.FONTS.map(f => `<option ${f === look.font ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
        <div class="field"><span class="field-label">Background photo (optional)</span>
          <div class="photo-btns"><label class="btn small">Choose photo<input type="file" accept="image/*" hidden id="bgfile"></label>
          <button type="button" class="btn small ghost" id="bgdrop" ${look.photo ? '' : 'hidden'}>Remove</button></div>
          <label class="switch" id="tintwrap" ${look.photo ? '' : 'hidden'}><input type="checkbox" id="tint" ${look.tint === false ? '' : 'checked'}><span class="track"></span><span>Tint photo with background color</span></label></div>
      </div>
      <p class="muted small" id="wlooknote" hidden></p>
      <div class="preview-wrap"><span class="field-label">Preview</span><div class="w-preview" id="prev">
        <div class="w-preview-title" id="prev-title"></div><div class="w-preview-card">“A quote would sit here.”<span class="w-preview-pill">Notes</span></div></div></div>

      <h2 class="form-h">The spine</h2>
      <div class="spine-pick"><div class="spine-demo" id="sdemo"></div>
        <div class="spine-opts">
          <label class="field"><span class="field-label">Title font</span><select id="sfont"><option value="">Same as the look</option>${Themes.FONTS.map(f => `<option ${f === b.spineFont ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>
          <div class="field"><span class="field-label">Title color</span>${swatchRow('sinks', CARD_INKS, sInk)}</div>
          <div class="field"><span class="field-label">Spine color</span>${swatchRow('sbgs', SPINE_COLORS, sBg)}</div>
        </div></div>
      <label class="switch" id="serieswrap" hidden><input type="checkbox" id="allseries"><span class="track"></span><span id="serieslabel"></span></label>

      <h2 class="form-h">Linked world</h2>
      <label class="field"><span class="field-label">This book goes with</span><select id="world"><option value="">No world</option>${sortedWorlds().map(w => `<option value="${esc(w.id)}" ${b.worldId === w.id ? 'selected' : ''}>${esc(plainName(w))}</option>`).join('')}</select></label>

      <h2 class="form-h">Sections</h2>
      <label class="switch"><input type="checkbox" id="reviewson" ${b.reviewsOn !== false ? 'checked' : ''}><span class="track"></span><span>Reviews</span></label>
      <label class="switch"><input type="checkbox" id="ficson" ${b.ficsOn === true ? 'checked' : ''}><span class="track"></span><span>Fics (saved AO3 links)</span></label>
      <label class="switch"><input type="checkbox" id="mapon" ${b.mapOn ? 'checked' : ''}><span class="track"></span><span>Map (a map picture with pins)</span></label>
      <label class="switch"><input type="checkbox" id="canon" ${b.canonOn ? 'checked' : ''}><span class="track"></span><span>My Canon</span></label>
      <div class="canon-parts" id="parts">
        <span class="field-label">Show on My Canon</span>
        ${[['ending', 'My ending', 'how it really ends'], ['ships', 'Ships', 'with photos'], ['headcanons', 'Headcanons', '']].map(([k, label, hint]) =>
          `<label class="check"><input type="checkbox" data-part="${k}" ${parts[k] ? 'checked' : ''}><span>${label}${hint ? ` <span class="muted small">(${hint})</span>` : ''}</span></label>`).join('')}
      </div>
      <div class="actions"><span class="spacer"></span><a class="btn" href="${isNew ? '#/books' : `#/b/${esc(b.id)}`}">Cancel</a><button class="btn primary" id="save">${isNew ? 'Put it on the shelf' : 'Save'}</button></div>
    </form>
    ${isNew ? '' : `<div class="card form-card share-card" id="buddy">${buddyHtml(b)}</div>
      <div class="card form-card danger-zone"><button class="btn ghost danger-text block" id="del">Delete this book</button></div>`}
  </div>`;

  const root = $('#bf');
  Themes.FONTS.forEach(Themes.loadFont);
  // The book look it's wearing now, if it's still one of the starting looks.
  if (theme === 'custom') {
    const i = Themes.BOOK_PRESETS.findIndex(p => p.bg === look.bg && p.card === look.card && p.accent === look.accent && p.font === look.font);
    if (i >= 0) $(`.preset[data-i="${i}"]`).classList.add('on');
  }
  $$('.wlook').forEach(el => { const k = el.dataset.wtheme; Themes.apply(el, { theme: k }); el.classList.add('preset', 'wlook'); });

  // ----- what the form says right now -----
  const readLook = () => ({ bg: $('#c-bg').value, card: $('#c-card').value, ink: $('#c-ink').value, accent: $('#c-accent').value, font: $('#font').value, tint: $('#tint').checked });
  const current = () => ({
    id: b.id || 'new', title: $('#title').value.trim() || 'Your book', author: $('#author').value.trim(),
    pages: Number($('#pages').value) || 0, theme, look: theme === 'custom' ? readLook() : null,
    spineFont: $('#sfont').value, spineInk: sInk, spineBg: sBg, shelf: $('#shelf').value,
    series: $('#series').value.trim(), seriesNo: $('#seriesNo').value.trim(),
  });
  const coverSrcNow = () => (coverMode === 'upload' ? URL.createObjectURL(coverPrepared.thumb.blob)
    : coverMode === 'none' ? null
    : coverMode === 'found' ? found.thumb || found.url
    : coverSmall(b));
  const draw = () => {
    const c = current();
    // preview
    const photoUrl = lookPrepared ? URL.createObjectURL(lookPrepared.thumb.blob) : (!lookDrop && look.photo ? look.photo.url : null);
    Themes.apply($('#prev'), theme === 'custom' ? { theme: 'custom', look: { ...c.look, photo: photoUrl ? { url: photoUrl } : null } } : { theme });
    $('#prev-title').textContent = c.title;
    $('#customlook').hidden = theme !== 'custom';
    $('#wlooknote').hidden = theme === 'custom';
    $('#wlooknote').textContent = theme === 'custom' ? '' : `Using the ${Themes.BUILT_IN[theme].label} look. Pick a book look to choose your own colors.`;
    $$('.wlook').forEach(el => el.classList.toggle('on', el.dataset.wtheme === theme));
    // spine + cover
    $('#sdemo').innerHTML = `<div class="case-row demo-row">${spineHtml(c)}</div>`;
    fitSpines($('#sdemo'));
    const src = coverSrcNow();
    $('#cprev').innerHTML = src ? `<img src="${esc(src)}" alt="">` : `<span class="gen-cover" id="gc"><span class="gc-title">${esc(c.title)}</span>${c.author ? `<span class="gc-author">${esc(c.author)}</span>` : ''}</span>`;
    const gc = $('#gc');
    if (gc) Themes.apply(gc, theme === 'custom' ? { theme: 'custom', look: c.look } : { theme });
    $('#coverdrop').hidden = !src;
    // series
    const key = c.series.toLowerCase();
    const others = key ? state.books.filter(x => x.id !== b.id && seriesKey(x) === key) : [];
    $('#serieswrap').hidden = isNew || !others.length;
    $('#serieslabel').textContent = `Also use this look for the other ${others.length === 1 ? 'book' : `${others.length} books`} in ${c.series}`;
  };
  const touched = () => { lookTouched = true; draw(); };

  $$('.preset[data-i]').forEach(btn => {
    btn.onclick = () => {
      const p = Themes.BOOK_PRESETS[+btn.dataset.i];
      theme = 'custom';
      ['bg', 'card', 'ink', 'accent'].forEach(k => { $(`#c-${k}`).value = p[k]; });
      $('#font').value = p.font;
      $$('.preset[data-i]').forEach(x => x.classList.toggle('on', x === btn));
      touched();
    };
  });
  $$('.wlook').forEach(btn => {
    btn.onclick = () => {
      theme = btn.dataset.wtheme;
      $$('.preset[data-i]').forEach(x => x.classList.remove('on'));
      // Picking a world's look links the book to that world, if it isn't linked yet.
      const w = state.worlds.find(x => x.theme === theme);
      if (w && !$('#world').value) $('#world').value = w.id;
      touched();
    };
  });
  $$('#c-bg, #c-card, #c-ink, #c-accent, #font, #sfont, #title, #author, #pages, #shelf, #seriesNo').forEach(el => { el.addEventListener('input', draw); el.addEventListener('change', draw); });
  $$('#c-bg, #c-card, #c-ink, #c-accent, #font').forEach(el => el.addEventListener('input', () => { lookTouched = true; }));
  $('#tint').onchange = draw;
  // A new book in a series you already have starts with that series' look.
  $('#series').addEventListener('input', () => {
    const key = $('#series').value.trim().toLowerCase();
    const mate = key && isNew && !lookTouched ? sortBooks(state.books.filter(x => seriesKey(x) === key), 'drag')[0] : null;
    if (mate) {
      theme = mate.theme || 'custom';
      if (theme === 'custom') { const l = lookOf(mate); ['bg', 'card', 'ink', 'accent'].forEach(k => { $(`#c-${k}`).value = l[k]; }); $('#font').value = l.font; }
      $('#sfont').value = mate.spineFont || '';
      sInk = mate.spineInk || ''; sBg = mate.spineBg || '';
      $$('#sinks .swatch').forEach(s => s.classList.toggle('on', (s.dataset.c ?? null) === sInk));
      $$('#sbgs .swatch').forEach(s => s.classList.toggle('on', (s.dataset.c ?? null) === sBg));
      if (!$('#world').value && mate.worldId) $('#world').value = mate.worldId;
    }
    draw();
  });
  const swatches = (id, set) => {
    $$(`#${id} button`).forEach(s => { s.onclick = () => { $$(`#${id} .swatch`).forEach(x => x.classList.toggle('on', x === s)); set(s.dataset.c); draw(); }; });
    const pick = $(`#${id} input[type=color]`);
    pick.oninput = () => { const lab = pick.closest('.swatch'); lab.style.setProperty('--c', pick.value); $$(`#${id} .swatch`).forEach(x => x.classList.toggle('on', x === lab)); set(pick.value); draw(); };
  };
  swatches('sinks', v => { sInk = v; });
  swatches('sbgs', v => { sBg = v; });
  $('#bgfile').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try { lookPrepared = await Photos.prepare(f); lookDrop = false; $('#bgdrop').hidden = false; $('#tintwrap').hidden = false; touched(); } catch (x) { toast(friendlyError(x), true); }
  };
  $('#bgdrop').onclick = e => { lookPrepared = null; lookDrop = true; e.target.hidden = true; $('#tintwrap').hidden = true; touched(); };
  $('#coverfile').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try { coverPrepared = await Photos.prepare(f); coverMode = 'upload'; draw(); } catch (x) { toast(friendlyError(x), true); }
  };
  $('#coverdrop').onclick = () => { coverMode = 'none'; coverPrepared = null; draw(); };
  const showParts = () => { $('#parts').hidden = !$('#canon').checked; };
  $('#canon').onchange = showParts;
  showParts();

  // ----- search -----
  let results = [];
  $('#sf').onsubmit = e => {
    e.preventDefault();
    const q = $('#q').value.trim();
    if (!q) return;
    $('#q').blur();
    busy($('#go'), async () => {
      results = await searchBooks(q);
      $('#results').innerHTML = results.length ? results.map((r, i) => `<button type="button" class="result" data-r="${i}">
          ${r.thumb ? `<img src="${esc(r.thumb)}" alt="" loading="lazy">` : '<span class="result-blank"></span>'}
          <span class="result-txt"><span class="result-title">${esc(r.title)}</span><span class="muted small">${esc([r.author, r.year, r.pages ? `${r.pages} pages` : ''].filter(Boolean).join(' · '))}</span></span></button>`).join('')
        : '<p class="muted small">Nothing found. Try fewer words, or type it in below.</p>';
      $$('.result').forEach(el => {
        el.onclick = async () => {
          const r = results[+el.dataset.r];
          $('#title').value = r.title;
          if (r.author) $('#author').value = r.author;
          if (r.pages) $('#pages').value = r.pages;
          if (isNew || !$('#blurb').value.trim()) {
            pickDetails(r).then(text => { if (text && (isNew || !$('#blurb').value.trim())) $('#blurb').value = text; });
          }
          if (r.thumb) { found = { url: r.big, thumb: r.thumb }; coverMode = 'found'; coverPrepared = null; }
          $('#results').innerHTML = '';
          draw();
          toast(isNew ? 'Filled in. Pick a look, then put it on the shelf.' : 'Found it. Save to keep the new details.');
          $('#bf').scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
      });
    }, 'Searching…');
  };

  draw();
  if (isNew) fillFromLibrary(b.shelf);

  // ----- save -----
  root.onsubmit = e => {
    e.preventDefault();
    busy($('#save'), async () => {
      const c = current();
      if (!$('#title').value.trim()) throw new Error('Give the book a title.');
      const canonPicked = Object.fromEntries($$('[data-part]', root).map(x => [x.dataset.part, x.checked]));
      if ($('#canon').checked && !Object.values(canonPicked).some(Boolean)) throw new Error('Pick at least one thing to show on My Canon, or turn it off.');
      const data = {
        title: c.title, author: c.author, series: c.series, seriesNo: c.seriesNo, pages: c.pages || null,
        blurb: $('#blurb').value.trim(), shelf: c.shelf, theme,
        look: theme === 'custom' ? { ...readLook(), photo: lookDrop ? null : (look.photo || null) } : (b.look || null),
        spineFont: c.spineFont, spineInk: sInk, spineBg: sBg, worldId: $('#world').value || null,
        mapOn: $('#mapon').checked, canonOn: $('#canon').checked, canonParts: canonPicked,
        reviewsOn: $('#reviewson').checked, ficsOn: $('#ficson').checked,
      };
      if (coverMode === 'found') Object.assign(data, { coverUrl: found.url, coverThumb: found.thumb });
      if (coverMode === 'none' || coverMode === 'upload') Object.assign(data, { coverUrl: '', coverThumb: '' });
      checkPhotoRoom((coverMode === 'upload' && !b.cover ? 1 : 0) + (lookPrepared && !look.photo ? 1 : 0));
      if (isNew) {
        const onShelf = state.books.filter(x => shelfOf(x) === c.shelf);
        const read = { start: c.shelf === 'reading' ? today() : '', end: '', physical: true, audio: false };
        Object.assign(data, {
          reads: [read], rating: 0, page: 0, chapter: '', review: '', reviewSafe: '', ending: '',
          order: Math.max(-1, ...onShelf.map(x => x.order ?? 0)) + 1,
        });
        const id = await DB.addBook(data, coverMode === 'upload' ? coverPrepared : null);
        if (lookPrepared) await DB.updateBook({ id }, { look: data.look }, lookPrepared);
        location.hash = `#/b/${id}`;
        return;
      }
      if (data.shelf !== shelfOf(b)) Object.assign(data, shelfMovePatch(b, data.shelf));
      await DB.updateBook(b, data, lookPrepared, lookDrop);
      if (coverMode === 'upload') await DB.setBookPhoto(b, 'cover', coverPrepared);
      else if ((coverMode === 'none' || coverMode === 'found') && b.cover) await DB.setBookPhoto(b, 'cover', null);
      // The rest of the series takes this look (without the background photo, which stays this book's).
      if ($('#allseries').checked) {
        const key = c.series.toLowerCase();
        const look2 = data.look ? { ...data.look, photo: null } : null;
        await Promise.all(state.books.filter(x => x.id !== b.id && seriesKey(x) === key)
          .map(x => DB.updateBook(x, { theme, look: look2, spineFont: data.spineFont, spineInk: sInk, spineBg: sBg })));
      }
      toast('Saved');
      location.hash = `#/b/${b.id}`;
    });
  };

  if (!isNew) {
    wireBuddy(b);
    $('#del').onclick = () => {
      const inside = itemsIn(b.id);
      confirmBox(`Delete ${b.title}?`, `This deletes the book and everything in it (${inside.length} notes, quotes, photos and pins). It can’t be undone.`, 'Delete', async () => {
        if (b.sharedId) {
          detached.add(b.sharedId); // gone, so nothing to turn back into a personal copy
          const d = sharedDoc(b);
          if (d && d.owner === DB.myUid()) await DB.updateShared(b.sharedId, { ended: true }).catch(() => {});
          else await DB.leaveShared(b.sharedId).catch(() => {});
        }
        await DB.deleteBook(b, inside);
        location.hash = '#/books';
      });
    };
  }
}

// ---------- buddy reads ----------
function buddyHtml(b) {
  const d = sharedDoc(b);
  if (!b.sharedId) {
    return `<h2 class="form-h">Buddy read</h2>
      <p class="muted small">Read it together: pick what you share (notes side by side, quotes, board, map, My Canon, fics). Stars, dates and reviews stay your own. It shows up for them only after they accept.</p>
      <button type="button" class="btn small" id="buddy-go">Invite someone…</button>`;
  }
  if (!d || d.gone) return '<h2 class="form-h">Buddy read</h2><p class="muted small">Loading…</p>';
  const names = Object.entries(d.names || {}).filter(([u]) => u !== DB.myUid() && (d.members || []).includes(u)).map(([, n]) => n);
  const owner = d.owner === DB.myUid();
  const secs = BOOK_SHARE.filter(([k]) => (d.sections || {})[k]).map(([, l]) => l);
  return `<h2 class="form-h">Buddy read</h2>
    <p class="small">${names.length ? `Reading with <b>${esc(names.join(', '))}</b>.` : 'Invite sent. No one has joined yet.'}</p>
    ${(d.invited || []).length ? `<p class="muted small">Waiting on: ${(d.invited || []).map(esc).join(', ')}</p>` : ''}
    <p class="muted small">Shared: ${esc(secs.join(', ') || 'nothing')}</p>
    <div class="row-btns">${owner ? '<button type="button" class="btn small" id="buddy-go">Invite someone…</button><button type="button" class="btn small ghost danger-text" id="buddy-stop">Stop sharing</button>'
      : '<button type="button" class="btn small ghost danger-text" id="buddy-leave">Leave buddy read</button>'}</div>`;
}

function wireBuddy(b) {
  const go = $('#buddy-go'), stop = $('#buddy-stop'), leave = $('#buddy-leave');
  if (go) go.onclick = () => buddyFlow(b);
  if (stop) stop.onclick = () => confirmBox('Stop sharing?', 'Everyone keeps their own copy of the notes, quotes and pictures as they are now.', 'Stop sharing', async () => {
    await DB.updateShared(b.sharedId, { ended: true });
    await detachShared(b, state.shared[b.sharedId]);
    location.hash = `#/b/${b.id}`;
  });
  if (leave) leave.onclick = () => confirmBox('Leave this buddy read?', 'You keep your own copy of everything shared so far.', 'Leave', async () => {
    const sid = b.sharedId;
    await detachShared(b, state.shared[sid]);
    await DB.leaveShared(sid).catch(e => console.warn(e));
    location.hash = `#/b/${b.id}`;
  });
}

function buddyFlow(b) {
  if (DB.demo) return toast('Buddy reads need a real account (not sample mode).', true);
  openModal(`<form id="bfm" novalidate><h2>Read ${esc(b.title)} together</h2>
    ${b.sharedId ? '<p class="muted small">They’ll join with what’s already shared.</p>' : `<span class="field-label" style="margin-top:12px">What to share</span>
    <div class="share-secs">${BOOK_SHARE.map(([k, l]) => `<label class="check"><input type="checkbox" data-bsec="${k}" ${k === 'notes' || k === 'quotes' ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <p class="muted small">What you already have in those sections moves into the buddy read. Your stars, dates and reviews always stay yours.</p>`}
    <label class="field"><span class="field-label">Their email (the one they sign in with)</span><input type="email" id="to" autocapitalize="off" autocomplete="off" inputmode="email"></label>
    <label class="field"><span class="field-label">Your name (shown on your notes)</span><input id="me" value="${esc(b.sharedId ? shareName(b) : myName())}"></label>
    <p class="error" id="err" hidden></p>
    <div class="actions"><button type="button" class="btn" data-close>Cancel</button><span class="spacer"></span><button class="btn primary" id="send">Send invite</button></div></form>`,
  (root, close) => {
    $('#bfm', root).onsubmit = e => {
      e.preventDefault();
      const to = $('#to', root).value.trim().toLowerCase(), me = $('#me', root).value.trim(), err = $('#err', root);
      const fail = m => { err.textContent = m; err.hidden = false; };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return fail('That email doesn’t look right.');
      if (to === DB.myEmail()) return fail('That’s your own email.');
      if (!me) return fail('Add your name.');
      busy($('#send', root), async () => {
        if (b.sharedId) {
          await DB.inviteToShared(b.sharedId, to);
          await DB.updateShared(b.sharedId, { [`names.${DB.myUid()}`]: me });
        } else {
          const secs = $$('[data-bsec]', root).filter(c => c.checked).map(c => c.dataset.bsec);
          if (!secs.length) throw new Error('Pick at least one thing to share.');
          await startBuddyRead(b, me, to, secs);
        }
        close();
        toast('Invite sent. It shows up for them the next time they open the app.');
      }, 'Sending…');
    };
  });
}

async function startBuddyRead(book, me, email, secs) {
  const sections = Object.fromEntries(BOOK_SHARE.map(([k]) => [k, secs.includes(k)]));
  const sid = await DB.createShared({
    type: 'book', name: book.title, sections, names: { [DB.myUid()]: me }, invited: [email],
    canon: { ending: book.ending || '', cutoff: null, canonParts: canonParts(book) },
    map: sections.map ? (book.map || null) : null, mapBy: DB.myUid(),
    book: {
      title: book.title, author: book.author || '', series: book.series || '', seriesNo: book.seriesNo || '', pages: book.pages || null,
      coverUrl: book.coverUrl || '', coverThumb: book.coverThumb || '', cover: book.cover || null, blurb: book.blurb || '',
      theme: book.theme || 'custom', look: book.look || null, spineFont: book.spineFont || '', spineInk: book.spineInk || '', spineBg: book.spineBg || '',
    },
  });
  await moveIntoShared(book, sid, secs, me);
  await DB.updateBook(book, { sharedId: sid });
}

// Someone invited you to read a book together (from offerJoins in together.js).
function offerBuddyRead(d) {
  const from = (d.names || {})[d.owner] || 'Someone';
  const secs = BOOK_SHARE.filter(([k]) => (d.sections || {})[k]).map(([, l]) => l);
  const def = hasShelf('reading') ? 'reading' : shelvesOf()[0].id;
  return new Promise(resolve => openModal(`<form id="jf" novalidate><h2>${esc(from)} wants to read ${esc(d.name)} with you</h2>
    <p>You’ll share: <b>${esc(secs.join(', '))}</b>. Your stars, dates and reviews stay your own.</p>
    <label class="field"><span class="field-label">Put it on this shelf</span><select id="jshelf">${shelvesOf().map(s => `<option value="${esc(s.id)}" ${s.id === def ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
    <label class="field"><span class="field-label">Your name (shown on your notes)</span><input id="me" value="${esc(myName())}"></label>
    <div class="actions"><button type="button" class="btn ghost" id="no">No thanks</button><button type="button" class="btn" data-close>Not now</button><span class="spacer"></span><button class="btn primary" id="yes">Join</button></div></form>`,
  (root, close) => {
    const done = () => { close(); resolve(); };
    root.addEventListener('click', e => { if (e.target === root || e.target.closest('[data-close]')) resolve(); });
    $('#no', root).onclick = () => { DB.declineShared(d.id).catch(() => {}); done(); };
    $('#jf', root).onsubmit = e => {
      e.preventDefault();
      const me = $('#me', root).value.trim() || myName();
      busy($('#yes', root), async () => { await joinBuddyRead(d, me, $('#jshelf', root).value); done(); toast(`${d.name} is on your bookcase`); }, 'Joining…');
    };
  }));
}

async function joinBuddyRead(d, me, shelf) {
  await DB.joinShared(d.id, me);
  const B = d.book || {};
  const sec = d.sections || {};
  const onShelf = state.books.filter(x => shelfOf(x) === shelf);
  const data = {
    title: B.title || d.name, author: B.author || '', series: B.series || '', seriesNo: B.seriesNo || '', pages: B.pages || null,
    coverUrl: B.coverUrl || '', coverThumb: B.coverThumb || '', blurb: B.blurb || '',
    theme: B.theme || 'custom', look: B.look ? { ...B.look, photo: null } : null,
    spineFont: B.spineFont || '', spineInk: B.spineInk || '', spineBg: B.spineBg || '',
    shelf, order: Math.max(-1, ...onShelf.map(x => x.order ?? 0)) + 1, rating: 0, page: 0, chapter: '', review: '', reviewSafe: '', ending: '',
    reads: [{ start: shelf === 'reading' ? today() : '', end: '', physical: true, audio: false }],
    sharedId: d.id, mapOn: !!sec.map, canonOn: !!sec.canon, ficsOn: !!sec.fics,
    canonParts: (d.canon && d.canon.canonParts) || { ending: true, ships: true, headcanons: true },
  };
  const id = await DB.addBook(data);
  // Their own copies of the pictures, so each person can change theirs freely.
  const patch = {};
  if (B.cover) { try { patch.cover = await DB.copyPhoto('books', id, B.cover); } catch (e) { console.warn(e); } }
  if (B.look && B.look.photo) { try { patch.look = { ...data.look, photo: await DB.copyPhoto('books', id, B.look.photo) }; } catch (e) { console.warn(e); } }
  if (Object.keys(patch).length) await DB.updateBook({ id }, patch);
}

// ---------- the book library (your bookcase, offered to your sisters) ----------
// Your account publishes the books on your shelves to library/books: their
// details, cover, look, spine and map, never your stars, dates, notes or
// reviews. Everyone else picks from it the first time they sign in
// (#/books/pick) and from "From the library" on Add a book after that.

// The three books your bookcase starts with (added once, to your account only).
const BOOK_STARTERS = [
  {
    title: 'A Court of Thorns and Roses', author: 'Sarah J. Maas', series: 'A Court of Thorns and Roses', seriesNo: '1', pages: 419,
    coverUrl: 'https://covers.openlibrary.org/b/id/15102579-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/15102579-M.jpg',
    blurb: 'When nineteen-year-old huntress Feyre kills a wolf in the woods, a beastly creature comes to demand a life for a life and carries her off to Prythian, the land of the faeries. Her captor isn’t what he seems, and the shadow spreading over the faerie lands may soon reach them all.',
    theme: 'custom', look: { bg: '#2a1418', card: '#fbf1ee', ink: '#2e1a1c', accent: '#b3263a', font: 'Cinzel' },
    spineFont: 'Cinzel', spineInk: '#f3e3c3', spineBg: '#8f1426',
  },
  {
    title: 'Fourth Wing', author: 'Rebecca Yarros', series: 'The Empyrean', seriesNo: '1', pages: 518,
    coverUrl: 'https://covers.openlibrary.org/b/id/14407898-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/14407898-M.jpg',
    blurb: 'Violet Sorrengail expected a quiet life as a scribe, until her mother, the commanding general, orders her into Basgiath War College to train as a dragon rider. Smaller and more fragile than the other cadets, Violet has to outthink her rivals, earn a dragon’s bond, and survive Xaden Riorson, a wingleader with every reason to want her dead.',
    theme: 'custom', look: { bg: '#e6d7b5', card: '#fbf4e2', ink: '#3a2c1b', accent: '#8c5a2b', font: 'Uncial Antiqua' },
    spineFont: 'Uncial Antiqua', spineInk: '#2b2118', spineBg: '#e9dcc0',
  },
  {
    title: 'House of Earth and Blood', author: 'Sarah J. Maas', series: 'Crescent City', seriesNo: '1', pages: 803,
    coverUrl: 'https://covers.openlibrary.org/b/id/9289603-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/9289603-M.jpg',
    blurb: 'Bryce Quinlan’s life in Crescent City is all late nights and half-Fae charm, until a demon murders her closest friends. Two years later the killings start again, and Bryce is forced to team up with Hunt Athalar, a fallen angel bound to serve the city’s rulers, to find the killer before the whole city burns.',
    theme: 'custom', look: { bg: '#1a1020', card: '#f7f1ee', ink: '#2a1a22', accent: '#c8281e', font: 'Playfair Display' },
    spineFont: 'Playfair Display', spineInk: '#b5121b', spineBg: '#f2ede6',
  },
];

let seedingBooks = false;
async function seedBookStarters() {
  if (seedingBooks || !isOwner() || state.settings.bookStarters) return;
  seedingBooks = true;
  try {
    const have = new Set(state.books.map(b => libKey(b)));
    let order = Math.max(-1, ...state.books.filter(b => shelfOf(b) === 'want').map(b => b.order ?? 0)) + 1;
    for (const st of BOOK_STARTERS) {
      if (have.has(libKey(st))) continue;
      await DB.addBook({
        ...st, shelf: hasShelf('want') ? 'want' : shelvesOf()[0].id, order: order++,
        reads: [{ start: '', end: '', physical: true, audio: false }], rating: 0, page: 0, chapter: '',
        review: '', reviewSafe: '', ending: '', mapOn: false, canonOn: false, reviewsOn: true, ficsOn: false, worldId: null,
      });
    }
    await DB.saveSettings({ bookStarters: true });
    state.settings.bookStarters = true;
  } catch (e) { console.error(e); }
  seedingBooks = false;
}

const libKey = b => `${(b.title || '').trim().toLowerCase()}|${(b.author || '').trim().toLowerCase()}`;
const photoLink = p => (p && p.url ? { url: p.url, thumbUrl: p.thumbUrl || p.url, w: p.w || null, h: p.h || null } : null);

// Your books, as library entries (only what's safe to share).
let lastBookLibrary = null;
function publishBookLibrary() {
  if (!isOwner() || !DB.saveBookLibrary) return;
  const books = state.books.map(b => ({
    id: b.id, title: b.title || '', author: b.author || '', series: b.series || '', seriesNo: b.seriesNo || '', pages: b.pages || null,
    coverUrl: b.coverUrl || '', coverThumb: b.coverThumb || '', cover: photoLink(b.cover), blurb: b.blurb || '',
    theme: b.theme || 'custom', look: b.look ? { ...b.look, photo: photoLink(b.look.photo) } : null,
    spineFont: b.spineFont || '', spineInk: b.spineInk || '', spineBg: b.spineBg || '',
    map: photoLink(b.map), mapOn: !!b.mapOn || !!b.map, canonOn: !!b.canonOn,
    canonParts: b.canonParts || { ending: true, ships: true, headcanons: true }, reviewsOn: b.reviewsOn !== false, ficsOn: b.ficsOn === true,
  })).sort((a, b) => titleKey(a.title).localeCompare(titleKey(b.title)));
  const json = JSON.stringify(books);
  if (json === lastBookLibrary) return;
  lastBookLibrary = json;
  DB.saveBookLibrary({ books }).catch(e => console.warn('Could not publish the book library', e));
}

// Library books this person doesn't have yet.
function libChoices(lib) {
  const mine = new Set(state.books.map(b => b.fromLib).filter(Boolean));
  const keys = new Set(state.books.map(libKey));
  return ((lib && lib.books) || []).filter(e => !mine.has(e.id) && !keys.has(libKey(e)));
}
const bookLibrary = () => state.bookLibraryP || Promise.resolve(null);

function libCoverHtml(e) {
  const src = (e.cover && (e.cover.thumbUrl || e.cover.url)) || e.coverThumb || e.coverUrl;
  return src ? `<img class="cover-img" src="${esc(src)}" alt="Cover of ${esc(e.title)}" loading="lazy">`
    : `<span class="gen-cover" data-lib-cover="${esc(e.id)}"><span class="gc-title">${esc(e.title)}</span>${e.author ? `<span class="gc-author">${esc(e.author)}</span>` : ''}</span>`;
}
function paintLibCovers(root, entries) {
  $$('[data-lib-cover]', root).forEach(el => { const e = entries.find(x => x.id === el.dataset.libCover); if (e) Themes.apply(el, { theme: e.theme, look: e.look }); });
}

// Puts a library book on this person's shelf (their own copy of every picture).
async function addFromLibrary(e, shelf) {
  const onShelf = state.books.filter(x => shelfOf(x) === shelf);
  const data = {
    title: e.title, author: e.author, series: e.series, seriesNo: e.seriesNo, pages: e.pages || null,
    coverUrl: e.coverUrl || '', coverThumb: e.coverThumb || '', blurb: e.blurb || '',
    theme: e.theme || 'custom', look: e.look ? { ...e.look, photo: null } : null,
    spineFont: e.spineFont || '', spineInk: e.spineInk || '', spineBg: e.spineBg || '',
    // Canon and Fics always start off (there's nothing in them yet); they can turn them on in the book's settings.
    mapOn: !!e.mapOn, canonOn: false, canonParts: e.canonParts || { ending: true, ships: true, headcanons: true },
    reviewsOn: e.reviewsOn !== false, ficsOn: false, worldId: null, fromLib: e.id,
    shelf, order: Math.max(-1, ...onShelf.map(x => x.order ?? 0)) + 1, rating: 0, page: 0, chapter: '', review: '', reviewSafe: '', ending: '',
    reads: [{ start: shelf === 'reading' ? today() : '', end: shelf === 'read' ? today() : '', physical: true, audio: false }],
  };
  checkPhotoRoom((e.cover ? 1 : 0) + (e.map ? 1 : 0) + (e.look && e.look.photo ? 1 : 0));
  const id = await DB.addBook(data);
  const patch = {};
  const copy = async p => { try { return await DB.copyPhoto('books', id, p); } catch (x) { console.warn('Picture not copied', x); return null; } };
  if (e.cover) { const c = await copy(e.cover); if (c) patch.cover = c; }
  if (e.map) { const m = await copy(e.map); if (m) patch.map = m; }
  if (e.look && e.look.photo) { const ph = await copy(e.look.photo); if (ph) patch.look = { ...data.look, photo: ph }; }
  if (Object.keys(patch).length) await DB.updateBook({ id }, patch);
  return id;
}

// After picking worlds the first time: on to books, if the library has any.
async function afterWorldsPick() {
  const lib = await bookLibrary();
  return libChoices(lib).length && !state.settings.booksPicked ? '#/books/pick' : null;
}

// "Pick your books": the first-time step, and the empty bookcase's way in.
function renderBookPick() {
  view.innerHTML = '<p class="loading">Opening the library…</p>';
  bookLibrary().then(lib => { if (parseHash()[0] === 'books' && parseHash()[1] === 'pick') drawBookPick(lib); });
}

function drawBookPick(lib) {
  const firstTime = !state.settings.booksPicked;
  const choices = libChoices(lib);
  const def = hasShelf('want') ? 'want' : shelvesOf()[0].id;
  const picked = new Map();
  const shelfSelect = `${shelvesOf().map(s => `<option value="${esc(s.id)}" ${s.id === def ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}`;
  view.innerHTML = `<div class="library books-pick">
    <header class="w-head"><a class="back" href="#/books">‹ Books</a></header>
    <header class="lib-head"><div class="lib-crest" aria-hidden="true">${BOOK_CREST}</div>
      <h1 class="lib-title">Pick your books</h1>
      <p class="lib-sub">${firstTime ? 'Tap the ones you want on your shelves. You can add more anytime, and your own too.' : 'Tap the ones you want on your shelves.'}</p></header>
    ${choices.length ? `<div class="pick-books">${choices.map(e => `<div class="pick-book" data-lib="${esc(e.id)}">
        <button type="button" class="pick-cover" aria-pressed="false" aria-label="${esc(e.title)}">${libCoverHtml(e)}<span class="pick-check" aria-hidden="true">✓</span></button>
        <span class="pick-title">${esc(e.title)}</span>${e.author ? `<span class="pick-author">${esc(e.author)}</span>` : ''}
        <label class="mini-field pick-shelf" hidden><span>Shelf</span><select>${shelfSelect}</select></label></div>`).join('')}</div>`
      : '<p class="empty">You already have every book in the library.</p>'}
    <div class="pick-bar">${choices.length ? '<button class="btn primary block" id="go" disabled>Pick a book</button>' : ''}
      <button class="linkish skip-link" id="skip">${firstTime ? 'Skip for now' : 'Back to my books'}</button></div>
  </div>`;
  paintLibCovers(view, choices);
  const go = $('#go');
  const label = () => { go.disabled = !picked.size; go.textContent = picked.size ? `Put ${picked.size === 1 ? 'it' : `these ${picked.size}`} on my shelves` : 'Pick a book'; };
  $$('.pick-book').forEach(el => {
    const e = choices.find(x => x.id === el.dataset.lib);
    const btn = $('.pick-cover', el), sel = $('select', el);
    btn.onclick = () => {
      if (picked.has(e.id)) picked.delete(e.id); else picked.set(e.id, sel.value);
      const on = picked.has(e.id);
      el.classList.toggle('picked', on);
      btn.setAttribute('aria-pressed', on);
      $('.pick-shelf', el).hidden = !on;
      label();
    };
    sel.onchange = () => { if (picked.has(e.id)) picked.set(e.id, sel.value); };
  });
  const finish = async () => {
    if (!state.settings.booksPicked) { await DB.saveSettings({ booksPicked: true }); state.settings.booksPicked = true; }
  };
  $('#skip').onclick = () => busy($('#skip'), async () => { await finish(); location.hash = !picked.size && state.worlds.length && firstTime ? '#/' : '#/books'; }, '…');
  if (go) {
    go.onclick = () => busy(go, async () => {
      let n = 0;
      for (const [id, shelf] of picked) {
        go.textContent = `Shelving ${++n} of ${picked.size}…`;
        await addFromLibrary(choices.find(x => x.id === id), shelf);
      }
      await finish();
      toast(picked.size === 1 ? 'It’s on your shelf' : `${picked.size} books on your shelves`);
      location.hash = '#/books';
    }, 'Shelving…');
  }
}

// "From the library" on Add a book: tap one to put it on a shelf.
function fillFromLibrary(defShelf) {
  bookLibrary().then(lib => {
    const box = $('#fromlib');
    if (!box) return;
    const choices = libChoices(lib);
    if (!choices.length) return;
    box.hidden = false;
    if ($('#findh')) $('#findh').textContent = 'Or find another';
    $('.lib-row', box).innerHTML = choices.map(e => `<button type="button" class="lib-book" data-lib="${esc(e.id)}" aria-label="${esc(e.title)}">${libCoverHtml(e)}<span class="lib-book-title">${esc(e.title)}</span></button>`).join('');
    paintLibCovers(box, choices);
    $$('.lib-book', box).forEach(el => {
      el.onclick = () => {
        const e = choices.find(x => x.id === el.dataset.lib);
        const shelfNow = ($('#shelf') && $('#shelf').value) || defShelf;
        openModal(`<div class="lib-detail"><div class="lib-detail-cover">${libCoverHtml(e)}</div>
            <div><h2>${esc(e.title)}</h2>${e.author ? `<p class="muted">${esc(e.author)}</p>` : ''}${e.series ? `<p class="muted small">${esc(e.series)}${e.seriesNo ? ` · Book ${esc(e.seriesNo)}` : ''}</p>` : ''}</div></div>
          ${e.blurb ? `<p class="lib-blurb">${esc(e.blurb)}</p>` : ''}
          <label class="field"><span class="field-label">Put it on</span><select id="lshelf">${shelvesOf().map(sh => `<option value="${esc(sh.id)}" ${sh.id === shelfNow ? 'selected' : ''}>${esc(sh.name)}</option>`).join('')}</select></label>
          <div class="actions"><span class="spacer"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="ladd">Add to my shelf</button></div>`,
        (root, close) => {
          paintLibCovers(root, [e]);
          $('#ladd', root).onclick = ev => busy(ev.target, async () => {
            const id = await addFromLibrary(e, $('#lshelf', root).value);
            close();
            location.hash = `#/b/${id}`;
          }, 'Adding…');
        });
      };
    });
  });
}

// ---------- reading goal & stats ----------
let statsYear = null;
function renderStats() {
  const now = new Date().getFullYear();
  const year = statsYear || now;
  const years = new Set([now]);
  state.books.forEach(b => readsOf(b).forEach(r => { if (r.end) years.add(Number(r.end.slice(0, 4))); }));
  const minY = Math.min(...years), maxY = Math.max(...years);
  const fin = finishesIn(year);
  const goal = goalFor(year);
  const pages = fin.reduce((n, f) => n + (Number(f.book.pages) || 0), 0);
  const rated = fin.filter(f => f.book.rating);
  const avg = rated.length ? (rated.reduce((n, f) => n + f.book.rating, 0) / rated.length).toFixed(1) : '–';
  const fmt = {
    physical: fin.filter(f => f.read.physical && !f.read.audio).length,
    audio: fin.filter(f => f.read.audio && !f.read.physical).length,
    both: fin.filter(f => f.read.audio && f.read.physical).length,
  };
  const months = Array(12).fill(0);
  fin.forEach(f => { months[Number(f.read.end.slice(5, 7)) - 1]++; });
  const maxM = Math.max(1, ...months);
  const pct = goal ? Math.min(100, Math.round((fin.length / goal) * 100)) : 0;
  let pace = '';
  if (goal && year === now && fin.length < goal) {
    const start = new Date(now, 0, 1), end = new Date(now + 1, 0, 1);
    const expected = goal * ((Date.now() - start) / (end - start));
    const diff = Math.round(fin.length - expected);
    pace = diff > 0 ? `${diff} book${diff === 1 ? '' : 's'} ahead of schedule` : diff < 0 ? `${-diff} book${diff === -1 ? '' : 's'} behind schedule` : 'Right on track';
  }
  const fmtTotal = Math.max(1, fmt.physical + fmt.audio + fmt.both);
  const tile = (label, value) => `<div class="card stat"><span class="stat-v">${value}</span><span class="stat-l">${label}</span></div>`;
  view.innerHTML = `<div class="page stats-page">
    <header class="w-head"><a class="back" href="#/books">‹ Books</a></header>
    <h1 class="w-title small-title">Reading stats</h1>
    <div class="year-nav"><button class="rw-arrow" id="py" aria-label="Previous year" ${year <= minY ? 'disabled' : ''}>‹</button><span class="year">${year}</span><button class="rw-arrow" id="ny" aria-label="Next year" ${year >= maxY ? 'disabled' : ''}>›</button></div>
    <div class="card goal-card">
      <span class="goal-big">${fin.length}${goal ? `<span class="goal-of"> of ${goal}</span>` : ''}</span>
      <span class="muted small">book${fin.length === 1 ? '' : 's'} finished in ${year}</span>
      ${goal ? `<div class="rw-bar"><span style="width:${pct}%"></span></div>` : ''}
      ${goal && fin.length >= goal ? '<p class="goal-done">Goal reached!</p>' : pace ? `<p class="muted small">${pace}</p>` : ''}
      <button class="btn small" id="setgoal">${goal ? 'Change goal' : `Set a ${year} goal`}</button>
    </div>
    <div class="stat-grid">
      ${tile('Pages read', pages.toLocaleString())}
      ${tile('Average rating', avg === '–' ? '–' : `${avg}<span class="stat-star" aria-hidden="true">★</span>`)}
      ${tile('Currently reading', state.books.filter(inReading).length)}
      ${tile('Want to read', state.books.filter(b => shelfOf(b) === 'want').length)}
    </div>
    <h2 class="sec-h">How I read</h2>
    <div class="card fmt-card">
      <div class="fmt-bar" role="img" aria-label="Physical ${fmt.physical}, audiobook ${fmt.audio}, both ${fmt.both}">
        ${[['physical', fmt.physical], ['audio', fmt.audio], ['both', fmt.both]].filter(([, n]) => n).map(([k, n]) => `<span class="fmt-${k}" style="flex:${n / fmtTotal}"></span>`).join('') || '<span class="fmt-none"></span>'}</div>
      <div class="fmt-keys"><span><i class="fmt-physical"></i>Physical ${fmt.physical}</span><span><i class="fmt-audio"></i>Audiobook ${fmt.audio}</span><span><i class="fmt-both"></i>Both ${fmt.both}</span></div>
    </div>
    <h2 class="sec-h">By month</h2>
    <div class="card months">${months.map((n, i) => `<div class="month"><span class="month-n">${n || ''}</span><span class="month-bar" style="height:${Math.round((n / maxM) * 100)}%"></span><span class="month-l">${'JFMAMJJASOND'[i]}</span></div>`).join('')}</div>
    <h2 class="sec-h">Finished in ${year}</h2>
    ${fin.length ? `<div class="fin-list">${fin.slice().reverse().map(f => `<a class="fin card" href="#/b/${esc(f.book.id)}">
        <span class="fin-cover">${coverHtml(f.book)}</span>
        <span class="fin-txt"><span class="fin-title">${esc(f.book.title)}</span>${f.book.author ? `<span class="muted small">${esc(f.book.author)}</span>` : ''}
        <span class="muted small">${esc(fmtDate(f.read.end))}${f.book.rating ? ` · ${f.book.rating} ★` : ''}${f.i > 0 ? ' · re-read' : ''}</span></span></a>`).join('')}</div>`
      : '<p class="empty">Nothing finished yet this year. The next one’s waiting.</p>'}
  </div>`;
  paintCovers(view);
  $('#py').onclick = () => { statsYear = year - 1; renderStats(); };
  $('#ny').onclick = () => { statsYear = year + 1; renderStats(); };
  $('#setgoal').onclick = () => formModal({
    title: `${year} reading goal`,
    values: { goal: goal || '' },
    fields: [{ key: 'goal', label: 'How many books?', type: 'number', placeholder: '30' }],
    onSave: async v => {
      const goals = { ...((state.settings || {}).goals || {}), [year]: Number(v.goal) || 0 };
      await DB.saveSettings({ goals });
      state.settings.goals = goals;
      renderStats();
    },
  });
}
