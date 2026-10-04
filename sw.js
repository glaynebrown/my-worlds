/* Offline support.

   - App files (this site): network first, so an update you upload shows up
     right away; the saved copy is used when there's no connection.
   - Firebase SDK and Google Fonts: saved copy first -- those never change.
   - Photos: saved copy first (a photo's address never changes once uploaded),
     so boards load fast and work with no signal. Cleared on sign-out.
   - Book covers from the book search: saved copy first, like photos.
   - Everything else (database, login, book search) goes straight to the network.
     Firestore keeps its own offline copy of your worlds. */
const APP_CACHE = 'fw-app-v9';
const PHOTO_CACHE = 'fw-photos-v1';
const APP_FILES = [
  './', 'index.html', 'styles.css', 'themes.css', 'books.css', 'tour.css', 'decor.css', 'themes.js', 'app.js', 'world.js', 'share.js', 'library.js', 'together.js', 'books.js', 'tour.js', 'scan.js', 'decor.js', 'store.js', 'demo.js', 'photos.js',
  'firebase-config.js', 'manifest.json', 'icon-192.png', 'apple-touch-icon.png',
];
const SDK = ['app', 'auth', 'firestore', 'storage']
  .map(name => `https://www.gstatic.com/firebasejs/10.14.1/firebase-${name}-compat.js`);
const HOME = new URL('./', self.location).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => Promise.allSettled([...APP_FILES, ...SDK].map(url => cache.add(url))))
      .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== APP_CACHE && k !== PHOTO_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// On a weak signal, don't wait forever: after 3 seconds the saved copy is used.
function fetchWithin(request, ms) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('slow network')), ms)),
  ]);
}

async function networkFirst(request, key = request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetchWithin(request, 3000);
    if (response.ok) cache.put(key, response.clone());
    return response;
  } catch (err) {
    const saved = await cache.match(key);
    if (saved) return saved;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

// Photos: only good downloads are saved, so a hiccup can't get stuck as a broken picture.
async function photo(request) {
  const cache = await caches.open(PHOTO_CACHE);
  const saved = await cache.match(request.url);
  if (saved) return saved;
  try {
    const response = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
    if (response.ok) cache.put(request.url, response.clone());
    return response;
  } catch (err) {
    return fetch(request);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(request.mode === 'navigate' ? networkFirst(request, HOME) : networkFirst(request));
  } else if ((url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))
    || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, APP_CACHE));
  } else if ((url.hostname === 'books.google.com' && url.pathname.startsWith('/books/')) || url.hostname === 'covers.openlibrary.org') {
    // Book covers found by the search: saved on the phone like photos.
    event.respondWith(cacheFirst(request, PHOTO_CACHE));
  } else if (url.hostname === 'firebasestorage.googleapis.com' && url.searchParams.get('alt') === 'media') {
    // Only photo downloads. Uploads and the app's own Storage requests carry
    // your sign-in and must go straight through.
    event.respondWith(photo(request));
  }
});
