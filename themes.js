/* The look and structure of each world.

   Built-in worlds (Avatar, TWD, Harry Potter) have hand-made themes in
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
      label: 'Avatar',
      fonts: ['Ma Shan Zheng', 'Spectral:ital,wght@0,400;0,600;1,400'],
      empty: 'An empty scroll, waiting for ink.',
      // Two-color ship cards pick from these.
      palette: [['Fire', '#b8352b'], ['Water', '#2f6f9f'], ['Earth', '#5e7d3a'], ['Air', '#d98b2b']],
      // Each section takes on a nation's color.
      tabColors: { board: '#d98b2b', quotes: '#2f6f9f', favs: '#5e7d3a', canon: '#b8352b', fics: '#2f6f9f', rewatch: '#5e7d3a' },
      theEnd: 'The end.',
    },
    twd: {
      label: 'The Walking Dead',
      fonts: ['Stardos Stencil:wght@400;700', 'Special Elite', 'Permanent Marker'],
      empty: 'Nothing here yet. Just walkers.',
      palette: [['Blood', '#8e2a1c'], ['Olive', '#6b6b3a'], ['Rust', '#a0522d'], ['Ash', '#7d7a70']],
      theEnd: 'The end.',
      notCanon: 'The timeline that didn’t happen',
    },
    hp: {
      label: 'Harry Potter',
      fonts: ['IM Fell English SC', 'IM Fell English:ital@0;1', 'EB Garamond:ital,wght@0,400;0,600;1,400'],
      empty: 'Mischief managed. Nothing here yet.',
      palette: [['Scarlet', '#740001'], ['Gold', '#b8891c'], ['Emerald', '#1a472a'], ['Midnight', '#222f5b']],
      theEnd: 'The end.',
    },
    lotr: {
      label: 'The Lord of the Rings',
      fonts: ['Uncial Antiqua', 'Alegreya:ital,wght@0,400;0,600;1,400'],
      empty: 'An empty page, waiting for a tale.',
      palette: [['Gold', '#b8913a'], ['Elven', '#6f8fa8'], ['Shire', '#5f7d3c'], ['Ember', '#a8431f']],
      theEnd: 'The end.',
    },
  };

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
  const FONTS = ['Cormorant Garamond', 'Playfair Display', 'Cinzel', 'DM Serif Display', 'Great Vibes', 'Caveat', 'Special Elite', 'Orbitron', 'Stardos Stencil', 'Ma Shan Zheng', 'IM Fell English SC'];
  const BODY_FONT = 'Lora:ital,wght@0,400;0,600;1,400';

  // Episode titles for the built-in shows (only used while the season sizes match).
  const EPISODE_TITLES = {
    avatar: [
      ["The Boy in the Iceberg", "The Avatar Returns", "The Southern Air Temple", "The Warriors of Kyoshi", "The King of Omashu", "Imprisoned", "Winter Solstice, Part 1: The Spirit World", "Winter Solstice, Part 2: Avatar Roku", "The Waterbending Scroll", "Jet", "The Great Divide", "The Storm", "The Blue Spirit", "The Fortuneteller", "Bato of the Water Tribe", "The Deserter", "The Northern Air Temple", "The Waterbending Master", "The Siege of the North, Part 1", "The Siege of the North, Part 2"],
      ["The Avatar State", "The Cave of Two Lovers", "Return to Omashu", "The Swamp", "Avatar Day", "The Blind Bandit", "Zuko Alone", "The Chase", "Bitter Work", "The Library", "The Desert", "The Serpent’s Pass", "The Drill", "City of Walls and Secrets", "Tales of Ba Sing Se", "Appa’s Lost Days", "Lake Laogai", "The Earth King", "The Guru", "The Crossroads of Destiny"],
      ["The Awakening", "The Headband", "The Painted Lady", "Sokka’s Master", "The Beach", "The Avatar and the Fire Lord", "The Runaway", "The Puppetmaster", "Nightmares and Daydreams", "The Day of Black Sun, Part 1: The Invasion", "The Day of Black Sun, Part 2: The Eclipse", "The Western Air Temple", "The Firebending Masters", "The Boiling Rock, Part 1", "The Boiling Rock, Part 2", "The Southern Raiders", "The Ember Island Players", "Sozin’s Comet, Part 1: The Phoenix King", "Sozin’s Comet, Part 2: The Old Masters", "Sozin’s Comet, Part 3: Into the Inferno", "Sozin’s Comet, Part 4: Avatar Aang"],
    ],
    twd: [
      ["Days Gone Bye", "Guts", "Tell It to the Frogs", "Vatos", "Wildfire", "TS-19"],
      ["What Lies Ahead", "Bloodletting", "Save the Last One", "Cherokee Rose", "Chupacabra", "Secrets", "Pretty Much Dead Already", "Nebraska", "Triggerfinger", "18 Miles Out", "Judge, Jury, Executioner", "Better Angels", "Beside the Dying Fire"],
      ["Seed", "Sick", "Walk with Me", "Killer Within", "Say the Word", "Hounded", "When the Dead Come Knocking", "Made to Suffer", "The Suicide King", "Home", "I Ain’t a Judas", "Clear", "Arrow on the Doorpost", "Prey", "This Sorrowful Life", "Welcome to the Tombs"],
      ["30 Days Without an Accident", "Infected", "Isolation", "Indifference", "Internment", "Live Bait", "Dead Weight", "Too Far Gone", "After", "Inmates", "Claimed", "Still", "Alone", "The Grove", "Us", "A"],
      ["No Sanctuary", "Strangers", "Four Walls and a Roof", "Slabtown", "Self Help", "Consumed", "Crossed", "Coda", "What Happened and What’s Going On", "Them", "The Distance", "Remember", "Forget", "Spend", "Try", "Conquer"],
      ["First Time Again", "JSS", "Thank You", "Here’s Not Here", "Now", "Always Accountable", "Heads Up", "Start to Finish", "No Way Out", "The Next World", "Knots Untie", "Not Tomorrow Yet", "The Same Boat", "Twice as Far", "East", "Last Day on Earth"],
      ["The Day Will Come When You Won’t Be", "The Well", "The Cell", "Service", "Go Getters", "Swear", "Sing Me a Song", "Hearts Still Beating", "Rock in the Road", "New Best Friends", "Hostiles and Calamities", "Say Yes", "Bury Me Here", "The Other Side", "Something They Need", "The First Day of the Rest of Your Life"],
      ["Mercy", "The Damned", "Monsters", "Some Guy", "The Big Scary U", "The King, the Widow, and Rick", "Time for After", "How It’s Gotta Be", "Honor", "The Lost and the Plunderers", "Dead or Alive Or", "The Key", "Do Not Send Us Astray", "Still Gotta Mean Something", "Worth", "Wrath"],
      ["A New Beginning", "The Bridge", "Warning Signs", "The Obliged", "What Comes After", "Who Are You Now?", "Stradivarius", "Evolution", "Adaptation", "Omega", "Bounty", "Guardians", "Chokepoint", "Scars", "The Calm Before", "The Storm"],
      ["Lines We Cross", "We Are the End of the World", "Ghosts", "Silence the Whisperers", "What It Always Is", "Bonds", "Open Your Eyes", "The World Before", "Squeeze", "Stalker", "Morning Star", "Walk with Us", "What We Become", "Look at the Flowers", "The Tower", "A Certain Doom", "Home Sweet Home", "Find Me", "One More", "Splinter", "Diverged", "Here’s Negan"],
      ["Acheron: Part I", "Acheron: Part II", "Hunted", "Rendition", "Out of the Ashes", "On the Inside", "Promises Broken", "For Blood", "No Other Way", "New Haunts", "Rogue Element", "The Lucky Ones", "Warlords", "The Rotten Core", "Trust", "Acts of God", "Lockdown", "A New Deal", "Variant", "What’s Been Lost", "Outpost 22", "Faith", "Family", "Rest in Peace"],
    ],
  };

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
      '--bg-img': photoUrl
        ? `linear-gradient(color-mix(in srgb, ${look.bg} 72%, transparent), color-mix(in srgb, ${look.bg} 88%, transparent)), url("${photoUrl}")`
        : 'none',
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

  const info = world => BUILT_IN[world.theme] || { label: world.name, empty: 'Nothing here yet.', theEnd: 'The end.' };
  const palette = world => info(world).palette
    || [['Accent', (world.look && world.look.accent) || '#8a6d3b'], ['Ink', (world.look && world.look.ink) || '#333'], ['Rose', '#c07f93'], ['Sky', '#5b8cc0']];

  // ---------- rewatch tracker ----------
  // theme (optional) adds episode titles for Avatar and TWD.
  function steps(track, theme) {
    if (!track) return [];
    if (track.type === 'list') return track.items.map((title, i) => ({ label: title, short: `${track.noun || 'Part'} ${i + 1}`, group: 0, title }));
    const names = EPISODE_TITLES[theme];
    const named = names && names.length === track.seasons.length && names.every((s, k) => s.length === track.seasons[k]);
    // Avatar counts in Books and Chapters instead of Seasons and Episodes.
    const book = track.noun === 'Book';
    const out = [];
    track.seasons.forEach((count, s) => {
      for (let e = 1; e <= count; e++) {
        const title = named ? names[s][e - 1] : null;
        out.push(book
          ? { label: `Book ${s + 1}, Chapter ${e}`, short: `B${s + 1} Ch${e}`, group: s, e, title }
          : { label: `Season ${s + 1}, Episode ${e}`, short: `S${s + 1} E${e}`, group: s, e, title });
      }
    });
    return out;
  }
  const groupName = (track, g) => (track.type === 'list' ? `${track.noun || 'Part'}s` : `${track.noun || 'Season'} ${g + 1}`);

  // The three worlds you start with.
  const STARTERS = [
    {
      name: 'Avatar: The Last Airbender', theme: 'avatar', canonOn: true, cutoff: null, ending: '',
      canonParts: { ending: false, ships: true, headcanons: false },
      track: { type: 'episodes', seasons: [20, 20, 21], noun: 'Book' },
    },
    {
      name: 'The Walking Dead', theme: 'twd', canonOn: true, cutoff: 6 + 13 + 16 + 16, ending: '',
      track: { type: 'episodes', seasons: [6, 13, 16, 16, 16, 16, 16, 16, 16, 22, 24] },
    },
    {
      name: 'Harry Potter', theme: 'hp', canonOn: false, cutoff: null, ending: '',
      track: {
        type: 'list', noun: 'Film', items: [
          'Harry Potter and the Sorcerer’s Stone', 'Harry Potter and the Chamber of Secrets',
          'Harry Potter and the Prisoner of Azkaban', 'Harry Potter and the Goblet of Fire',
          'Harry Potter and the Order of the Phoenix', 'Harry Potter and the Half-Blood Prince',
          'Harry Potter and the Deathly Hallows – Part 1', 'Harry Potter and the Deathly Hallows – Part 2',
        ],
      },
    },
  ];
  // (Built-ins added later go at the end; see seedStarters in app.js.)
  STARTERS.push({
    name: 'The Lord of the Rings', theme: 'lotr', canonOn: false, cutoff: null, ending: '',
    track: { type: 'list', noun: 'Film', items: ['The Fellowship of the Ring', 'The Two Towers', 'The Return of the King'] },
  });

  // Added the first time you sign in, alongside STARTERS (by index).
  const STARTER_ITEMS = [
    { world: 0, kind: 'ship', name: 'Zutara', note: 'Endgame.', colors: ['#b8352b', '#2f6f9f'] },
    { world: 1, kind: 'fav', name: 'Daryl Dixon', order: 0 },
    { world: 1, kind: 'fav', name: 'Rick Grimes', order: 1 },
    { world: 1, kind: 'fav', name: 'Glenn Rhee', order: 2 },
    { world: 1, kind: 'fav', name: 'Maggie Greene', order: 3 },
  ];

  return { BUILT_IN, PRESETS, FONTS, apply, info, palette, steps, groupName, loadFont, isDark, STARTERS, STARTER_ITEMS };
})();
