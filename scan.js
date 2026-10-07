/* From a photo (books: Quote and Note forms).

   Take a picture of the page (or pick one), and the phone reads the words
   itself with Tesseract (loaded from a CDN the first time it's used, then
   cached). The photo shows with each word faintly outlined; drag across the
   words you want (or tap one, then another) and "Use this" drops them into
   the form, ready to fix up. A page number spotted at the top or bottom of
   the page fills in Page, but only if Page is still empty.
   Nothing is saved or uploaded: the photo stays on the phone and is gone
   when the reader closes. */

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const CAMERA_ICON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.4l1.6-2.2h7l1.6 2.2h2.4A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.6"/></svg>';

let tesseractP = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!tesseractP) {
    tesseractP = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESSERACT_URL;
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => { tesseractP = null; reject(new Error('Couldn’t load the page reader. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
  }
  return tesseractP;
}

// The button, just above the form's big text box.
// opts.page: also fill the Page box from the photo (off for audiobook notes).
function addScanButton(root, opts = {}) {
  const box = $('textarea[name="text"]', root);
  if (!box) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn small scan-btn';
  btn.innerHTML = `${CAMERA_ICON}<span>From a photo</span>`;
  box.closest('.field').before(btn);
  const pick = document.createElement('input');
  pick.type = 'file';
  pick.accept = 'image/*';
  pick.hidden = true;
  btn.after(pick);
  btn.onclick = () => { pick.value = ''; pick.click(); };
  // Start fetching the reader while they take the picture.
  btn.addEventListener('pointerdown', () => { loadTesseract().catch(() => {}); }, { once: true });
  pick.onchange = async () => {
    const file = pick.files[0];
    if (!file) return;
    const got = await scanPage(file, opts);
    if (!got) return;
    if (got.text) {
      box.value = box.value.trim() ? `${box.value.trimEnd()}\n${got.text}` : got.text;
      box.dispatchEvent(new Event('input'));
    }
    const pageIn = $('input[name="page"]', root);
    if (opts.page && got.page && pageIn && !pageIn.value.trim()) pageIn.value = got.page;
  };
}

// A phone photo, shrunk to a size the reader handles quickly (and turned the right way up).
async function pageImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

// Reads the page, lets you pick the words. Resolves { text, page } or null (cancelled).
function scanPage(file, opts = {}) {
  return new Promise(resolve => {
    const layer = document.createElement('div');
    layer.className = 'scan';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', 'Pick the words');
    layer.innerHTML = `<div class="scan-top"><button type="button" class="scan-cancel">Cancel</button>
        <span class="scan-title">Pick the words</span><button type="button" class="scan-all" disabled>All</button></div>
      <div class="scan-stage"><div class="scan-page"><canvas></canvas><div class="scan-words"></div></div>
        <div class="scan-status">Reading the page…</div></div>
      <p class="scan-hint">Drag across the words you want, or tap the first word and then the last.</p>
      <div class="scan-bottom"><span class="scan-picked"></span><button type="button" class="btn primary scan-use" disabled>Use this</button></div>`;
    document.body.appendChild(layer);
    const status = $('.scan-status', layer), wordsEl = $('.scan-words', layer), pageEl = $('.scan-page', layer);
    const useBtn = $('.scan-use', layer), allBtn = $('.scan-all', layer), pickedEl = $('.scan-picked', layer);
    let words = [], from = -1, to = -1, page = null, worker = null, done = false;

    const finish = result => {
      if (done) return;
      done = true;
      if (worker) worker.terminate().catch(() => {});
      layer.remove();
      document.removeEventListener('keydown', onKey, true);
      resolve(result);
    };
    // Escape closes only the reader, not the form underneath.
    const onKey = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); finish(null); } };
    document.addEventListener('keydown', onKey, true);
    $('.scan-cancel', layer).onclick = () => finish(null);

    const range = () => (from < 0 ? [] : words.slice(Math.min(from, to), Math.max(from, to) + 1));
    function paint() {
      const lo = Math.min(from, to), hi = Math.max(from, to);
      words.forEach((w, i) => w.el.classList.toggle('on', from >= 0 && i >= lo && i <= hi));
      const n = range().length;
      useBtn.disabled = !n;
      pickedEl.textContent = n ? `${n} word${n === 1 ? '' : 's'}` : '';
    }
    // The words, joined back into sentences: a hyphen at the end of a line joins the word
    // back up, and a new paragraph starts a new line.
    function pickedText() {
      let out = '';
      range().forEach((w, i, list) => {
        out += w.text;
        if (i === list.length - 1) return;
        if (w.paraEnd) out += '\n';
        else if (w.lineEnd && /[A-Za-z]-$/.test(w.text)) out = out.slice(0, -1);
        else out += ' ';
      });
      return out.replace(/[ \t]+\n/g, '\n').trim();
    }
    useBtn.onclick = () => finish({ text: pickedText(), page: opts.page ? page : null });
    allBtn.onclick = () => { from = 0; to = words.length - 1; paint(); };

    // Pointer: press on a word and drag; or tap one word, then tap another to stretch to it.
    const wordAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const hit = el && el.closest('.scan-word');
      if (hit) return +hit.dataset.i;
      // Between words: the nearest one.
      const r = wordsEl.getBoundingClientRect();
      let best = -1, bestD = Infinity;
      words.forEach((w, i) => {
        const b = w.el.getBoundingClientRect();
        const dx = Math.max(b.left - x, 0, x - b.right), dy = Math.max(b.top - y, 0, y - b.bottom);
        const d = dx * dx + dy * dy * 4;
        if (d < bestD) { bestD = d; best = i; }
      });
      return x >= r.left - 20 && x <= r.right + 20 ? best : -1;
    };
    let dragging = false, moved = false, tapAnchor = null;
    wordsEl.addEventListener('pointerdown', e => {
      if (!words.length) return;
      const i = wordAt(e.clientX, e.clientY);
      if (i < 0) return;
      e.preventDefault();
      wordsEl.setPointerCapture(e.pointerId);
      dragging = true; moved = false;
      if (tapAnchor != null && from >= 0 && from === to) { to = i; tapAnchor = null; } // second tap: stretch
      else { from = to = i; }
      paint();
    });
    wordsEl.addEventListener('pointermove', e => {
      if (!dragging) return;
      const i = wordAt(e.clientX, e.clientY);
      if (i >= 0 && i !== to) { to = i; moved = true; paint(); }
    });
    const up = () => {
      if (!dragging) return;
      dragging = false;
      tapAnchor = !moved && from === to ? from : null;
    };
    wordsEl.addEventListener('pointerup', up);
    wordsEl.addEventListener('pointercancel', up);

    (async () => {
      try {
        const canvas = await pageImage(file);
        const shown = $('canvas', layer);
        shown.width = canvas.width; shown.height = canvas.height;
        shown.getContext('2d').drawImage(canvas, 0, 0);
        pageEl.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
        const T = await loadTesseract();
        if (done) return;
        worker = await T.createWorker('eng', 1, {
          logger: m => { if (m.status === 'recognizing text') status.textContent = `Reading the page… ${Math.round(m.progress * 100)}%`; },
        });
        if (done) return;
        const { data } = await worker.recognize(canvas);
        if (done) return;
        // Every word in reading order, remembering where lines and paragraphs end.
        (data.paragraphs || []).forEach(p => p.lines.forEach((l, li) => l.words.forEach((w, wi) => {
          const t = w.text.trim();
          if (!t || w.confidence < 20) return;
          words.push({ text: t, box: w.bbox, conf: w.confidence, lineEnd: wi === l.words.length - 1, paraEnd: wi === l.words.length - 1 && li === p.lines.length - 1 });
        })));
        if (!words.length) { status.textContent = 'Couldn’t find any words. Try a closer, brighter photo.'; return; }
        // A page number: a plain number on its own at the very top or bottom of the text.
        const top = Math.min(...words.map(w => w.box.y0)), bottom = Math.max(...words.map(w => w.box.y1));
        const edge = (bottom - top) * 0.1;
        const nums = words.filter(w => /^\d{1,4}$/.test(w.text) && w.conf > 60 && (w.box.y0 <= top + edge || w.box.y1 >= bottom - edge));
        if (nums.length) page = nums[0].text.replace(/^0+/, '') || null;
        // Leave the page number out of the words you can pick.
        if (nums.length) words = words.filter(w => !nums.includes(w));
        const W = canvas.width, H = canvas.height;
        wordsEl.innerHTML = words.map((w, i) => `<span class="scan-word" data-i="${i}" style="left:${(w.box.x0 / W) * 100}%;top:${(w.box.y0 / H) * 100}%;width:${((w.box.x1 - w.box.x0) / W) * 100}%;height:${((w.box.y1 - w.box.y0) / H) * 100}%"></span>`).join('');
        words.forEach((w, i) => { w.el = wordsEl.children[i]; });
        status.hidden = true;
        allBtn.disabled = false;
        if (page && opts.page) pickedEl.textContent = `Page ${page} found`;
      } catch (e) {
        console.error(e);
        status.textContent = (e && e.message && /connection|load/i.test(e.message)) ? e.message : 'Couldn’t read that photo. Try another one.';
      }
    })();
  });
}

// ---------- Scan a book (Add a book → Scan) ----------
// In the iPhone app: Apple's live scanner (BookScannerPlugin), fully automatic:
// it catches the barcode on the back, or reads the cover or spine once it's
// held steady. On the website (or an older phone): a photo. A barcode in it is read first; if there isn't one, the biggest words
// (the title and author on a cover or spine) are read and searched instead.
// Resolves { isbn }, { text, parts (its lines) } or null. The photo stays on the phone.
const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
let zxingP = null;
function loadZxing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxingP) {
    zxingP = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = ZXING_URL;
      s.onload = () => resolve(window.ZXing);
      s.onerror = () => { zxingP = null; reject(new Error('Couldn’t load the scanner. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
  }
  return zxingP;
}
const nativeScanner = () => (typeof isNativeApp !== 'undefined' && isNativeApp ? window.Capacitor.registerPlugin('BookScanner') : null);

// Opens the phone's camera or photo picker. Must start from a tap.
function pickBookPhoto() {
  return new Promise(resolve => {
    const pick = document.createElement('input');
    pick.type = 'file';
    pick.accept = 'image/*';
    pick.onchange = () => resolve(pick.files[0] || null);
    pick.addEventListener('cancel', () => resolve(null));
    pick.click();
  });
}
// The photo turned by deg (and scaled by k).
const turned = (canvas, deg, k = 1) => {
  const c = document.createElement('canvas'), side = deg % 180 !== 0;
  const w = Math.round(canvas.width * k), h = Math.round(canvas.height * k);
  c.width = side ? h : w;
  c.height = side ? w : h;
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  g.rotate((deg * Math.PI) / 180);
  g.drawImage(canvas, -w / 2, -h / 2, w, h);
  return c;
};
async function readBarcode(canvas) {
  const Z = await loadZxing();
  const hints = new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]], [Z.DecodeHintType.TRY_HARDER, true]]);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  for (const c of [canvas, turned(canvas, 90)]) {
    try { return reader.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(c)))).getText(); } catch {}
  }
  return null;
}
// The title and author: the biggest, clearest lines of text (marketing lines
// like "New York Times bestselling author" skipped). lines: { text, h, y, conf },
// h and y as a share of the photo's height, conf 0–1.
const BLURB_LINE = /(best ?-?sell|usa ?today|new york times|sunday times|times best|international|#\s?1|author of|a novel|now a (major|netflix)|isbn|www\.|\.com)/i;
function titleFromLines(lines) {
  const ok = lines.map(l => ({ ...l, text: l.text.replace(/[^\p{L}\p{N}'’&:,. -]/gu, ' ').replace(/\s+/g, ' ').trim() }))
    .filter(l => l.conf >= 0.5 && (l.text.match(/\p{L}/gu) || []).length >= 2 && !BLURB_LINE.test(l.text));
  const clean = t => t.replace(/[-—–.:]/g, ' ').replace(/\s+/g, ' ').trim();
  const ranked = [...ok].sort((a, b) => b.h * b.conf - a.h * a.conf);
  // The three most prominent lines (a series name, the title under it, the author) to search with…
  const parts = ranked.slice(0, 3).sort((a, b) => a.y - b.y).map(l => clean(l.text)).filter(Boolean);
  // …and every clear line that isn't tiny print, to pick the right match.
  const big = ranked.length ? ranked[0].h : 0;
  const words = ranked.filter(l => l.h >= big * 0.2).map(l => clean(l.text)).join(' ');
  return { text: parts.join(' ').split(' ').slice(0, 12).join(' '), parts, words };
}
async function readCoverWords(canvas) {
  // The iPhone app: Apple's own text recognition (BookScannerPlugin.readText).
  const native = nativeScanner();
  if (native) {
    const image = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    const { lines = [] } = await native.readText({ image });
    return titleFromLines(lines);
  }
  // Elsewhere: Tesseract, upright and turned both ways (a spine reads sideways).
  const big = Math.max(canvas.width, canvas.height) < 1600 ? turned(canvas, 0, 1600 / Math.max(canvas.width, canvas.height)) : canvas;
  const T = await loadTesseract();
  const worker = await T.createWorker('eng', 1);
  try {
    let best = { score: 0, lines: [] };
    for (const deg of [0, 90, 270]) {
      const c = deg ? turned(big, deg) : big;
      const { data } = await worker.recognize(c);
      const lines = (data.lines || []).map(l => ({ text: l.text, h: (l.bbox.y1 - l.bbox.y0) / c.height, y: l.bbox.y0 / c.height, conf: l.confidence / 100 }));
      const score = lines.reduce((n, l) => n + l.text.trim().length * l.conf * l.conf, 0);
      if (score > best.score) best = { score, lines };
    }
    return titleFromLines(best.lines);
  } finally { worker.terminate().catch(() => {}); }
}
async function readBookPhoto(file, status) {
  const canvas = await pageImage(file);
  status('Looking for a barcode…');
  const code = await readBarcode(canvas).catch(() => null);
  if (code) return { isbn: code };
  status('Reading the cover…');
  const words = await readCoverWords(canvas);
  return words.text ? words : { none: true };
}
// status(text): shows what it's doing. Web: opens the camera straight away (called from a tap).
async function scanBook(status = () => {}) {
  const native = nativeScanner();
  let file = null;
  if (native) {
    // One camera screen, fully automatic: a barcode, or the cover or spine read once it's steady.
    const got = await native.scan();
    if (got.isbn) return { isbn: got.isbn };
    if (got.lines) { const words = titleFromLines(got.lines); return words.text ? words : { none: true }; }
    if (got.mode !== 'photo') return null;
    // A phone too old to scan live: a photo instead.
    // The camera has to open from a tap, so ask for one.
    let taking = false;
    file = await new Promise(resolve => openModal(`<h2>Photo of the book</h2>
        <p class="muted">Take a photo of the front cover or the spine, close up and straight on.</p>
        <div class="actions"><button type="button" class="btn" data-close>Cancel</button><span class="spacer"></span><button type="button" class="btn primary" id="bpshot">${CAMERA_ICON} Take the photo</button></div>`,
      (root, close) => { $('#bpshot', root).onclick = () => { taking = true; const shot = pickBookPhoto(); close(); shot.then(resolve); }; }, 'small-modal', () => { if (!taking) resolve(null); }));
  } else file = await pickBookPhoto();
  if (!file) return null;
  return readBookPhoto(file, status);
}
