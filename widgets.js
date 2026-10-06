/* Home Screen and Lock Screen widgets (the iPhone app only).

   Widgets can't sign in or read Firebase, so the app hands them a small
   snapshot each time your worlds and books change: your doors, the book you're
   reading, the next episode in each world, and a few photos from each board.
   The native side (WidgetBridge, in the Xcode project) saves it where the
   widgets can read it and asks them to redraw.

   Tapping a widget opens worlds://w/ID or worlds://b/ID, which lands here
   (openFromWidget) and goes to that world or book. */

// (The iPhone app loads Capacitor's own script, vendor/capacitor.js, for registerPlugin.)
const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
  && typeof window.Capacitor.registerPlugin === 'function');
const WidgetBridge = isNativeApp ? window.Capacitor.registerPlugin('WidgetBridge') : null;
const AppLinks = isNativeApp ? window.Capacitor.registerPlugin('App') : null;
const WIDGET_BOARD_PHOTOS = 8;   // per world
const WIDGET_PHOTOS_MAX = 60;    // in all
const WIDGET_IMG_EDGE = 480;     // px: widgets have little memory

// A short, stable file name for an image link.
function widgetImgName(url) {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) >>> 0;
  return `i${h.toString(36)}.jpg`;
}
// A small JPEG of a photo, as base64 (no "data:" prefix).
async function widgetImg(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('photo');
  const bmp = await createImageBitmap(await res.blob());
  const k = Math.min(1, WIDGET_IMG_EDGE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82).split(',')[1];
}

// The next episode or film to watch in a world, and how far along you are.
function widgetNextUp(world) {
  const w = withShared(world);
  const steps = Themes.steps(w.track, w.theme);
  if (!steps.length) return null;
  const watched = watchedOf(w);
  const end = w.canonOn && canonParts(w).ending && w.cutoff != null ? w.cutoff : steps.length - 1;
  const i = steps.findIndex((s, k) => k <= end && !watched.has(k));
  const seen = [...watched].filter(k => k <= end).length;
  if (i < 0) return { label: 'All caught up', title: '', progress: 1 };
  const s = steps[i];
  return { label: s.label, short: s.short || '', title: s.title && s.title !== s.label ? s.title : '', progress: seen / (end + 1) };
}

function widgetColors(world) {
  if (world.theme === 'custom' || world._book) {
    const l = world.look || {};
    return { bg: l.bg || '#16110e', ink: l.ink || '#f3e9d2', accent: l.accent || '#c9a35a' };
  }
  const dark = Themes.isDark(THEME_COLOR[world.theme] || '#16110e');
  return { bg: THEME_COLOR[world.theme] || '#16110e', ink: world.cardInk || (dark ? '#f3e9d2' : '#2b211a'), accent: (Themes.info(world).palette || [[0, '#c9a35a']])[0][1] };
}

let widgetTimer = null, widgetBusy = false, widgetLast = '';
function queueWidgetSync() {
  if (!WidgetBridge || !state.loaded) return;
  clearTimeout(widgetTimer);
  widgetTimer = setTimeout(syncWidgets, 2500);
}

async function syncWidgets() {
  if (!WidgetBridge || widgetBusy || !state.loaded) return;
  widgetBusy = true;
  try {
    const want = new Map(); // file name -> link
    const img = url => { if (!url) return null; const n = widgetImgName(url); want.set(n, url); return n; };

    const worlds = sortedWorlds().map(w => {
      const c = widgetColors(w);
      return { id: w.id, name: plainName(w), ...c, card: img(w.cardPhoto && (w.cardPhoto.thumbUrl || w.cardPhoto.url)), next: widgetNextUp(w) };
    });
    const reading = state.books.filter(b => shelfOf(b) === 'reading').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const books = reading.map(b => ({
      id: b.id, title: b.title, author: b.author || '', page: Number(b.page) || 0, pages: Number(b.pages) || 0,
      chapter: b.chapter || '', cover: img(coverSmall(b)), ...widgetColors(b),
    }));
    const boards = {};
    let left = WIDGET_PHOTOS_MAX;
    for (const w of sortedWorlds()) {
      const pins = itemsFor(w, 'pin').filter(p => p.photo && !p.photo.pending).sort(byBoard).slice(0, Math.min(WIDGET_BOARD_PHOTOS, left));
      left -= pins.length;
      if (pins.length) boards[w.id] = pins.map(p => img(p.photo.thumbUrl || p.photo.url));
    }

    const snapshot = { v: 1, updated: Date.now(), worlds, books, boards };
    const key = JSON.stringify(snapshot).replace(/"updated":\d+/, '');
    // Photos the widgets don't have yet (the native side lists what it has).
    const have = new Set((await WidgetBridge.files().catch(() => ({ files: [] }))).files || []);
    const add = [];
    for (const [name, url] of want) {
      if (have.has(name)) continue;
      if (!navigator.onLine) continue;
      try { add.push({ name, data: await widgetImg(url) }); } catch (e) { console.warn('Widget photo skipped', e); }
    }
    if (key === widgetLast && !add.length) return;
    await WidgetBridge.save({ snapshot: JSON.stringify(snapshot), images: add, keep: [...want.keys()] });
    widgetLast = key;
  } catch (e) {
    console.warn('Widgets not updated', e);
  } finally {
    widgetBusy = false;
  }
}

// Tapping a widget: worlds://w/ID or worlds://b/ID.
function openFromWidget(url) {
  const m = /^worlds:\/\/(w|b)\/([^/?#]+)/.exec(url || '');
  if (m) location.hash = `#/${m[1]}/${m[2]}`;
}
if (AppLinks) {
  AppLinks.addListener('appUrlOpen', e => openFromWidget(e.url));
  AppLinks.getLaunchUrl().then(r => r && openFromWidget(r.url)).catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') syncWidgets(); });
