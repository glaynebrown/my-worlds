/* Accessories (the Watch side's home page): fairy lights.

   A garland under the title, and garlands strung between rows of doors (about
   every other row, at random), with softly twinkling bulbs. Worlds gear →
   Accessories turns them on (off to start) and opens Arrange, where the lights
   slide between rows (tap one for its dangling strands, or to remove it). Doors
   can still be dragged while arranging.

   Saved per person in settings.decor = { lights, garlands, lightSeed }.
   garlands: [{ gap, seed, drop }] (gap 0 = under the title, 1 = between the first
   and second row …; drop: dangling strands 0 none, 1 short, 2 long). null = still random. */

const decorOf = () => ({ lights: false, garlands: null, lightSeed: 0, ...((state.settings || {}).decor || {}) });
let decorArranging = false;
const BULBS = ['#ffe7a3', '#ffd27a', '#fff4d6', '#ffdca0'];

// Where things can go: the gaps garlands hang in, and each door's top edge (page coordinates within lib).
function decorSpots(lib) {
  const shelf = $('.shelf', lib), box = lib.getBoundingClientRect();
  const rel = el => { const r = el.getBoundingClientRect(); return { l: r.left - box.left, t: r.top - box.top, r: r.right - box.left, b: r.bottom - box.top, w: r.width }; };
  const doors = $$('.tile', shelf).map(el => ({ id: el.dataset.world, ...rel(el) }));
  const rows = [];
  doors.forEach(d => { const row = rows.find(r => Math.abs(r.t - d.t) < 4); if (row) row.doors.push(d); else rows.push({ t: d.t, b: d.b, doors: [d] }); });
  const s = rel(shelf);
  const gaps = [{ y: s.t - 18 }];
  for (let i = 1; i < rows.length; i++) gaps.push({ y: (rows[i - 1].b + rows[i].t) / 2 - 4 });
  return { doors, rows, gaps, left: s.l, right: s.r, cols: Math.max(1, rows[0] ? rows[0].doors.length : 1) };
}

const bulbSvg = (x, y, rnd) => `<g class="bulb" style="--d:${(rnd() * 3).toFixed(2)}s;--t:${(1.6 + rnd() * 2.2).toFixed(2)}s"><circle cx="${x.toFixed(1)}" cy="${(y + 4).toFixed(1)}" r="7" fill="url(#bulb-glow)"/>
  <rect x="${(x - 1.2).toFixed(1)}" y="${(y - 0.5).toFixed(1)}" width="2.4" height="2.4" rx=".5" fill="#6b5a3a"/><ellipse cx="${x.toFixed(1)}" cy="${(y + 4).toFixed(1)}" rx="2.3" ry="3" fill="${BULBS[Math.floor(rnd() * BULBS.length)]}"/></g>`;
// A strand hanging straight down from (x, y), swaying a little, with bulbs along it.
function strandSvg(x, y, len, rnd) {
  const s = (rnd() - 0.5) * 8;
  let bulbs = '';
  const n = Math.max(2, Math.round(len / 15));
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const bx = u * u * u * x + 3 * u * u * t * (x + s) + 3 * u * t * t * (x - s) + t * t * t * (x + s * 0.5);
    bulbs += bulbSvg(bx, y + len * t - 4, rnd);
  }
  return `<path d="M${x.toFixed(1)} ${y.toFixed(1)}C${(x + s).toFixed(1)} ${(y + len * 0.35).toFixed(1)} ${(x - s).toFixed(1)} ${(y + len * 0.7).toFixed(1)} ${(x + s * 0.5).toFixed(1)} ${(y + len).toFixed(1)}" fill="none" stroke="#3b3125" stroke-width="1"/>${bulbs}`;
}
const DROPS = [['0', 'None'], ['1', 'Short'], ['2', 'Long']];
// A sagging string of bulbs across the shelf, hung at each column edge.
// drop: strands dangling down from it (0 none, 1 short, 2 long, down between the doors).
function garlandSvg(sp, y, seed, drop = 0) {
  const rnd = seeded(`garland:${seed}`);
  const pts = [sp.left - 6];
  for (let c = 1; c < sp.cols; c++) pts.push(sp.left + ((sp.right - sp.left) * c) / sp.cols);
  pts.push(sp.right + 6);
  let wire = '', bulbs = '';
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], sag = 13 + rnd() * 7, mx = (a + b) / 2;
    wire += `M${a.toFixed(1)} ${y}Q${mx.toFixed(1)} ${(y + sag * 2).toFixed(1)} ${b.toFixed(1)} ${y}`;
    const n = Math.max(3, Math.round((b - a) / 19));
    for (let i = 1; i < n; i++) {
      const t = i / n, x = (1 - t) * (1 - t) * a + 2 * (1 - t) * t * mx + t * t * b, yy = y + 2 * (1 - t) * t * sag * 2;
      bulbs += bulbSvg(x, yy, rnd);
    }
  }
  // Dangling strands: one down the gap between each pair of doors, and now and then one from a swag.
  let strands = '';
  if (drop > 0) {
    const len = () => (drop === 2 ? 80 + rnd() * 70 : 34 + rnd() * 30);
    for (let k = 1; k < pts.length - 1; k++) strands += strandSvg(pts[k], y, len(), rnd);
    for (let k = 0; k < pts.length - 1; k++) {
      if (rnd() < 0.5) continue;
      const t = 0.3 + rnd() * 0.4, a = pts[k], b = pts[k + 1], mx = (a + b) / 2;
      strands += strandSvg((1 - t) * (1 - t) * a + 2 * (1 - t) * t * mx + t * t * b, y + 2 * (1 - t) * t * 30, len() * 0.6, rnd);
    }
  }
  return `<path d="${wire}" fill="none" stroke="#3b3125" stroke-width="1.1"/>${strands}${bulbs}`;
}

// Draws the lights onto the Worlds home page (after the doors are laid out).
// force: lights on, randomly hung, whatever the setting (the tour's pretend page).
function hangDecor(lib, force) {
  if (!lib) return;
  $$('.decor', lib).forEach(el => el.remove());
  const d = force ? { ...decorOf(), lights: true, garlands: null, lightSeed: 11 } : decorOf(), shelf = $('.shelf', lib);
  if (!shelf) return;
  shelf.classList.toggle('lit', !!d.lights);
  if (!d.lights) return;
  const sp = decorSpots(lib);
  if (!sp.doors.length) return;
  let svg = '';
  if (d.lights) {
    const rnd = seeded(`lights:${d.lightSeed}`);
    let list = d.garlands;
    if (!Array.isArray(list)) {
      const drop = () => { const some = rnd() < 0.65, long = rnd() < 0.5; return some ? (long ? 2 : 1) : 0; };
      list = [{ gap: 0, seed: Math.floor(rnd() * 1e9), drop: drop() }];
      for (let g = 1; g < sp.gaps.length; g++) { const on = rnd() < 0.5, seed = Math.floor(rnd() * 1e9), dr = drop(); if (on) list.push({ gap: g, seed, drop: dr }); }
    }
    lib._garlands = list;
    list.forEach((g, i) => {
      const gap = sp.gaps[Math.min(g.gap, sp.gaps.length - 1)];
      svg += `<g class="garland" data-i="${i}"><rect class="hit" x="${sp.left}" y="${gap.y - 10}" width="${sp.right - sp.left}" height="44" fill="transparent"/>${garlandSvg(sp, gap.y, g.seed, g.drop ?? 1)}</g>`;
    });
  }
  const box = lib.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'decor';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `<svg width="${box.width}" height="${lib.scrollHeight}" viewBox="0 0 ${box.width} ${lib.scrollHeight}"><defs>
    <radialGradient id="bulb-glow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".75"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
  </defs>${svg}</svg>`;
  lib.appendChild(layer);
}
let decorResize = null;
window.addEventListener('resize', () => {
  clearTimeout(decorResize);
  decorResize = setTimeout(() => { if (!parseHash()[0]) hangDecor($('.library', view)); }, 200);
});
window.addEventListener('hashchange', () => { if (parseHash()[0]) decorArranging = false; });

// ---------- the Accessories pop-up (Worlds gear) ----------
function accessoriesForm() {
  const d = decorOf();
  openModal(`<h2>Accessories</h2>
    <label class="switch ribbon-switch"><input type="checkbox" id="dlights" ${d.lights ? 'checked' : ''}><span class="track"></span><span>Fairy lights</span></label>
    <button type="button" class="btn small arrange-open" id="darr" ${d.lights ? '' : 'disabled'}>Arrange accessories</button>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn primary" id="dsave">Save</button></div>`, (root, close) => {
    $('#dlights', root).onchange = () => { $('#darr', root).disabled = !$('#dlights', root).checked; };
    const save = () => saveDecor({ lights: $('#dlights', root).checked });
    $('#dsave', root).onclick = () => { save(); close(); renderLibrary(); };
    $('#darr', root).onclick = () => { save(); decorArranging = true; close(); renderLibrary(); };
  }, 'small-modal');
}

function saveDecor(patch) {
  const decor = { ...decorOf(), ...patch };
  state.settings.decor = decor;
  DB.saveSettings({ decor }).catch(e => toast(friendlyError(e), true));
  return decor;
}
// Saves a change and redraws, keeping the rest as it is now (random bits get frozen in place).
function keepDecor(patch) {
  const lib = $('.library', view), d = decorOf();
  saveDecor({ garlands: d.lights ? (lib._garlands || []).map(g => ({ ...g })) : d.garlands, ...patch });
  hangDecor(lib);
}

// ---------- arranging ----------
const decorBar = () => {
  return `<div class="arrange-bar decor-bar"><div class="decor-bar-text"><span>Drag the lights and doors. Tap a string of lights to change or remove it.</span>
    <span class="arrange-btns"><span class="ab-group"><span class="ab-label">Lights:</span><button type="button" class="chip" data-da="shuffle-lights" aria-label="Shuffle lights">Shuffle</button><button type="button" class="chip ab-plus" data-da="add-lights" aria-label="Add lights">+</button></span></span></div><button class="btn primary" id="ddone">Done</button></div>`;
};

function lightMenu(i) {
  const lib = $('.library', view), cur = String(lib._garlands[i].drop ?? 1);
  openModal(`<h2>These lights</h2>
    <div class="field"><span class="field-label">Dangling strands</span><div class="chips bot-chips" id="ldrop">${DROPS.map(([k, l]) => `<button type="button" class="chip${k === cur ? ' on' : ''}" data-k="${k}">${l}</button>`).join('')}</div></div>
    <div class="actions"><button type="button" class="btn ghost danger-text" id="lrm">Remove</button><span class="spacer"></span><button type="button" class="btn primary" data-close>Done</button></div>`, (root, close) => {
    $('#ldrop', root).onclick = e => {
      const c = e.target.closest('[data-k]');
      if (!c) return;
      $$('#ldrop .chip', root).forEach(x => x.classList.toggle('on', x === c));
      const list = lib._garlands.map(x => ({ ...x }));
      list[i].drop = Number(c.dataset.k);
      keepDecor({ garlands: list });
    };
    $('#lrm', root).onclick = () => { const list = [...lib._garlands]; list.splice(i, 1); keepDecor({ garlands: list }); close(); };
  }, 'small-modal');
}
function wireDecorArrange(lib) {
  if (!decorArranging || !lib) return;
  $('#ddone').onclick = () => { decorArranging = false; renderLibrary(); toast('Accessories saved'); };
  $('.decor-bar').onclick = e => {
    const b = e.target.closest('[data-da]');
    if (!b) return;
    const seed = Math.floor(Math.random() * 1e9), sp = decorSpots(lib);
    if (b.dataset.da === 'shuffle-lights') { saveDecor({ garlands: null, lightSeed: seed }); hangDecor(lib); }
    if (b.dataset.da === 'add-lights') {
      const used = new Set((lib._garlands || []).map(g => g.gap));
      const gap = sp.gaps.findIndex((_, k) => !used.has(k));
      keepDecor({ garlands: [...(lib._garlands || []), { gap: gap < 0 ? 0 : gap, seed, drop: 1 }] });
      toast('Lights added. Drag them to another row if you like.');
    }
  };
  let drag = null;
  lib.onpointerdown = e => {
    const g = e.target.closest('.garland');
    if (!g || !e.target.closest('.hit')) return;
    e.preventDefault();
    drag = { g, x: e.clientX, y: e.clientY, moved: false, i: Number(g.dataset.i) };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, { once: true });
  };
  function move(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    lib.classList.add('decor-dragging');
    drag.g.setAttribute('transform', `translate(0 ${dy})`); // lights only move up and down, between rows
  }
  function up(e) {
    document.removeEventListener('pointermove', move);
    const d = drag;
    drag = null;
    if (!d) return;
    lib.classList.remove('decor-dragging');
    if (!d.moved) { lightMenu(d.i); return; }
    // Snaps to the nearest gap (under the title, or between two rows).
    const sp = decorSpots(lib);
    const gy = sp.gaps[Math.min(lib._garlands[d.i].gap, sp.gaps.length - 1)].y + (e.clientY - d.y);
    const gap = sp.gaps.reduce((best, g, k) => (Math.abs(g.y - gy) < Math.abs(sp.gaps[best].y - gy) ? k : best), 0);
    const list = lib._garlands.map(x => ({ ...x }));
    list[d.i].gap = gap;
    keepDecor({ garlands: list });
  }
}
