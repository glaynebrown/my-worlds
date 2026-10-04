/* Take the tour: a guided tour of each side, shown on a pretend phone.

   The pretend screens are made from the app's own pieces (door tiles, spines,
   tabs, the Watch card) filled with sample worlds and books, so they look just
   like the real thing. Nothing in them is real or saved: the screen is inert,
   and the only thing you can tap is the glowing spot the arrow points at
   (which moves the tour on), or Next / Back.

   - First time (settings.tourSeen not set, on any account that's been set
     up): both tours back to back, starting with the side you're on. The flip
     icon is the bridge from one side to the other.
   - After that: "Take the tour" in each side's gear menu replays that side. */

let tourOpen = false;

const TOUR_STEPS = {
  worlds: [
    { scene: 'worldsHome', target: '.tile', text: 'Tap a door to step inside a world. Hold one and drag to rearrange your doors.' },
    { scene: 'worldsHome', target: '.home-gear', text: 'Add new worlds, keep a wishlist of things to watch, and set your name here.' },
    { scene: 'world', target: '.w-tabs', text: 'Every world has a mood board, quotes, favorites and a watch tracker. My Canon and Fics are optional pages you can turn on or off in its settings.' },
    { scene: 'world', target: '.watch-btn', place: 'below', text: 'Finished an episode? Tap Watched it. The arrows step between episodes.' },
    { scene: 'world', target: '.note-btn', text: 'Jot notes about an episode here. They stay even when you rewatch.' },
    { scene: 'world', target: '.rw-eps', text: 'Tap an episode to bring it up. Tap it again to mark it watched.' },
    { scene: 'world', target: '.gear', text: 'Change a world’s look, turn pages on or off, or share it with family.' },
    { scene: 'worldsHome', target: '.side-flip', flip: true, text: 'Your books live on the other side. Tap here anytime to flip over.', bridge: 'Now tap here to flip over to your books.' },
  ],
  books: [
    { scene: 'booksHome', target: '.slot', text: 'Tap a book to open it. Hold one to move it, even onto another shelf.' },
    { scene: 'booksHome', target: '.case-add', text: 'Tap the + beside a shelf’s name to put a new book on it.' },
    { scene: 'booksHome', target: '.home-gear', text: 'Add books, edit your shelves and set a reading goal here.' },
    { scene: 'booksRibbon', target: '.slot:has(.ribbon)', text: 'Turn on bookmark ribbons in Edit shelves to see how far you are in each book you’re reading.' },
    { scene: 'booksGreen', target: '.plant-slot', text: 'Add trailing vines and potted plants in Edit shelves, then use Arrange greenery to move them wherever you like.' },
    { scene: 'booksFinish', target: '[data-when="today"]', gap: 118, text: 'Moving a book to Read asks when you finished it. Only dated finishes count toward your goal, and each one gets a little confetti.' },
    { scene: 'book', target: '.w-tabs', gap: 170, text: 'Every book has About, Notes, Quotes and a Board. Reviews, a Map, My Canon and Fics are optional pages you can turn on or off in its settings.' },
    { scene: 'bookNotes', target: '.bnote', text: 'Add notes as you read. Each one gets the date and your page.' },
    { scene: 'bookPhoto', target: '.scan-btn', text: 'No typing needed: take a picture of the page, then drag across the words you want for a quote or a note.' },
    { scene: 'bookReviews', target: '.icon-btn', text: 'Done reading? Copy your notes for Claude, then paste the review it writes back here.' },
    { scene: 'book', target: '.gear', text: 'Change a book’s look and spine, or start a buddy read and share it with your sister.' },
    { scene: 'booksHome', target: '.side-flip', flip: true, text: 'Your worlds are on the other side. Tap here anytime to flip over.', bridge: 'Now tap here to flip over to your worlds.' },
  ],
};

// ---------- the pretend screens ----------
const TOUR_DOORS = ['avatar', 'hp', 'lotr', 'twd'];
function tourWorld(theme) {
  const s = Themes.STARTERS.find(x => x.theme === theme) || { name: theme, theme };
  // Your own door photos if you have that world (or the library's), so it looks like yours.
  const mine = state.worlds.find(w => w.theme === theme);
  const wall = (state.wallpapers || {})[theme] || {};
  return {
    id: `tour-${theme}`, name: s.name, theme, track: s.track,
    cardPhoto: (mine && mine.cardPhoto) || wall.photo || null,
    cardInk: mine ? mine.cardInk : wall.ink, cardPos: mine ? mine.cardPos : wall.pos,
    cardShade: mine ? mine.cardShade : wall.shade,
  };
}
const TOUR_BOOK_TITLES = ['A Court of Thorns and Roses', 'A Court of Mist and Fury', 'A Court of Wings and Ruin', 'Fourth Wing', 'House of Earth and Blood'];
const tourBooks = () => TOUR_BOOK_TITLES.map((t, i) => ({ ...(BOOK_STARTERS.find(b => b.title === t) || { title: t }), id: `tour-b${i}` }));

const tourHomeHead = (side, sub) => `${homeGearMock()}<header class="lib-head">
    <span class="lib-crest crest-link side-flip"><span class="flip-front">${side === 'worlds' ? CREST : BOOK_CREST}</span></span>
    <h1 class="lib-title">My Worlds</h1>${sub}</header>`;
const homeGearMock = () => `<span class="home-gear">${GEAR}</span>`;
const tourGearMock = () => `<span class="gear">${GEAR}</span>`;

const TOUR_SCENES = {
  worldsHome(el) {
    const worlds = TOUR_DOORS.map(tourWorld);
    el.dataset.theme = 'library';
    el.innerHTML = `<div class="library">${tourHomeHead('worlds', '<p class="lib-sub">Pick a door and step inside — there’s no knowing where you might be swept off to.</p>')}
      <div class="shelf">${worlds.map(tileHtml).join('')}</div></div>`;
    $$('.tile[data-world]', el).forEach((t, i) => {
      const w = worlds[i];
      Themes.apply(t, w);
      if (w.cardPhoto) { t.classList.add('has-photo'); t.style.setProperty('--card-photo', `url('${w.cardPhoto.thumbUrl || w.cardPhoto.url}')`); }
      cardInk(t, w.cardInk);
      cardPos(t, w.cardPos);
      t.classList.toggle('no-shade', w.cardShade === false);
      t.removeAttribute('data-world'); // pretend: never mistaken for a real door
    });
  },

  world(el) {
    const w = tourWorld('avatar');
    Themes.apply(el, w);
    const colors = Themes.info(w).tabColors || {};
    const tabs = [['board', 'Board'], ['quotes', 'Quotes'], ['favs', 'Favorites'], ['canon', 'My Canon'], ['fics', 'Fics'], ['rewatch', 'Rewatch']];
    const seasons = w.track.seasons;
    const seen = i => i < 2;
    let n = 0;
    const grid = seasons.map((count, g) => `<div class="rw-season"><span class="rw-season-name">${esc(Themes.groupName(w.track, g))}</span><div class="rw-eps">${
      Array.from({ length: count }, (_, e) => { const i = n++; return `<span class="rw-ep${seen(i) ? ' seen' : ''}${i === 2 ? ' current' : ''}">${e + 1}</span>`; }).join('')}</div></div>`).join('');
    el.innerHTML = `<div class="page world">
      <header class="w-head"><span class="back">‹ Worlds</span>${tourGearMock()}</header>
      <div class="w-hero"><h1 class="w-title">${esc(w.name)}</h1><div class="w-flourish" aria-hidden="true"></div></div>
      <nav class="w-tabs">${tabs.map(([k, label]) => `<a class="tab-mock" style="${colors[k] ? `--tab:${colors[k]}` : ''}" ${k === 'rewatch' ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
      <section class="w-body" style="${colors.rewatch ? `--tab:${colors.rewatch}` : ''}">
        <div class="card rw-hero">
          <span class="rw-round">First watch</span>
          <div class="rw-nav"><span class="rw-arrow">‹</span>
            <div class="rw-now"><span class="rw-next">The Southern Air Temple</span><span class="muted small">Book One, Episode 3</span></div>
            <span class="rw-arrow">›</span></div>
          <div class="rw-actions"><span class="btn watch-btn">Watched it</span><span class="note-btn">${NOTE_ICON}</span></div>
          <div class="rw-bar"><span style="width:3%"></span></div>
          <span class="muted small">2 of 61 watched</span>
        </div>
        <div class="rw-grid">${grid}</div>
      </section></div>`;
  },

  // opts.ribbon: the book being read wears a bookmark ribbon; opts.green: draw greenery.
  booksHome(el, opts = {}) {
    const books = tourBooks();
    el.dataset.theme = 'library';
    const shelf = (id, name, list, row) => `<section class="case" data-shelf="tour-${id}"><header class="case-head"><div class="case-title"><h2 class="case-name">${name}</h2><span class="case-add">+</span></div></header>
      <div class="case-row">${row || shelfRowHtml(list)}</div></section>`;
    el.innerHTML = `<div class="library books-home">${tourHomeHead('books', `<span class="goal-line"><span>${new Date().getFullYear()} · 3 of 20 books</span><span class="goal-bar"><span style="width:15%"></span></span></span>`)}
      <div class="bookcase">${shelf('reading', 'Currently reading', [books[1]], opts.ribbon ? spineHtml(books[1], { ribbon: 62 }) : '')}${shelf('read', 'Read', [books[0], books[3], books[4]])}${shelf('want', 'Want to read', [books[2]])}</div></div>`;
    $$('.ser-plate', el).forEach(a => a.removeAttribute('href'));
    $$('[data-book]', el).forEach(x => x.removeAttribute('data-book'));
    fitSpines(el);
    fitPlates(el);
    if (opts.green) growGreenery(el, 'both');
  },
  booksRibbon(el) { TOUR_SCENES.booksHome(el, { ribbon: true }); },
  booksGreen(el) { TOUR_SCENES.booksHome(el, { green: true }); },
  // The bookcase with the "When did you finish it?" question up, and a little confetti.
  booksFinish(el) {
    TOUR_SCENES.booksHome(el);
    const flecks = ['#e2c27a', '#f6ecd4', '#8f1426', '#c9a35a', '#127a70'];
    const bits = Array.from({ length: 26 }, (_, i) => `<span class="tour-fleck" style="left:${(i * 37) % 100}%;top:${(i * 53) % 40 + 4}%;background:${flecks[i % 5]};transform:rotate(${(i * 47) % 180}deg)"></span>`).join('');
    el.insertAdjacentHTML('beforeend', `${bits}<div class="modal-bg tour-modal"><div class="modal small-modal">
      <h2 class="finish-h">When did you finish <em>A Court of Mist and Fury</em>?</h2>
      <div class="finish-btns"><span class="btn primary block" data-when="today">Today</span><span class="btn block">Pick a date</span><span class="btn block ghost">I don’t remember</span></div>
      <div class="actions"><span class="spacer"></span><span class="btn">Cancel</span></div></div></div>`);
  },
  // A book's Quotes page with the Add a quote form up.
  bookPhoto(el) {
    TOUR_SCENES.book(el, 'quotes');
    el.insertAdjacentHTML('beforeend', `<div class="modal-bg tour-modal"><div class="modal"><h2>Add a quote</h2>
      <span class="btn small scan-btn">${CAMERA_ICON}<span>From a photo</span></span>
      <label class="field"><span class="field-label">Quote</span><span class="tour-box tall"></span></label>
      <label class="field"><span class="field-label">Who said it (optional)</span><span class="tour-box"></span></label>
      <label class="field"><span class="field-label">Page (optional)</span><span class="tour-box"></span></label></div></div>`);
  },

  book(el, tab = 'about') {
    const b = tourBooks()[0];
    Themes.apply(el, b);
    const tabs = [['about', 'About'], ['notes', 'Notes'], ['quotes', 'Quotes'], ['reviews', 'Reviews'], ['board', 'Board']];
    let body = '';
    if (tab === 'about') {
      body = `<div class="card about"><div class="about-top"><span class="about-cover">${coverHtml(b, '', true)}</span>
          <div class="about-info"><span class="about-series">${esc(b.series)} · Book 1&nbsp;›</span>${starsHtml(4.5, 'tour-stars')}<p class="muted small">${b.pages} pages</p></div></div></div>`;
    } else if (tab === 'quotes') {
      body = `${addBtn('tour-addq', 'Add a quote')}<span class="quote card"><span class="quote-text own-marks">“To the stars who listen, and the dreams that are answered.”</span><span class="quote-by">— Rhysand to Feyre, p. 312</span></span>`;
    } else if (tab === 'notes') {
      const notes = [['Sep 28', 'p. 112', 'Tamlin’s masks!! And the Suriel scene was so creepy.'], ['Sep 30', 'p. 241', 'Calanmai… not sure how I feel about this.'], ['Oct 2', 'p. 356', 'Rhysand stealing every scene he’s in.']];
      body = `${addBtn('tour-addn', 'Add a note')}<div class="bnotes">${notes.map(([d, p, t]) => `<span class="bnote card"><span class="bnote-at">${d} · ${p}</span><span class="bnote-text">${t}</span></span>`).join('')}</div>`;
    } else {
      const card = (title, tag) => `<div class="card review"><div class="rv-head"><h3 class="rv-title">${title}</h3><span class="tag">${tag}</span></div>
          <p class="muted small">Not written yet.</p><div class="row-btns"><span class="btn small icon-btn">${COPY_ICON}</span><span class="btn small">Write it myself</span></div></div>`;
      body = card('My review', 'Spoilers') + card('Spoiler-free review', 'No spoilers');
    }
    el.innerHTML = `<div class="page world book-page">
      <header class="w-head"><span class="back">‹ Books</span>${tourGearMock()}</header>
      <div class="w-hero"><h1 class="w-title">${esc(b.title)}</h1><p class="w-sub b-author">${esc(b.author)}</p><div class="w-flourish" aria-hidden="true"></div></div>
      <nav class="w-tabs many">${tabs.map(([k, label]) => `<a class="tab-mock" ${k === tab ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
      <section class="w-body">${body}</section></div>`;
  },
  bookNotes(el) { TOUR_SCENES.book(el, 'notes'); },
  bookReviews(el) { TOUR_SCENES.book(el, 'reviews'); },
};

// ---------- the tour ----------
// sides: ['worlds'] or ['books'] (from the gear), or both (first time).
function startTour(sides, firstTime) {
  if (tourOpen) return;
  tourOpen = true;
  const steps = [];
  sides.forEach((side, si) => TOUR_STEPS[side].forEach(s => steps.push({ ...s, side, bridging: s.flip && si < sides.length - 1 })));
  let at = 0, shownScene = null;

  const root = document.createElement('div');
  root.className = 'tour';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'The tour');
  root.innerHTML = `<div class="tour-top"><span class="tour-name"></span>
      <button class="tour-x" type="button">${firstTime ? 'Skip tour' : 'Close'}</button></div>
    <div class="tour-stage">
      <div class="tour-phone"><div class="tour-screen" inert></div></div>
      <svg class="tour-arrow" aria-hidden="true"><defs><marker id="tour-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs><path class="tour-line" marker-end="url(#tour-head)"/></svg>
      <button class="tour-spot" type="button" aria-label="Next"></button>
      <div class="tour-bubble" aria-live="polite"></div>
    </div>
    <div class="tour-nav"><button class="tour-back" type="button" aria-label="Back">‹ Back</button>
      <div class="tour-dots" aria-hidden="true"></div>
      <button class="tour-next" type="button">Next ›</button></div>`;
  document.body.appendChild(root);
  document.body.classList.add('tour-on');
  const stage = $('.tour-stage', root), phone = $('.tour-phone', root), screen = $('.tour-screen', root);
  const bubble = $('.tour-bubble', root), spot = $('.tour-spot', root), arrow = $('.tour-arrow', root);
  const W = 390, H = 760; // the pretend phone, before it's shrunk to fit
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fitPhone() {
    const r = stage.getBoundingClientRect();
    const k = Math.min(1, (r.width - 8) / W, (r.height - 8) / H);
    phone.style.width = `${W * k}px`;
    phone.style.height = `${H * k}px`;
    screen.style.transform = `scale(${k})`;
  }

  function draw(flipIn) {
    const s = steps[at];
    $('.tour-name', root).textContent = `The tour · ${s.side === 'worlds' ? 'Worlds' : 'Books'}`;
    $('.tour-dots', root).innerHTML = steps.map((_, i) => `<span${i === at ? ' class="on"' : ''}></span>`).join('');
    $('.tour-back', root).disabled = at === 0;
    $('.tour-next', root).textContent = at === steps.length - 1 ? 'Done' : 'Next ›';
    if (shownScene !== s.scene) {
      screen.removeAttribute('style');
      screen.removeAttribute('data-theme');
      TOUR_SCENES[s.scene](screen);
      fitPhone(); // after: a world's look resets the screen's inline style
      screen.scrollTop = 0;
      shownScene = s.scene;
      if (flipIn && !calm) {
        const f = $('.side-flip', screen), lib = $('.library', screen);
        if (f) f.classList.add('flip-in');
        if (lib) lib.classList.add('page-in');
      }
    }
    bubble.textContent = s.bridging ? s.bridge : s.text;
    point();
  }

  // The glow goes around the step's target, the bubble above or below it, and the arrow between.
  function point() {
    const s = steps[at];
    const target = $(s.target, screen);
    if (!target) return;
    // Bring a target low on the screen up into view.
    const pr = phone.getBoundingClientRect();
    let tr = target.getBoundingClientRect();
    if (tr.bottom > pr.bottom - 20 || tr.top < pr.top) {
      const k = pr.height / H;
      screen.scrollTop += (tr.top - pr.top) / k - H * 0.45;
      tr = target.getBoundingClientRect();
    }
    const sr = stage.getBoundingClientRect();
    const box = {
      l: Math.max(tr.left, pr.left) - sr.left - 6, t: Math.max(tr.top, pr.top) - sr.top - 6,
      r: Math.min(tr.right, pr.right) - sr.left + 6, b: Math.min(tr.bottom, pr.bottom) - sr.top + 6,
    };
    Object.assign(spot.style, { left: `${box.l}px`, top: `${box.t}px`, width: `${box.r - box.l}px`, height: `${box.b - box.t}px` });

    const bw = Math.min(270, sr.width - 24);
    bubble.style.width = `${bw}px`;
    const bh = bubble.offsetHeight;
    const cx = (box.l + box.r) / 2;
    const below = s.place ? s.place === 'below' : (box.t + box.b) / 2 < sr.height / 2;
    const gap = s.gap || 54;
    let top = below ? box.b + gap : box.t - gap - bh;
    top = Math.max(4, Math.min(sr.height - bh - 4, top));
    const left = Math.max(12, Math.min(sr.width - bw - 12, cx - bw / 2));
    Object.assign(bubble.style, { left: `${left}px`, top: `${top}px` });

    // A gentle curve from the bubble's edge to the target.
    const sx = Math.max(left + 24, Math.min(left + bw - 24, cx + (cx < sr.width / 2 ? 30 : -30)));
    const sy = below ? top - 2 : top + bh + 2;
    const ex = cx, ey = below ? box.b + 4 : box.t - 4;
    const bend = (ex > sx ? -1 : 1) * Math.min(40, Math.abs(ey - sy) * 0.6 + 10);
    arrow.setAttribute('viewBox', `0 0 ${sr.width} ${sr.height}`);
    $('.tour-line', arrow).setAttribute('d', `M${sx} ${sy} Q${(sx + ex) / 2 + bend} ${(sy + ey) / 2} ${ex} ${ey}`);
  }

  function go(to) {
    if (to < 0) return;
    if (to >= steps.length) return close();
    const leaving = steps[at];
    // Moving on from a flip: the pretend icon flips like the real one.
    if (to === at + 1 && leaving.flip && !calm) {
      const f = $('.side-flip', screen), lib = $('.library', screen);
      if (f) f.classList.add('flip-out');
      if (lib) lib.classList.add('page-out');
      root.classList.add('tour-busy');
      setTimeout(() => { root.classList.remove('tour-busy'); at = to; draw(true); }, 200);
      return;
    }
    at = to;
    draw(false);
  }

  function close() {
    tourOpen = false;
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    root.remove();
    document.body.classList.remove('tour-on');
    if (state.settings && !state.settings.tourSeen) {
      state.settings.tourSeen = true;
      DB.saveSettings({ tourSeen: true }).catch(e => console.warn('Could not save tourSeen', e));
    }
  }

  const onResize = () => { shownScene = null; draw(false); };
  const onKey = e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(at + 1);
    else if (e.key === 'ArrowLeft') go(at - 1);
  };
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKey);
  $('.tour-x', root).onclick = close;
  spot.onclick = () => go(at + 1);
  $('.tour-next', root).onclick = () => go(at + 1);
  $('.tour-back', root).onclick = () => go(at - 1);
  // Swipe left / right on the phone, too.
  let sx0 = null;
  stage.addEventListener('touchstart', e => { sx0 = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (sx0 == null) return;
    const dx = e.changedTouches[0].clientX - sx0;
    sx0 = null;
    if (Math.abs(dx) > 50) go(at + (dx < 0 ? 1 : -1));
  });

  draw(false);
  // Fonts can arrive a moment later and move things: point again once they have.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (tourOpen) point(); });
  setTimeout(() => { if (tourOpen) point(); }, 400);
  $('.tour-next', root).focus();
}

// Shown once to everyone who's set up (both sides, starting with this one).
function maybeTour(side) {
  if (tourOpen || !state.settings || state.settings.tourSeen || !state.settings.seeded) return;
  if (modalOpen) return;
  startTour(side === 'books' ? ['books', 'worlds'] : ['worlds', 'books'], true);
}
