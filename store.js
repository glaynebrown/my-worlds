/* All data access lives here, so app.js only deals in plain objects.

   Firestore layout (one account -- yours):
     users/{uid}                  { seeded: true } once the starter worlds exist
     users/{uid}/worlds/{id}      one world:
        { name, theme: 'avatar'|'twd'|'hp'|'custom', canonParts: { ending, ships, headcanons }, ficsOn (false hides Fics), look (custom only:
          { bg, card, ink, accent, font, photo }), order, canonOn,
          cutoff (step index or null), ending, track (see themes.js),
          cardPhoto (the world's card on the home page),
          watched (list of watched step indexes), rounds (finished rewatches),
          firstWatch (made while watching for the first time), t }
     users/{uid}/items/{id}       everything inside a world:
        { world: worldId, kind, t, ...fields, photo?: { path, thumbPath, url, thumbUrl, w, h } }
          kind 'pin'       mood board photo   { caption }
          kind 'quote'     { text, who, where }
          kind 'fav'       { name, quote, note, order }
          kind 'fic'       { title, author, url, ship, note }
          kind 'ship'      { name, note, colors: [a, b] }
          kind 'shippic'   a photo on a ship's page { ship: shipId, caption }
          kind 'headcanon' { text }
          kind 'wish'      wishlist entry (world: null) { text, note, toWatch }
          kind 'epnote'    rewatch notes { step: full episode/film label, text }
       Books keep their things here too (world: bookId): 'bnote' reading notes
       { text, page, chapter, date, read }, 'quote' { text, who, page }, 'pin',
       'mapmark' { x, y, label, note }, and My Canon's 'ship'/'headcanon'.
     users/{uid}/books/{id}       one book (see books.js):
        { title, author, series, seriesNo, pages, cover (photo) or coverUrl,
          blurb, shelf, order, rating, reads: [{ start, end, physical, audio }],
          page, chapter, review, reviewSafe, theme, look, spineFont, spineInk,
          spineBg, worldId, mapOn, map (photo), canonOn, canonParts, ending, t }

   Storage: users/{uid}/items/{id}/... and users/{uid}/worlds/{id}/...

   When firebase-config.js hasn't been filled in yet, the app can run in
   "sample mode" instead (demo.js): same functions, kept in memory only. */

// Photos added with no signal wait here (IndexedDB 'fw-pending') until they can
// upload. Meanwhile the photo's links point at pending-photo/<id>.jpg, which
// the service worker answers from this same store, so it shows right away.
const PendingPhotos = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('fw-pending', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'pid' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('photos', mode), req = fn(t.objectStore('photos'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    put: rec => run('readwrite', st => st.put(rec)),
    all: () => run('readonly', st => st.getAll()),
    del: pid => run('readwrite', st => st.delete(pid)),
  };
})();

const Store = (() => {
  const configured = typeof firebaseConfig !== 'undefined' && !/PASTE/.test(firebaseConfig.apiKey);
  if (!configured) return { configured: false };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage();

  db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    console.warn('Firestore offline persistence unavailable:', err.code);
  });

  // Offline, Firestore saves on the phone right away and syncs later; don't
  // make the screen wait for the server in that case.
  const write = p => {
    if (navigator.onLine) return p;
    p.catch(e => console.error('Offline save failed to sync', e));
    return Promise.resolve();
  };
  function needOnline(what) {
    if (!navigator.onLine) throw new Error(`You’re offline. ${what} needs an internet connection.`);
  }

  const uid = () => auth.currentUser.uid;
  const userDoc = () => db.collection('users').doc(uid());
  const worlds = () => userDoc().collection('worlds');
  const items = () => userDoc().collection('items');
  const books = () => userDoc().collection('books');
  const withId = d => ({ id: d.id, ...d.data() });

  const ignoreMissing = e => { if (e.code !== 'storage/object-not-found') throw e; };
  const removeFile = path => path ? storage.ref(path).delete().catch(ignoreMissing) : Promise.resolve();
  const removePhoto = p => {
    if (!p) return Promise.resolve();
    if (p.pending) PendingPhotos.del(p.pending).catch(() => {});
    return Promise.all([removeFile(p.path), removeFile(p.thumbPath)]).catch(console.error);
  };

  async function putBlob(path, blob) {
    const ref = storage.ref(path);
    await ref.put(blob, { contentType: 'image/jpeg', cacheControl: 'private, max-age=31536000' });
    return ref.getDownloadURL();
  }

  // prepared = output of Photos.prepare(). Unique names so edits never collide.
  // Offline: the photo waits on the phone and uploads later (flushPending).
  async function uploadPhoto(folder, id, prepared) {
    const pid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const base = `users/${uid()}/${folder}/${id}/${pid}`;
    if (!navigator.onLine) {
      try {
        await PendingPhotos.put({ pid, uid: uid(), base, full: prepared.full.blob, thumb: prepared.thumb.blob, w: prepared.full.w, h: prepared.full.h, t: Date.now() });
      } catch {
        throw new Error('You’re offline, and this phone couldn’t hold the photo for later. Try again with signal.');
      }
      if (typeof toast === 'function') toast('Saved on this phone. It uploads when you have signal.');
      return { pending: pid, path: `${base}.jpg`, thumbPath: `${base}-thumb.jpg`, url: `pending-photo/${pid}.jpg`, thumbUrl: `pending-photo/${pid}-thumb.jpg`, w: prepared.full.w, h: prepared.full.h };
    }
    const [url, thumbUrl] = await Promise.all([
      putBlob(`${base}.jpg`, prepared.full.blob),
      putBlob(`${base}-thumb.jpg`, prepared.thumb.blob),
    ]);
    return { path: `${base}.jpg`, thumbPath: `${base}-thumb.jpg`, url, thumbUrl, w: prepared.full.w, h: prepared.full.h };
  }

  // Uploads photos that were added offline, then swaps their real links into
  // whatever uses them (board photos, card photos, backgrounds, covers, maps,
  // shared items). One that nothing uses any more is dropped after 30 days.
  let flushing = false;
  const swapPending = (v, pid, photo) => {
    if (!v || typeof v !== 'object') return v;
    if (v.pending === pid) return photo;
    if (Array.isArray(v)) return v.map(x => swapPending(x, pid, photo));
    const out = {};
    for (const k of Object.keys(v)) out[k] = swapPending(v[k], pid, photo);
    return out;
  };
  const usesPending = (v, pid) => !!v && typeof v === 'object' && (v.pending === pid || Object.values(v).some(x => usesPending(x, pid)));
  function pendingUsers(pid) {
    const out = [];
    const add = (ref, data) => { if (usesPending(data, pid)) out.push({ ref, data }); };
    state.worlds.forEach(w => add(worlds().doc(w.id), w));
    state.items.forEach(i => add(items().doc(i.id), i));
    state.books.forEach(b => add(books().doc(b.id), b));
    Object.entries(state.shared || {}).forEach(([sid, v]) => {
      if (!v) return;
      const root = db.collection('shared').doc(sid);
      if (v.doc && !v.doc.gone) add(root, v.doc);
      (v.items || []).forEach(i => add(root.collection('items').doc(i.id), i));
    });
    return out;
  }
  async function flushPending() {
    if (flushing || !navigator.onLine || !auth.currentUser || !state.loaded) return 0;
    flushing = true;
    let n = 0;
    try {
      const waiting = (await PendingPhotos.all().catch(() => [])).filter(r => r.uid === uid());
      for (const r of waiting) {
        const users = pendingUsers(r.pid);
        if (!users.length) {
          if (Date.now() - r.t > 30 * 864e5) await PendingPhotos.del(r.pid);
          continue;
        }
        try {
          const [url, thumbUrl] = await Promise.all([putBlob(`${r.base}.jpg`, r.full), putBlob(`${r.base}-thumb.jpg`, r.thumb)]);
          const photo = { path: `${r.base}.jpg`, thumbPath: `${r.base}-thumb.jpg`, url, thumbUrl, w: r.w, h: r.h };
          for (const { ref, data } of users) {
            const patch = {};
            for (const k of Object.keys(data)) if (usesPending(data[k], r.pid)) patch[k] = swapPending(data[k], r.pid, photo);
            await ref.update(patch).catch(e => console.warn('Couldn’t swap in an uploaded photo', e));
          }
          await PendingPhotos.del(r.pid);
          n++;
        } catch (e) {
          console.warn('Photo upload will try again later', e);
          if (!navigator.onLine) break;
        }
      }
    } finally { flushing = false; }
    return n;
  }

  return {
    configured: true,
    demo: false,
    flushPending,

    onAuth: cb => auth.onAuthStateChanged(cb),
    signIn: (email, password) => auth.signInWithEmailAndPassword(email, password),
    signOut: async () => {
      await auth.signOut();
      if (self.caches) await caches.delete('fw-photos-v1').catch(() => {});
    },
    resetPassword: email => auth.sendPasswordResetEmail(email),
    createAccount: (email, password) => auth.createUserWithEmailAndPassword(email, password),

    // null = this login hasn't joined yet (no users/{uid} doc; see join()).
    async loadSettings() {
      const snap = await userDoc().get();
      return snap.exists ? snap.data() : null;
    },
    // Joining needs the invite code (checked by firestore.rules, not just here).
    async join(invite) {
      const data = { invite, libraryMode: true, joinedAt: firebase.firestore.FieldValue.serverTimestamp() };
      await userDoc().set(data);
      return { invite, libraryMode: true };
    },

    // ----- the Library's home-card photos (library/wallpapers) -----
    async loadWallpapers() {
      const snap = await db.collection('library').doc('wallpapers').get().catch(() => null);
      return snap && snap.exists ? snap.data() : null;
    },
    saveWallpapers: data => db.collection('library').doc('wallpapers').set({ ...data, owner: uid() }),
    // ----- the book library (library/books: your bookcase, for everyone else to pick from) -----
    async loadBookLibrary() {
      const snap = await db.collection('library').doc('books').get().catch(() => null);
      return snap && snap.exists ? snap.data() : null;
    },
    saveBookLibrary: data => db.collection('library').doc('books').set({ ...data, owner: uid() }),

    // Deletes every photo, world and saved thing, then the login itself.
    async deleteAccount(password, onStep) {
      needOnline('Deleting your account');
      const user = auth.currentUser;
      await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email, password));
      const [ws, is, bs] = await Promise.all([worlds().get(), items().get(), books().get()]);
      const all = [...is.docs.map(withId), ...ws.docs.map(withId), ...bs.docs.map(withId)];
      let n = 0;
      for (const d of all) {
        await Promise.all([removePhoto(d.photo), removePhoto(d.cardPhoto), removePhoto(d.look && d.look.photo), removePhoto(d.cover), removePhoto(d.map)]);
        if (onStep) onStep(++n, all.length);
      }
      const refs = [...is.docs, ...ws.docs, ...bs.docs].map(d => d.ref);
      for (let k = 0; k < refs.length; k += 400) {
        const batch = db.batch();
        refs.slice(k, k + 400).forEach(r => batch.delete(r));
        await batch.commit();
      }
      await userDoc().delete();
      if (self.caches) await caches.delete('fw-photos-v1').catch(() => {});
      await user.delete();
    },
    saveSettings: patch => write(userDoc().set(patch, { merge: true })),

    // ----- worlds -----
    watchWorlds: (cb, onError) => worlds().onSnapshot(snap => cb(snap.docs.map(withId)), onError),

    async addWorld(data, prepared) {
      const ref = worlds().doc();
      if (prepared) data = { ...data, look: { ...data.look, photo: await uploadPhoto('worlds', ref.id, prepared) } };
      await write(ref.set({ ...data, t: Date.now() }));
      return ref.id;
    },

    // prepared = a new background photo; dropPhoto = remove the old one.
    async updateWorld(world, patch, prepared, dropPhoto) {
      const old = world.look && world.look.photo;
      if (prepared) patch = { ...patch, look: { ...patch.look, photo: await uploadPhoto('worlds', world.id, prepared) } };
      else if (dropPhoto && patch.look) patch = { ...patch, look: { ...patch.look, photo: null } };
      await write(worlds().doc(world.id).update(patch));
      if (old && (prepared || dropPhoto)) await removePhoto(old);
    },

    // The photo on this world's card on the home page (prepared, or null to remove it).
    async setCardPhoto(world, prepared) {
      const old = world.cardPhoto;
      const cardPhoto = prepared ? await uploadPhoto('worlds', world.id, prepared) : null;
      await write(worlds().doc(world.id).update({ cardPhoto }));
      if (old) await removePhoto(old);
    },

    // Deletes the world and everything in it.
    async deleteWorld(world, inside) {
      const batch = db.batch();
      inside.forEach(item => batch.delete(items().doc(item.id)));
      batch.delete(worlds().doc(world.id));
      await write(batch.commit());
      await Promise.all([...inside.map(i => removePhoto(i.photo)), removePhoto(world.look && world.look.photo), removePhoto(world.cardPhoto)]);
    },

    // ----- books (books.js) -----
    watchBooks: (cb, onError) => books().onSnapshot(snap => cb(snap.docs.map(withId)), onError),

    // prepared = a cover photo from the camera roll (or none: a found cover's link is in data.coverUrl).
    async addBook(data, prepared) {
      const ref = books().doc();
      if (prepared) data = { ...data, cover: await uploadPhoto('books', ref.id, prepared) };
      await write(ref.set({ ...data, t: Date.now() }));
      return ref.id;
    },

    // prepared = a new background photo for the book's look; dropPhoto = remove it.
    async updateBook(book, patch, prepared, dropPhoto) {
      const old = book.look && book.look.photo;
      if (prepared) patch = { ...patch, look: { ...patch.look, photo: await uploadPhoto('books', book.id, prepared) } };
      else if (dropPhoto && patch.look) patch = { ...patch, look: { ...patch.look, photo: null } };
      await write(books().doc(book.id).update(patch));
      if (old && (prepared || dropPhoto)) await removePhoto(old);
    },

    // The cover or the map: key 'cover' | 'map', prepared or null to remove it.
    async setBookPhoto(book, key, prepared) {
      const old = book[key];
      const photo = prepared ? await uploadPhoto('books', book.id, prepared) : null;
      await write(books().doc(book.id).update({ [key]: photo }));
      if (old) await removePhoto(old);
    },
    // A photo that isn't saved on a book yet (a buddy read's shared map).
    uploadBookPhoto: (id, prepared) => uploadPhoto('books', id, prepared),
    removePhoto,

    async deleteBook(book, inside) {
      const batch = db.batch();
      inside.forEach(item => batch.delete(items().doc(item.id)));
      batch.delete(books().doc(book.id));
      await write(batch.commit());
      await Promise.all([...inside.map(i => removePhoto(i.photo)), removePhoto(book.cover), removePhoto(book.map), removePhoto(book.look && book.look.photo)]);
    },

    // ----- items -----
    watchItems: (cb, onError) => items().onSnapshot(snap => cb(snap.docs.map(withId)), onError),

    async addItem(data, prepared) {
      const ref = items().doc();
      const photo = prepared ? await uploadPhoto('items', ref.id, prepared) : null;
      await write(ref.set({ ...data, ...(photo ? { photo } : {}), t: Date.now() }));
      return ref.id;
    },

    async updateItem(item, patch, prepared, dropPhoto) {
      if (prepared) patch = { ...patch, photo: await uploadPhoto('items', item.id, prepared) };
      else if (dropPhoto) patch = { ...patch, photo: null };
      await write(items().doc(item.id).update(patch));
      if (item.photo && (prepared || dropPhoto)) await removePhoto(item.photo);
    },

    async deleteItem(item) {
      await write(items().doc(item.id).delete());
      await removePhoto(item.photo);
    },

    // ----- shared worlds (see together.js) -----
    // shared/{sid}: { owner, members: [uid], names: {uid: name}, invited: [email],
    //   sections: { rewatch: true }, name, theme, look snapshot, track, watched,
    //   rounds, firstWatch, ended }   shared/{sid}/notes/{id}: { step, text, by, byName, t }
    myUid: () => uid(),
    myEmail: () => (auth.currentUser.email || '').toLowerCase(),
    async createShared(data) {
      needOnline('Sharing');
      const ref = db.collection('shared').doc();
      await ref.set({ ...data, owner: uid(), members: [uid()], createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      return ref.id;
    },
    watchShared(sid, cb, onError) {
      const ref = db.collection('shared').doc(sid);
      let doc = null, notes = [], sItems = [];
      const send = () => cb({ doc, notes, items: sItems });
      const a = ref.onSnapshot(s => { doc = s.exists ? { id: s.id, ...s.data() } : { id: sid, gone: true }; send(); },
        e => { doc = { id: sid, gone: true, error: e.code }; send(); if (onError) onError(e); });
      const b = ref.collection('notes').onSnapshot(s => { notes = s.docs.map(withId); send(); }, () => {});
      const c = ref.collection('items').onSnapshot(s => { sItems = s.docs.map(withId); send(); }, () => {});
      return () => { a(); b(); c(); };
    },
    // Shared boards, quotes, favorites, canon, fics: shared/{sid}/items, each
    // tagged with who added it (by, byName). Photos stay in the adder's storage.
    async addSharedItem(sid, data, prepared) {
      const ref = db.collection('shared').doc(sid).collection('items').doc();
      const photo = prepared ? await uploadPhoto('items', ref.id, prepared) : null;
      await write(ref.set({ ...data, ...(photo ? { photo } : {}), by: uid(), t: data.t || Date.now() }));
      return ref.id;
    },
    async updateSharedItem(sid, item, patch, prepared, dropPhoto) {
      if (prepared) patch = { ...patch, photo: await uploadPhoto('items', item.id, prepared) };
      else if (dropPhoto) patch = { ...patch, photo: null };
      await write(db.collection('shared').doc(sid).collection('items').doc(item.id).update(patch));
      if (item.photo && (prepared || dropPhoto) && item.by === uid()) await removePhoto(item.photo);
    },
    async deleteSharedItem(sid, item) {
      await write(db.collection('shared').doc(sid).collection('items').doc(item.id).delete());
      if (item.by === uid()) await removePhoto(item.photo);
    },
    // Removes one of your items without deleting its photo (it moved into a shared world).
    deleteItemOnly: item => write(items().doc(item.id).delete()),
    updateShared: (sid, patch) => write(db.collection('shared').doc(sid).update(patch)),
    toggleSharedWatched: (sid, i, on) => write(db.collection('shared').doc(sid).update({
      watched: on ? firebase.firestore.FieldValue.arrayUnion(i) : firebase.firestore.FieldValue.arrayRemove(i),
    })),
    addSharedNote: (sid, data) => write(db.collection('shared').doc(sid).collection('notes').add({ ...data, by: uid(), t: Date.now() })),
    updateSharedNote: (sid, note, patch) => write(db.collection('shared').doc(sid).collection('notes').doc(note.id).update(patch)),
    deleteSharedNote: (sid, note) => write(db.collection('shared').doc(sid).collection('notes').doc(note.id).delete()),
    async inviteToShared(sid, email) {
      needOnline('Sharing');
      await db.collection('shared').doc(sid).update({ invited: firebase.firestore.FieldValue.arrayUnion(email) });
    },
    async pendingShares() {
      const email = (auth.currentUser.email || '').toLowerCase();
      if (!email || !navigator.onLine) return [];
      const snap = await db.collection('shared').where('invited', 'array-contains', email).get().catch(() => null);
      return snap ? snap.docs.map(withId).filter(d => !d.ended) : [];
    },
    joinShared: (sid, name) => db.collection('shared').doc(sid).update({
      members: firebase.firestore.FieldValue.arrayUnion(uid()),
      invited: firebase.firestore.FieldValue.arrayRemove((auth.currentUser.email || '').toLowerCase()),
      [`names.${uid()}`]: name,
    }),
    declineShared: sid => db.collection('shared').doc(sid).update({
      invited: firebase.firestore.FieldValue.arrayRemove((auth.currentUser.email || '').toLowerCase()),
    }),
    leaveShared: sid => db.collection('shared').doc(sid).update({ members: firebase.firestore.FieldValue.arrayRemove(uid()) }),

    // ----- sharing a copy with someone (see share.js) -----
    // Writes shares/{email} plus its worlds and items, in batches.
    async createShare(email, worldList, itemList) {
      needOnline('Sharing');
      const root = db.collection('shares').doc(email);
      // Sending again replaces the old copy completely.
      const old = await root.get().catch(() => null);
      if (old && old.exists) {
        const [ow, oi] = await Promise.all([root.collection('worlds').get(), root.collection('items').get()]);
        const refs = [...ow.docs, ...oi.docs].map(d => d.ref);
        for (let k = 0; k < refs.length; k += 400) {
          const batch = db.batch();
          refs.slice(k, k + 400).forEach(r => batch.delete(r));
          await batch.commit();
        }
      }
      await root.set({ from: uid(), createdAt: firebase.firestore.FieldValue.serverTimestamp(), worlds: worldList.length, items: itemList.length });
      const writes = [
        ...worldList.map(w => [root.collection('worlds').doc(w.id), w]),
        ...itemList.map(i => [root.collection('items').doc(i.id), i]),
      ];
      for (let k = 0; k < writes.length; k += 400) {
        const batch = db.batch();
        writes.slice(k, k + 400).forEach(([ref, { id, ...data }]) => batch.set(ref, data));
        await batch.commit();
      }
    },

    // A copy waiting for whoever is signed in, or null.
    async loadShare() {
      const email = (auth.currentUser.email || '').toLowerCase();
      if (!email) return null;
      const root = db.collection('shares').doc(email);
      const snap = await root.get({ source: 'server' }).catch(() => null);
      if (!snap || !snap.exists) return null;
      const [ws, is] = await Promise.all([root.collection('worlds').get(), root.collection('items').get()]);
      return { email, worlds: ws.docs.map(withId), items: is.docs.map(withId) };
    },

    async deleteShare(share) {
      const root = db.collection('shares').doc(share.email);
      const refs = [...share.worlds.map(w => root.collection('worlds').doc(w.id)), ...share.items.map(i => root.collection('items').doc(i.id))];
      for (let k = 0; k < refs.length; k += 400) {
        const batch = db.batch();
        refs.slice(k, k + 400).forEach(r => batch.delete(r));
        await batch.commit();
      }
      await root.delete();
    },

    // Copies a photo (by its download links) into the signed-in person's own storage.
    async copyPhoto(folder, id, photo) {
      const get = async url => { const r = await fetch(url); if (!r.ok) throw new Error('photo'); return r.blob(); };
      const [full, thumb] = await Promise.all([get(photo.url), get(photo.thumbUrl || photo.url)]);
      return uploadPhoto(folder, id, { full: { blob: full, w: photo.w, h: photo.h }, thumb: { blob: thumb } });
    },
    newId: kind => userDoc().collection(kind).doc().id,
    // Backup & restore (backup.js): put a thing back under its old id; upload a restored photo.
    restoreDoc: (kind, id, data) => write(userDoc().collection(kind).doc(id).set(data)),
    uploadPhotoFor: (folder, id, prepared) => uploadPhoto(folder, id, prepared),
    setWorld: (id, data) => write(worlds().doc(id).set(data)),
    setItem: (id, data) => write(items().doc(id).set(data)),
  };
})();
