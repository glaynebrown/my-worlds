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

    // Deletes every photo, world and saved thing, then the login itself.
    async deleteAccount(password, onStep) {
      needOnline('Deleting your account');
      const user = auth.currentUser;
      await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email, password));
      const [ws, is] = await Promise.all([worlds().get(), items().get()]);
      const all = [...is.docs.map(withId), ...ws.docs.map(withId)];
      let n = 0;
      for (const d of all) {
        await Promise.all([removePhoto(d.photo), removePhoto(d.cardPhoto), removePhoto(d.look && d.look.photo)]);
        if (onStep) onStep(++n, all.length);
      }
      const refs = [...is.docs, ...ws.docs].map(d => d.ref);
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
