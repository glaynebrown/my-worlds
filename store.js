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
  const removePhoto = p => p ? Promise.all([removeFile(p.path), removeFile(p.thumbPath)]).catch(console.error) : Promise.resolve();

  async function putBlob(path, blob) {
    const ref = storage.ref(path);
    await ref.put(blob, { contentType: 'image/jpeg', cacheControl: 'private, max-age=31536000' });
    return ref.getDownloadURL();
  }

  // prepared = output of Photos.prepare(). Unique names so edits never collide.
  async function uploadPhoto(folder, id, prepared) {
    needOnline('Uploading photos');
    const base = `users/${uid()}/${folder}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const [url, thumbUrl] = await Promise.all([
      putBlob(`${base}.jpg`, prepared.full.blob),
      putBlob(`${base}-thumb.jpg`, prepared.thumb.blob),
    ]);
    return { path: `${base}.jpg`, thumbPath: `${base}-thumb.jpg`, url, thumbUrl, w: prepared.full.w, h: prepared.full.h };
  }

  return {
    configured: true,
    demo: false,

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
    setWorld: (id, data) => write(worlds().doc(id).set(data)),
    setItem: (id, data) => write(items().doc(id).set(data)),
  };
})();
