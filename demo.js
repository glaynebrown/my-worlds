/* Sample mode: lets you try the app before Firebase is set up. Same functions
   as store.js, but everything lives in memory and disappears on reload.
   Photos you add stay on this phone only (never uploaded). */
const DemoStore = (() => {
  let worlds = [], items = [], books = [], settings = {}, bookLib = null;
  const shared = {}, sharedNotes = {}, sharedWatchers = {};
  const sharedItems = {};
  const sharedView = sid => ({ doc: shared[sid] ? clone(shared[sid]) : { id: sid, gone: true }, notes: clone(sharedNotes[sid] || []), items: clone(sharedItems[sid] || []) });
  const emitShared = sid => setTimeout(() => (sharedWatchers[sid] || []).forEach(cb => cb(sharedView(sid))));
  let n = 0;
  const id = () => `d${++n}`;
  const listeners = { worlds: [], items: [], books: [] };
  const clone = x => JSON.parse(JSON.stringify(x));
  const emit = () => {
    setTimeout(() => {
      listeners.worlds.forEach(cb => cb(clone(worlds)));
      listeners.items.forEach(cb => cb(clone(items)));
      listeners.books.forEach(cb => cb(clone(books)));
    });
  };
  const localPhoto = p => {
    const url = URL.createObjectURL(p.full.blob), thumbUrl = URL.createObjectURL(p.thumb.blob);
    return { path: url, thumbPath: thumbUrl, url, thumbUrl, w: p.full.w, h: p.full.h };
  };

  // Soft placeholder "photos" so a sample mood board isn't empty.
  function samplePhoto(i, colors) {
    const [a, b] = colors;
    const h = [300, 420, 360, 480][i % 4];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="${h}" viewBox="0 0 400 ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="${h}" fill="url(#g)"/><circle cx="${80 + (i * 97) % 240}" cy="${h * 0.3}" r="${26 + (i * 13) % 30}" fill="#fff" opacity=".35"/><path d="M0 ${h * 0.75} Q120 ${h * 0.6} 220 ${h * 0.72} T400 ${h * 0.68} V${h} H0Z" fill="#000" opacity=".18"/></svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return { path: `sample-${i}`, thumbPath: `sample-${i}-t`, url, thumbUrl: url, w: 400, h };
  }

  return {
    configured: true,
    demo: true,

    onAuth: cb => setTimeout(() => cb({ uid: 'sample', email: 'sample' })),
    signIn: async () => {},
    signOut: async () => { try { sessionStorage.removeItem('fw-sample'); } catch {} location.hash = '#/'; location.reload(); },
    resetPassword: async () => {},

    loadSettings: async () => clone(settings),
    join: async invite => ({ invite, libraryMode: true }),
    createAccount: async () => {},
    loadWallpapers: async () => null,
    saveWallpapers: async () => {},
    loadBookLibrary: async () => (bookLib ? clone(bookLib) : null),
    saveBookLibrary: async data => { bookLib = clone(data); },
    deleteAccount: async () => { throw new Error('Sample mode has no account to delete.'); },
    saveSettings: async patch => { settings = { ...settings, ...patch }; },

    watchWorlds(cb) { listeners.worlds.push(cb); emit(); return () => {}; },
    watchItems(cb) { listeners.items.push(cb); emit(); return () => {}; },

    async addWorld(data, prepared) {
      const w = { ...clone(data), id: id(), t: Date.now() };
      if (prepared) w.look.photo = localPhoto(prepared);
      worlds.push(w); emit();
      return w.id;
    },
    async updateWorld(world, patch, prepared, dropPhoto) {
      patch = clone(patch);
      if (prepared) patch.look = { ...patch.look, photo: localPhoto(prepared) };
      else if (dropPhoto && patch.look) patch.look.photo = null;
      worlds = worlds.map(w => (w.id === world.id ? { ...w, ...patch } : w)); emit();
    },
    async setCardPhoto(world, prepared) {
      worlds = worlds.map(w => (w.id === world.id ? { ...w, cardPhoto: prepared ? localPhoto(prepared) : null } : w)); emit();
    },
    async deleteWorld(world) {
      worlds = worlds.filter(w => w.id !== world.id);
      items = items.filter(i => i.world !== world.id); emit();
    },

    watchBooks(cb) { listeners.books.push(cb); emit(); return () => {}; },
    async addBook(data, prepared) {
      const b = { ...clone(data), id: id(), t: Date.now() };
      if (prepared) b.cover = localPhoto(prepared);
      books.push(b); emit();
      return b.id;
    },
    async updateBook(book, patch, prepared, dropPhoto) {
      patch = clone(patch);
      if (prepared) patch.look = { ...patch.look, photo: localPhoto(prepared) };
      else if (dropPhoto && patch.look) patch.look.photo = null;
      books = books.map(b => (b.id === book.id ? { ...b, ...patch } : b)); emit();
    },
    async setBookPhoto(book, key, prepared) {
      books = books.map(b => (b.id === book.id ? { ...b, [key]: prepared ? localPhoto(prepared) : null } : b)); emit();
    },
    uploadBookPhoto: async (bid, prepared) => localPhoto(prepared),
    removePhoto: async () => {},
    async deleteBook(book) {
      books = books.filter(b => b.id !== book.id);
      items = items.filter(i => i.world !== book.id); emit();
    },

    async addItem(data, prepared) {
      const it = { ...clone(data), id: id(), t: Date.now() + n };
      if (prepared) it.photo = localPhoto(prepared);
      items.push(it); emit();
      return it.id;
    },
    async updateItem(item, patch, prepared, dropPhoto) {
      patch = clone(patch);
      if (prepared) patch.photo = localPhoto(prepared);
      else if (dropPhoto) patch.photo = null;
      items = items.map(i => (i.id === item.id ? { ...i, ...patch } : i)); emit();
    },
    async deleteItem(item) { items = items.filter(i => i.id !== item.id); emit(); },

    // ----- shared worlds, in memory (one pretend sister can be added for testing) -----
    myUid: () => 'sample',
    myEmail: () => 'sample',
    async createShared(data) {
      const sid = id();
      shared[sid] = { ...clone(data), id: sid, owner: 'sample', members: ['sample'] };
      sharedNotes[sid] = [];
      emitShared(sid);
      return sid;
    },
    watchShared(sid, cb) {
      (sharedWatchers[sid] = sharedWatchers[sid] || []).push(cb);
      setTimeout(() => cb(sharedView(sid)));
      return () => { sharedWatchers[sid] = (sharedWatchers[sid] || []).filter(f => f !== cb); };
    },
    async updateShared(sid, patch) { Object.assign(shared[sid], clone(patch)); emitShared(sid); },
    async toggleSharedWatched(sid, i, on) {
      const w = new Set(shared[sid].watched || []);
      if (on) w.add(i); else w.delete(i);
      shared[sid].watched = [...w]; emitShared(sid);
    },
    async addSharedNote(sid, data) { sharedNotes[sid].push({ ...clone(data), id: id(), by: data.by || 'sample', t: Date.now() }); emitShared(sid); },
    async updateSharedNote(sid, note, patch) { sharedNotes[sid] = sharedNotes[sid].map(n => (n.id === note.id ? { ...n, ...patch } : n)); emitShared(sid); },
    async deleteSharedNote(sid, note) { sharedNotes[sid] = sharedNotes[sid].filter(n => n.id !== note.id); emitShared(sid); },
    async addSharedItem(sid, data, prepared) {
      const it = { ...clone(data), id: id(), by: data.by || 'sample', t: data.t || Date.now() };
      if (prepared) it.photo = localPhoto(prepared);
      (sharedItems[sid] = sharedItems[sid] || []).push(it); emitShared(sid);
      return it.id;
    },
    async updateSharedItem(sid, item, patch, prepared, dropPhoto) {
      patch = clone(patch);
      if (prepared) patch.photo = localPhoto(prepared); else if (dropPhoto) patch.photo = null;
      sharedItems[sid] = sharedItems[sid].map(i => (i.id === item.id ? { ...i, ...patch } : i)); emitShared(sid);
    },
    async deleteSharedItem(sid, item) { sharedItems[sid] = sharedItems[sid].filter(i => i.id !== item.id); emitShared(sid); },
    async deleteItemOnly(item) { items = items.filter(i => i.id !== item.id); emit(); },
    async inviteToShared(sid, email) { shared[sid].invited = [...new Set([...(shared[sid].invited || []), email])]; emitShared(sid); },
    pendingShares: async () => [],
    copyPhoto: async (folder, cid, photo) => photo,
    joinShared: async () => {},
    declineShared: async () => {},
    async leaveShared(sid) { shared[sid].members = shared[sid].members.filter(m => m !== 'sample'); emitShared(sid); },
    // Test helper: a pretend sister joins and writes a note.
    _sisterJoins(sid, name = 'Sarah') {
      shared[sid].members.push('sister'); shared[sid].names = { ...(shared[sid].names || {}), sister: name };
      shared[sid].invited = []; emitShared(sid);
    },

    // Called once the starter worlds exist, so sample mode has a little to show.
    // Made-up examples only.
    async addSamples(worldIds) {
      const [avatar, twd, hp] = worldIds;
      const pins = [[avatar, ['#e9c46a', '#b8352b']], [avatar, ['#9ec9e2', '#2f6f9f']], [avatar, ['#cfe0b4', '#5e7d3a']],
        [twd, ['#8a8a6a', '#2e2e26']], [twd, ['#b38b6d', '#4a2e22']], [twd, ['#6d6d64', '#1e1e1a']],
        [hp, ['#d3a625', '#740001']], [hp, ['#5a3c28', '#1a120c']], [hp, ['#c9b27c', '#3a2412']]];
      pins.forEach(([world, colors], i) => items.push({ id: id(), world, kind: 'pin', caption: '', photo: samplePhoto(i, colors), t: Date.now() - i }));
      items.push(
        { id: id(), world: twd, kind: 'headcanon', text: 'Sample headcanon: after S5E1, everyone makes it to Washington together.', t: Date.now() },
        { id: id(), world: avatar, kind: 'fic', title: 'Sample fic title', author: 'sample_author', url: 'https://archiveofourown.org/works/1', ship: 'Zutara', note: 'Sample: the slow burn one.', t: Date.now() },
        { id: id(), world: hp, kind: 'quote', text: 'Sample quote goes here.', who: 'Hermione', where: 'Prisoner of Azkaban', t: Date.now() },
      );
      emit();
    },
  };
})();
