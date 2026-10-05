/* Backup & restore (gear menu on both sides → "Backup & restore").

   Download my data: one .zip saved to the phone (never to Firebase):
     backup.json   everything of yours: worlds, books, every item, settings
     My Worlds.html a readable copy (notes, quotes, reviews, …) to open anywhere
     photos/…      your photos, full size (optional)
   Restore from backup: picks that .zip (or the .json) and puts back only what
   isn't in the app any more (same ids, so nothing doubles). Photos come back
   from the zip, within the photo limit. Shared worlds come back as your own. */

// ---------- a tiny .zip writer/reader (photos are JPEGs already, so no squeezing) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
async function makeZip(files) { // files: [{ name, data: Uint8Array | Blob | string }]
  const enc = new TextEncoder(), parts = [], central = [];
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  let offset = 0;
  for (const f of files) {
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data instanceof Blob ? new Uint8Array(await f.data.arrayBuffer()) : f.data;
    const name = enc.encode(f.name), crc = crc32(data);
    const head = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]]
      .forEach(([o, v, n]) => (n === 4 ? head.setUint32(o, v, true) : head.setUint16(o, v, true)));
    parts.push(head, name, data);
    const cd = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [42, offset, 4]]
      .forEach(([o, v, n]) => (n === 4 ? cd.setUint32(o, v, true) : cd.setUint16(o, v, true)));
    central.push(cd, name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((n, p) => n + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [8, files.length, 2], [10, files.length, 2], [12, cdSize, 4], [16, offset, 4]]
    .forEach(([o, v, n]) => (n === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true)));
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
// -> Map(name -> Blob). Reads stored files, and squeezed ones where the phone can.
async function readZip(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(buf.buffer);
  let e = buf.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('That file isn’t a My Worlds backup.');
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const out = new Map(), dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), at = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    const start = at + 30 + dv.getUint16(at + 26, true) + dv.getUint16(at + 28, true);
    const raw = new Blob([buf.subarray(start, start + size)]);
    if (method === 0) out.set(name, raw);
    else if (method === 8 && typeof DecompressionStream !== 'undefined') out.set(name, await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob());
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

// ---------- what's yours ----------
const isPhotoObj = v => v && typeof v === 'object' && typeof v.url === 'string' && 'path' in v;
function photosIn(v, out = []) {
  if (!v || typeof v !== 'object') return out;
  if (isPhotoObj(v)) { out.push(v); return out; }
  Object.values(v).forEach(x => photosIn(x, out));
  return out;
}
const photoFile = p => `photos/${String(p.path || p.url).replace(/^users\/[^/]+\//, '').replace(/[^\w.-]+/g, '_')}${/\.jpe?g$/i.test(p.path || '') ? '' : '.jpg'}`;
const plainBook = b => { const { _book, name, ...rest } = b; return rest; };
function backupData() {
  return {
    app: 'my-worlds', version: 1, exportedAt: new Date().toISOString(),
    settings: state.settings || {},
    worlds: state.worlds, books: state.books.map(plainBook), items: state.items,
  };
}

// ---------- the readable copy ----------
const stars = r => (r ? '★'.repeat(Math.floor(r)) + (r % 1 ? '½' : '') : '');
function readableHtml(data, files) {
  const e = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const img = p => (p && files.has(photoFile(p)) ? `<img src="${e(photoFile(p))}" alt="">` : '');
  const of = (id, kind) => data.items.filter(i => i.world === id && i.kind === kind).sort((a, b) => (a.order ?? a.t ?? 0) - (b.order ?? b.t ?? 0));
  const list = (title, rows) => (rows.length ? `<h3>${title}</h3>${rows.join('')}` : '');
  const quote = q => `<blockquote>${e(q.text)}<cite>${e([q.who && q.to ? `${q.who} to ${q.to}` : q.who || q.to, q.where, q.page ? `p. ${q.page}` : ''].filter(Boolean).join(' · '))}</cite></blockquote>`;
  // Shared worlds: everyone's things, with names.
  const sharedOf = (w, kind) => {
    const v = w.sharedId && state.shared && state.shared[w.sharedId];
    return v ? (v.items || []).filter(i => i.kind === kind).map(i => ({ ...i, text: i.text, who: i.who })) : [];
  };
  const sharedNotes = w => { const v = w.sharedId && state.shared && state.shared[w.sharedId]; return v ? v.notes || [] : []; };

  const worldHtml = w => {
    const all = k => [...of(w.id, k), ...sharedOf(w, k)];
    const notes = [...of(w.id, 'epnote').map(n => ({ ...n, byName: 'Me' })), ...sharedNotes(w)];
    return `<section><h2>${e(plainName(w))}</h2>
      ${w.ending ? `<h3>My ending</h3><p class="pre">${e(w.ending)}</p>` : ''}
      ${list('Board', all('pin').map(p => `<figure>${img(p.photo)}${p.caption ? `<figcaption>${e(p.caption)}</figcaption>` : ''}</figure>`))}
      ${list('Quotes', all('quote').map(quote))}
      ${list('Favorites', all('fav').map(f => `<div class="row">${img(f.photo)}<div><b>${e(f.name)}</b>${f.quote ? `<p><i>${e(f.quote)}</i></p>` : ''}${f.note ? `<p class="pre">${e(f.note)}</p>` : ''}</div></div>`))}
      ${list('Ships', all('ship').map(s => `<p><b>${e(s.name)}</b>${s.note ? ` · ${e(s.note)}` : ''}</p>`))}
      ${list('Headcanons', all('headcanon').map(h => `<p class="pre">${e(h.text)}</p>`))}
      ${list('Fics', all('fic').map(f => `<p><a href="${e(f.url)}">${e(f.title || f.url)}</a>${f.author ? ` by ${e(f.author)}` : ''}${f.note ? ` · ${e(f.note)}` : ''}</p>`))}
      ${list('Watch notes', notes.map(n => `<p><b>${e(n.step)}</b>${n.byName && n.byName !== 'Me' ? ` (${e(n.byName)})` : ''}<br><span class="pre">${e(n.text)}</span></p>`))}
    </section>`;
  };
  const bookHtml = b => {
    const reads = (b.reads || []).filter(r => r.start || r.end).map(r => `${r.start || '?'} → ${r.end || '…'}`).join(', ');
    const notes = [...of(b.id, 'bnote'), ...sharedOf(b, 'bnote')].sort((x, y) => (x.date || '').localeCompare(y.date || ''));
    return `<section><div class="row">${img(b.cover)}<div><h2>${e(b.title)}</h2><p>${e([b.author, b.series && `${b.series}${b.seriesNo ? ` #${b.seriesNo}` : ''}`].filter(Boolean).join(' · '))}</p>
      <p>${e(stars(b.rating))}${reads ? ` · ${e(reads)}` : ''}</p></div></div>
      ${b.review ? `<h3>Review</h3><p class="pre">${e(b.review)}</p>` : ''}
      ${b.reviewSafe ? `<h3>Spoiler-free review</h3><p class="pre">${e(b.reviewSafe)}</p>` : ''}
      ${list('Reading notes', notes.map(n => `<p><b>${e([n.date, n.page ? `p. ${n.page}` : n.chapter ? `ch. ${n.chapter}` : ''].filter(Boolean).join(' · '))}</b>${n.byName && n.by !== DB.myUid() ? ` (${e(n.byName)})` : ''}<br><span class="pre">${e(n.text)}</span></p>`))}
      ${list('Quotes', [...of(b.id, 'quote'), ...sharedOf(b, 'quote')].map(quote))}
    </section>`;
  };
  const wishes = data.items.filter(i => i.kind === 'wish');
  const when = new Date(data.exportedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>My Worlds · ${e(when)}</title>
<style>body{font:16px/1.55 Georgia,serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#2a2420;background:#fbf8f2}h1{font-weight:normal}h2{margin:0 0 4px}h3{margin:18px 0 6px;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:#8a7a68}
section{background:#fff;border:1px solid #e8e0d2;border-radius:12px;padding:18px;margin:18px 0}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #d8c9b0}cite{display:block;font-size:.85rem;color:#8a7a68;font-style:normal}
img{max-width:100%;border-radius:8px}.row{display:flex;gap:14px;align-items:flex-start}.row img{width:90px;flex:none}figure{margin:10px 0}figcaption{font-size:.9rem;color:#6a5e50}.pre{white-space:pre-line}.muted{color:#8a7a68}</style></head><body>
<h1>My Worlds</h1><p class="muted">Saved ${e(when)}</p>
${data.worlds.length ? `<h1>Worlds</h1>${[...data.worlds].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(worldHtml).join('')}` : ''}
${data.books.length ? `<h1>Books</h1>${[...data.books].sort((a, b) => (a.title || '').localeCompare(b.title || '')).map(bookHtml).join('')}` : ''}
${wishes.length ? `<h1>Wishlist</h1><section>${wishes.map(w => `<p><b>${e(w.text)}</b>${w.note ? ` · ${e(w.note)}` : ''}</p>`).join('')}</section>` : ''}
</body></html>`;
}

// ---------- saving the file on the phone ----------
async function saveFile(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (err) { if (err.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

// ---------- the pop-up ----------
function backupMenu() {
  const n = new Set(photosIn([state.worlds, state.books, state.items]).map(p => p.path || p.url)).size;
  openModal(`<h2>Backup &amp; restore</h2>
    <p class="muted small">A backup is one file saved on your phone (or iCloud Drive), with a copy you can read anywhere.</p>
    <label class="check"><input type="checkbox" id="bk-photos" ${n ? '' : 'disabled'}><span>Include photos${n ? ` (${n})` : ''}</span></label>
    <p class="muted small" id="bk-size">${n ? 'Photos make the file bigger (about 0.4 MB each).' : ''}</p>
    <p class="error" id="bk-err" hidden></p>
    <div class="row-btns"><button type="button" class="btn primary" id="bk-go">Download my data</button></div>
    <hr class="menu-rule">
    <p class="muted small">Restoring puts back anything from a backup that isn’t in the app now. Nothing you have is changed or doubled.</p>
    <div class="row-btns"><button type="button" class="btn" id="bk-restore">Restore from backup…</button></div>
    <input type="file" id="bk-file" accept=".zip,.json,application/zip,application/json" hidden>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" data-close>Close</button></div>`, (root, close) => {
    const err = $('#bk-err', root);
    const fail = m => { err.textContent = m; err.hidden = false; };
    $('#bk-go', root).onclick = () => busy($('#bk-go', root), async () => {
      err.hidden = true;
      await downloadBackup($('#bk-photos', root).checked, msg => { $('#bk-go', root).textContent = msg; });
    }, 'Getting it ready…');
    $('#bk-restore', root).onclick = () => $('#bk-file', root).click();
    $('#bk-file', root).onchange = async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try { const plan = await readBackup(f); close(); confirmRestore(plan); } catch (x) { fail(x.message || String(x)); }
    };
  }, 'small-modal');
}

async function downloadBackup(withPhotos, progress) {
  const data = backupData(), files = [], have = new Set();
  let missed = 0;
  if (withPhotos) {
    if (!navigator.onLine) throw new Error('You’re offline. Photos need a connection to download; try again with signal, or leave photos off.');
    const photos = [...new Map(photosIn([data.worlds, data.books, data.items]).map(p => [photoFile(p), p])).entries()];
    for (let k = 0; k < photos.length; k++) {
      const [name, p] = photos[k];
      progress(`Saving photos… ${k + 1} of ${photos.length}`);
      try {
        const r = await fetch(p.url);
        if (!r.ok) throw new Error();
        files.push({ name, data: await r.blob() });
        have.add(name);
      } catch { missed++; }
    }
  }
  progress('Packing it up…');
  const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const zip = await makeZip([
    { name: 'backup.json', data: JSON.stringify(data) },
    { name: 'My Worlds.html', data: readableHtml(data, have) },
    ...files,
  ]);
  await saveFile(zip, `My Worlds backup ${day}.zip`);
  toast(missed ? `Backup saved. ${missed} photo${missed === 1 ? '' : 's'} couldn’t be included.` : 'Backup saved');
}

// ---------- restoring ----------
async function readBackup(file) {
  let data, files = new Map();
  if (/\.json$/i.test(file.name) || file.type === 'application/json') data = JSON.parse(await file.text());
  else {
    files = await readZip(file);
    const json = files.get('backup.json');
    if (!json) throw new Error('That file isn’t a My Worlds backup.');
    data = JSON.parse(await json.text());
  }
  if (!data || data.app !== 'my-worlds') throw new Error('That file isn’t a My Worlds backup.');
  const hasW = new Set(state.worlds.map(w => w.id)), hasB = new Set(state.books.map(b => b.id)), hasI = new Set(state.items.map(i => i.id));
  const worlds = (data.worlds || []).filter(w => !hasW.has(w.id));
  const books = (data.books || []).filter(b => !hasB.has(b.id));
  const homes = new Set([...hasW, ...hasB, ...worlds.map(w => w.id), ...books.map(b => b.id)]);
  const items = (data.items || []).filter(i => !hasI.has(i.id) && (!i.world || homes.has(i.world)));
  return { data, files, worlds, books, items };
}

function confirmRestore(plan) {
  const { worlds, books, items, files, data } = plan;
  const when = new Date(data.exportedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (!worlds.length && !books.length && !items.length) {
    return toast(`Nothing to restore: everything in the backup from ${when} is already in the app.`);
  }
  const photos = photosIn([worlds, books, items]).filter(p => files.has(photoFile(p))).length;
  const parts = [worlds.length && count(worlds.length, 'world', 'worlds'), books.length && count(books.length, 'book', 'books'),
    items.length && count(items.length, 'note, quote or other thing', 'notes, quotes and other things')].filter(Boolean);
  confirmBox(`Restore from ${when}?`, `This puts back ${parts.join(', ')}${photos ? ` (with ${count(photos, 'photo', 'photos')})` : ''} that aren’t in the app now. Nothing you have is changed.`,
    'Restore', () => runRestore(plan));
}

async function runRestore({ data, files, worlds, books, items }) {
  if (!navigator.onLine) return toast('You’re offline. Restoring needs a connection.', true);
  let room = isOwner() || DB.demo ? Infinity : Math.max(0, PHOTO_CAP - photoCount());
  let skipped = 0, done = 0;
  const total = worlds.length + books.length + items.length;
  const bar = document.createElement('div');
  bar.className = 'restore-bar';
  document.body.appendChild(bar);
  const show = () => { bar.textContent = `Restoring… ${done} of ${total}`; };
  show();
  // Photos inside a thing: from the backup file if it's there (and there's room), otherwise left off.
  const withPhotos = async (folder, id, v) => {
    if (!v || typeof v !== 'object') return v;
    if (isPhotoObj(v)) {
      const blob = files.get(photoFile(v));
      if (!blob || room <= 0) { skipped++; return null; }
      try {
        const head = await blob.slice(0, 5).text();
        const typed = new File([blob], 'photo', { type: /^<(\?xml|svg)/.test(head) ? 'image/svg+xml' : 'image/jpeg' });
        const photo = await DB.uploadPhotoFor(folder, id, await Photos.prepare(typed));
        room--;
        return photo;
      } catch (e) { console.warn('Couldn’t restore a photo', e); skipped++; return null; }
    }
    if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await withPhotos(folder, id, x)); return out; }
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = await withPhotos(folder, id, x);
    return out;
  };
  const put = async (kind, folder, doc) => {
    const { id, sharedId, ...rest } = doc;
    try { await DB.restoreDoc(kind, id, await withPhotos(folder, id, rest)); } catch (e) { console.warn('Couldn’t restore', id, e); }
    done++; show();
  };
  try {
    for (const w of worlds) await put('worlds', 'worlds', { ...w, name: plainName(w) });
    for (const b of books) await put('books', 'books', b);
    for (const i of items) await put('items', 'items', i);
    // Shelves from the backup that were deleted since.
    const shelves = (state.settings && state.settings.shelves) || null, old = (data.settings && data.settings.shelves) || [];
    if (shelves && old.length) {
      const ids = new Set(shelves.map(s => s.id)), add = old.filter(s => !ids.has(s.id) && books.some(b => b.shelf === s.id));
      if (add.length) { state.settings.shelves = [...shelves, ...add]; await DB.saveSettings({ shelves: state.settings.shelves }); }
    }
  } finally { bar.remove(); }
  toast(skipped ? `Restored. ${skipped} photo${skipped === 1 ? ' wasn’t' : 's weren’t'} in the backup or past the photo limit.` : 'Restored');
}
