/* All data access lives here, so app.js only deals in plain objects.

   Firestore layout (one account -- yours):
     users/{uid}                  { seeded: true } once the starter worlds exist
     users/{uid}/worlds/{id}      one world:
        { name, theme: 'avatar'|'twd'|'hp'|'custom', canonParts: { ending, ships, headcanons }, look (custom only:
          { bg, card, ink, accent, font, photo }), order, canonOn,
          cutoff (step index or null), ending, track (see themes.js),
          cardPhoto (the world's card on the home page),
          watched (list of watched step indexes), rounds (finished rewatches), t }
     users/{uid}/items/{id}       everything inside a world:
        { world: worldId, kind, t, ...fields, photo?: { path, thumbPath, url, thumbUrl, w, h } }
          kind 'pin'       mood board photo   { caption }
          kind 'quote'     { text, who, where }
          kind 'fav'       { name, quote, note, order }
          kind 'fic'       { title, author, url, ship, note }
          kind 'ship'      { name, note, colors: [a, b] }
          kind 'shippic'   a photo on a ship's page { ship: shipId, caption }
          kind 'headcanon' { text }
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

    async loadSettings() {
      const snap = await userDoc().get();
      return snap.exists ? snap.data() : {};
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
  };
})();
