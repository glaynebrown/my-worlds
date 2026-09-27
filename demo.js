/* Sample mode: lets you try the app before Firebase is set up. Same functions
   as store.js, but everything lives in memory and disappears on reload.
   Photos you add stay on this phone only (never uploaded). */
const DemoStore = (() => {
  let worlds = [], items = [], settings = {};
  let n = 0;
  const id = () => `d${++n}`;
  const listeners = { worlds: [], items: [] };
  const clone = x => JSON.parse(JSON.stringify(x));
  const emit = () => {
    setTimeout(() => {
      listeners.worlds.forEach(cb => cb(clone(worlds)));
      listeners.items.forEach(cb => cb(clone(items)));
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
