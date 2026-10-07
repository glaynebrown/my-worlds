/* The look and structure of each world.

   Built-in looks have hand-made themes in
   themes.css under [data-theme="..."]. A world made with "Add a world" uses
   theme 'custom' and carries its own colors/font in world.look, which are
   turned into the same CSS variables here.

   Rewatch tracker shapes (world.track):
     { type: 'episodes', seasons: [6, 13, 16] }            -> S1 E1 ... S3 E16
     { type: 'list', noun: 'Film', items: ['Title', ...] } -> one step per title
   Watched episodes (world.watched, a list) and the canon cutoff (world.cutoff)
   are indexes into that flattened list (cutoff null = the real ending). */

const Themes = (() => {
  const BUILT_IN = {
    avatar: {
      label: 'Four elements',
      fonts: ['Ma Shan Zheng', 'Spectral:ital,wght@0,400;0,600;1,400'],
      empty: 'An empty scroll, waiting for ink.',
      // Two-color ship cards pick from these.
      palette: [['Fire', '#b8352b'], ['Water', '#2f6f9f'], ['Earth', '#5e7d3a'], ['Air', '#d98b2b']],
      // Each section takes on a nation's color.
      tabColors: { board: '#d98b2b', quotes: '#2f6f9f', favs: '#5e7d3a', canon: '#b8352b', fics: '#2f6f9f', rewatch: '#5e7d3a' },
      theEnd: 'The end.',
    },
    twd: {
      label: 'Survival journal',
      fonts: ['Stardos Stencil:wght@400;700', 'Special Elite', 'Permanent Marker'],
      empty: 'Nothing here yet. Stay alive out there.',
      palette: [['Blood', '#8e2a1c'], ['Olive', '#6b6b3a'], ['Rust', '#a0522d'], ['Ash', '#7d7a70']],
      theEnd: 'The end.',
      notCanon: 'The timeline that didn’t happen',
    },
    hp: {
      label: 'Candlelit castle',
      fonts: ['IM Fell English SC', 'IM Fell English:ital@0;1', 'EB Garamond:ital,wght@0,400;0,600;1,400'],
      empty: 'Nothing here yet. The candles are lit.',
      palette: [['Scarlet', '#740001'], ['Gold', '#b8891c'], ['Emerald', '#1a472a'], ['Midnight', '#222f5b']],
      theEnd: 'The end.',
    },
    lotr: {
      label: 'Ancient forest',
      fonts: ['Uncial Antiqua', 'Alegreya:ital,wght@0,400;0,600;1,400'],
      empty: 'An empty page, waiting for a tale.',
      palette: [['Gold', '#b8913a'], ['Elven', '#6f8fa8'], ['Shire', '#5f7d3c'], ['Ember', '#a8431f']],
      theEnd: 'The end.',
    },
    got: {
      label: 'Stone & steel',
      fonts: ['Cinzel:wght@500;700', 'Cardo:ital,wght@0,400;0,700;1,400'],
      empty: 'Nothing here yet. The fires are lit.',
      palette: [['Ice', '#7fa9c9'], ['Fire', '#c0461f'], ['Crimson', '#8b1a1a'], ['Gold', '#c6932f']],
      theEnd: 'The end.',
      notCanon: 'The seasons that didn’t happen',
    },
    firefly: {
      label: 'Space western',
      fonts: ['Rye', 'Zilla Slab:ital,wght@0,400;0,600;1,400'],
      empty: 'Nothing here yet. Clear skies ahead.',
      palette: [['Rust', '#b5562a'], ['Brass', '#b89140'], ['Sky', '#5b86a8'], ['Sage', '#6b7d5a']],
      theEnd: 'The end.',
    },
    tlou: {
      label: 'Wild city',
      fonts: ['Oswald:wght@400;500;600', 'Source Serif 4:ital,wght@0,400;0,600;1,400'],
      empty: 'Nothing here yet. Keep moving.',
      palette: [['Amber', '#c98a2b'], ['Moss', '#5d7045'], ['Sky', '#7d96a3'], ['Rust', '#8f4a2e']],
      theEnd: 'The end.',
    },
    potc: {
      label: 'Moonlit sea',
      fonts: ['Pirata One', 'Libre Caslon Text:ital,wght@0,400;0,700;1,400'],
      empty: 'Nothing here yet. Set sail.',
      palette: [['Doubloon', '#c9a23a'], ['Sea', '#2d6a73'], ['Blood', '#8e2323'], ['Pearl', '#3a3a44']],
      theEnd: 'The end.',
    },
    disney: {
      label: 'Storybook night',
      fonts: ['Great Vibes', 'Cormorant Garamond:ital,wght@0,500;0,600;0,700;1,500'],
      empty: 'Nothing here yet. Make a wish.',
      palette: [['Gold', '#d4a53c'], ['Rose', '#d98aa6'], ['Sky', '#7fa7e0'], ['Lilac', '#a58ad9']],
      theEnd: 'Happily ever after.',
    },
    narnia: {
      label: 'Winter lamplight',
      fonts: ['Cinzel:wght@500;700', 'Crimson Pro:ital,wght@0,400;0,600;1,400'],
      empty: 'Nothing here yet. Follow the lamplight.',
      palette: [['Gold', '#c8963e'], ['Crimson', '#9e2b2b'], ['Winter', '#6f93b8'], ['Forest', '#4f6f4a']],
      theEnd: 'The end.',
    },
  };

  // Your family's names for these looks (family-data.js). The App Store app
  // shows them under the names above, with nothing borrowed from the shows.
  if (self.FAMILY && self.FAMILY.LOOKS) Object.entries(self.FAMILY.LOOKS).forEach(([k, v]) => Object.assign(BUILT_IN[k], v));
  // Looks you can pick for a new world or book. The App Store app leaves out
  // Wild city (worlds already wearing it keep it).
  const pickable = () => Object.keys(BUILT_IN).filter(k => !(typeof STORE !== 'undefined' && STORE && k === 'tlou'));

  // "Add a world": starting looks you can then tweak.
  const PRESETS = [
    { name: 'Enchanted forest', bg: '#1f2a22', card: '#eef0e2', ink: '#1f2a1f', accent: '#6f9a5b', font: 'Cormorant Garamond' },
    { name: 'Ballroom', bg: '#dfe8f3', card: '#fffaf3', ink: '#2d3350', accent: '#c07f93', font: 'Playfair Display' },
    { name: 'Snowy lamppost', bg: '#e6ecf1', card: '#ffffff', ink: '#26323d', accent: '#b08a3e', font: 'Cinzel' },
    { name: 'Galaxy', bg: '#0b0d17', card: '#1a1d30', ink: '#e7e9f3', accent: '#f2c14e', font: 'Orbitron' },
    { name: 'Misty woods', bg: '#1d2226', card: '#eceae4', ink: '#22282b', accent: '#8c1c24', font: 'Cormorant Garamond' },
    { name: 'Campus', bg: '#f4efe6', card: '#ffffff', ink: '#2a2a2a', accent: '#3b5b8c', font: 'DM Serif Display' },
    { name: 'Overgrown city', bg: '#2c3226', card: '#dcd6c4', ink: '#2a2a22', accent: '#7b8f4a', font: 'Special Elite' },
    { name: 'Sunset', bg: '#f6e3d3', card: '#fffaf5', ink: '#4a2c2a', accent: '#d0694c', font: 'Great Vibes' },
  ];
  // Books: starting looks for a book's pages (and its spine on the bookcase).
  const BOOK_PRESETS = [
    { name: 'Cozy library', bg: '#2b1d15', card: '#f6efe2', ink: '#2b211a', accent: '#b07a35', font: 'Cormorant Garamond' },
    { name: 'Dark academia', bg: '#1c1a17', card: '#ebe3d3', ink: '#231e18', accent: '#7a2e2e', font: 'IM Fell English SC' },
    { name: 'Fantasy map', bg: '#e6d7b5', card: '#fbf4e2', ink: '#3a2c1b', accent: '#8c5a2b', font: 'Uncial Antiqua' },
    { name: 'Romance', bg: '#f4dfe0', card: '#fffafa', ink: '#4a2a33', accent: '#c4677d', font: 'Great Vibes' },
    { name: 'Thriller', bg: '#141414', card: '#efefec', ink: '#161616', accent: '#b3201c', font: 'Oswald' },
    { name: 'Sci-fi', bg: '#0b0d17', card: '#1a1d30', ink: '#e7e9f3', accent: '#5fc4e8', font: 'Orbitron' },
    { name: 'Fairy tale', bg: '#e4dcf2', card: '#fffdf8', ink: '#352c4a', accent: '#9a7bc8', font: 'Cinzel' },
    { name: 'Seaside', bg: '#d9e8ee', card: '#fbfdfd', ink: '#1f3a48', accent: '#3d7f99', font: 'Playfair Display' },
    { name: 'Forest', bg: '#1f2a22', card: '#eef0e2', ink: '#1f2a1f', accent: '#6f9a5b', font: 'Cormorant Garamond' },
    { name: 'Western', bg: '#3a2618', card: '#f2e6d0', ink: '#3a2618', accent: '#b5562a', font: 'Rye' },
  ];
  const FONTS = ['Cormorant Garamond', 'Playfair Display', 'Cinzel', 'DM Serif Display', 'Great Vibes', 'Caveat', 'Special Elite', 'Orbitron', 'Stardos Stencil', 'Ma Shan Zheng', 'IM Fell English SC',
    'Uncial Antiqua', 'Oswald', 'Rye', 'Pirata One', 'Abril Fatface', 'Libre Baskerville', 'Dancing Script'];
  const BODY_FONT = 'Lora:ital,wght@0,400;0,600;1,400';

  // Episode titles for the built-in shows (family-data.js; only used while the season sizes match).
  const EPISODE_TITLES = (self.FAMILY && self.FAMILY.EPISODE_TITLES) || {};

  // Google Fonts are only loaded when a world that uses them is shown.
  const loaded = new Set();
  function loadFont(spec) {
    if (!spec || loaded.has(spec)) return;
    loaded.add(spec);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${spec.replace(/ /g, '+')}&display=swap`;
    document.head.appendChild(link);
  }

  // ---------- colors for custom worlds ----------
  function rgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, c => c + c) : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function luminance(hex) {
    const [r, g, b] = rgb(hex).map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const isDark = hex => luminance(hex) < 0.2;

  // CSS variables for a custom world (built-ins get theirs from themes.css).
  function customVars(look, photoUrl) {
    const page = isDark(look.bg) ? '#f3efe6' : look.ink;
    const vars = {
      '--bg': look.bg,
      '--page-ink': page,
      '--page-muted': `color-mix(in srgb, ${page} 65%, ${look.bg})`,
      '--card': look.card,
      '--ink': look.ink,
      '--muted': `color-mix(in srgb, ${look.ink} 60%, ${look.card})`,
      '--line': `color-mix(in srgb, ${look.ink} 16%, ${look.card})`,
      '--accent': look.accent,
      '--on-accent': isDark(look.accent) || luminance(look.accent) < 0.35 ? '#fff' : '#1b1b1b',
      '--font-head': `'${look.font}', Georgia, serif`,
      '--font-body': `'Lora', Georgia, serif`,
      // look.tint false = the photo exactly as it is, no background color over it.
      '--bg-img': !photoUrl ? 'none'
        : look.tint === false ? `url("${photoUrl}")`
        : `linear-gradient(color-mix(in srgb, ${look.bg} 72%, transparent), color-mix(in srgb, ${look.bg} 88%, transparent)), url("${photoUrl}")`,
      // Over an untinted photo: no solid band behind the tabs, and a soft shadow so text stays readable.
      ...(photoUrl && look.tint === false ? { '--tabs-bg': 'transparent', '--page-shadow': isDark(look.bg) ? '0 1px 3px rgba(0,0,0,.6), 0 0 12px rgba(0,0,0,.35)' : '0 0 3px rgba(255,255,255,.85), 0 0 12px rgba(255,255,255,.6)', '--page-muted': page } : {}),
    };
    return Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
  }

  function fontsFor(world) {
    if (world.theme === 'custom') return [(world.look && world.look.font) || 'Cormorant Garamond', BODY_FONT];
    return (BUILT_IN[world.theme] || {}).fonts || [];
  }

  // Puts a world's look on an element (the page, a modal, a library tile).
  function apply(el, world) {
    fontsFor(world).forEach(loadFont);
    el.dataset.theme = world.theme;
    if (world.theme === 'custom') el.setAttribute('style', customVars(world.look || PRESETS[0], world.look && world.look.photo && world.look.photo.url));
    else el.removeAttribute('style');
  }

  // A look's title font by name (a built-in world's first font, or the custom look's).
  function headFont(world) {
    if (world.theme === 'custom') return (world.look && world.look.font) || 'Cormorant Garamond';
    const spec = ((BUILT_IN[world.theme] || {}).fonts || [])[0];
    return spec ? spec.split(':')[0] : 'Cormorant Garamond';
  }

  const info = world => BUILT_IN[world.theme] || { label: world.name, empty: 'Nothing here yet.', theEnd: 'The end.' };
  const palette = world => info(world).palette
    || [['Accent', (world.look && world.look.accent) || '#8a6d3b'], ['Ink', (world.look && world.look.ink) || '#333'], ['Rose', '#c07f93'], ['Sky', '#5b8cc0']];

  // ---------- rewatch tracker ----------
  // theme (optional) adds built-in episode titles (family-data.js).
  // One line of a Collection: "Man of Steel (2013)" (a movie) or
  // "Smallville [21, 23, 22]" (a show with that many episodes per season).
  function parseEntry(raw) {
    const show = /^(.*?)\s*\[([\d,\s]+)\]\s*$/.exec(raw);
    const text = show ? show[1] : raw;
    const y = /^(.*\S)\s*\((\d{4})\)$/.exec(text);
    return {
      title: y ? y[1] : text.trim(), year: y ? y[2] : null,
      seasons: show ? show[2].split(/[^0-9]+/).map(Number).filter(n => n > 0) : null,
    };
  }

  function steps(track, theme) {
    if (!track) return [];
    // A Collection: sections (one per character) holding movies and shows, in
    // the order typed. The same title in two sections is the same thing:
    // "same" points at its first place, which is where its watched mark lives.
    if (track.type === 'collection') {
      const bounds = [];
      (track.sections || []).reduce((at, { count }) => { bounds.push(at + count); return at + count; }, 0);
      const out = [], first = {};
      track.items.forEach((raw, idx) => {
        const g = track.sections ? Math.max(0, bounds.findIndex(b => idx < b)) : 0;
        const e = parseEntry(raw);
        const base = (e.year ? `${e.title} (${e.year})` : e.title).toLowerCase();
        const add = (key, step) => {
          if (first[key] == null) first[key] = out.length;
          out.push({ ...step, group: g, entry: idx, key, same: first[key] });
        };
        if (e.seasons) {
          e.seasons.forEach((n, s) => {
            for (let ep = 1; ep <= n; ep++) {
              const key = `${base}|s${s + 1}e${ep}`;
              const at = first[key] ?? out.length;
              add(key, {
                label: `${e.title} · Season ${s + 1}, Episode ${ep}`, short: `S${s + 1} E${ep}`, show: e.title, season: s, e: ep,
                title: (track.titles && track.titles[at]) || null,
              });
            }
          });
        } else {
          add(base, { label: e.title, short: e.year || '', movie: true, title: e.title, year: e.year });
        }
      });
      return out;
    }
    // key: what rewatch notes are filed under (a label, plus its short name when two titles could match).
    if (track.type === 'list') {
      // Optional sections (like Classics / Princesses) and a
      // year at the end of a title, like "Peter Pan (1953)".
      const bounds = [];
      (track.sections || []).reduce((at, { count }) => { bounds.push(at + count); return at + count; }, 0);
      return track.items.map((item, i) => {
        const m = /^(.*\S)\s*\((\d{4})\)$/.exec(item);
        const title = m ? m[1] : item;
        const group = track.sections ? Math.max(0, bounds.findIndex(b => i < b)) : 0;
        const short = (track.labels && track.labels[i])
          || (track.sections ? [track.sections[group].name, m && m[2]].filter(Boolean).join(' · ') : null)
          || (m ? m[2] : `${track.noun || 'Part'} ${i + 1}`);
        return { label: title, short, group, title, key: track.labels ? `${title} (${short})` : item };
      });
    }
    const names = EPISODE_TITLES[theme];
    const named = names && names.length === track.seasons.length && names.every((s, k) => s.length === track.seasons[k]);
    // Some shows count in Books and Chapters instead of Seasons and Episodes.
    const book = track.noun === 'Book';
    const out = [];
    track.seasons.forEach((count, s) => {
      for (let e = 1; e <= count; e++) {
        // Titles someone typed for their own show (track.titles, one per episode in
        // order; a flat list because the database can't store lists inside lists).
        const own = track.titles && track.titles[out.length];
        const title = own || (named ? names[s][e - 1] : null);
        // A season's own name (track.seasonNames, from "# Season 4 Part 2" lines) shows as written.
        const sname = track.seasonNames && track.seasonNames[s];
        const step = book
          ? { label: `Book ${s + 1}, Chapter ${e}`, short: `B${s + 1} Ch${e}`, group: s, e, title, key: `Book ${s + 1}, Chapter ${e}` }
          : { label: `Season ${s + 1}, Episode ${e}`, short: `S${s + 1} E${e}`, group: s, e, title, key: `Season ${s + 1}, Episode ${e}` };
        if (sname) step.label = `${sname}, ${book ? 'Chapter' : 'Episode'} ${e}`;
        out.push(step);
      }
    });
    return out;
  }
  const groupName = (track, g) => (track.type === 'list' || track.type === 'collection'
    ? (track.sections && track.sections[g] ? track.sections[g].name : `${track.noun || 'Part'}s`)
    : (track.seasonNames && track.seasonNames[g]) || `${track.noun || 'Season'} ${g + 1}`);

  // The built-in worlds (family-data.js; none in the App Store app).
  const STARTERS = (self.FAMILY && self.FAMILY.STARTERS) || [];
  const STARTER_ITEMS = (self.FAMILY && self.FAMILY.STARTER_ITEMS) || [];

  return { parseEntry, BUILT_IN, pickable, PRESETS, BOOK_PRESETS, headFont, FONTS, apply, info, palette, steps, groupName, loadFont, isDark, STARTERS, STARTER_ITEMS };
})();
