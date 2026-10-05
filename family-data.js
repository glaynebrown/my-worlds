/* Family-only content: the website your family uses loads this file; the App
   Store app (EDITION 'store', see edition.js) never includes it, so nothing here
   ships to Apple: show and book names, episode titles, starter worlds and books,
   and the tour's sample screens.

   Read it as self.FAMILY: missing in the App Store app, and null when
   previewing the store edition with ?edition=store. */
var FAMILY = STORE ? null : (() => {
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
    got: [
      ["Winter Is Coming", "The Kingsroad", "Lord Snow", "Cripples, Bastards, and Broken Things", "The Wolf and the Lion", "A Golden Crown", "You Win or You Die", "The Pointy End", "Baelor", "Fire and Blood"],
      ["The North Remembers", "The Night Lands", "What Is Dead May Never Die", "Garden of Bones", "The Ghost of Harrenhal", "The Old Gods and the New", "A Man Without Honor", "The Prince of Winterfell", "Blackwater", "Valar Morghulis"],
      ["Valar Dohaeris", "Dark Wings, Dark Words", "Walk of Punishment", "And Now His Watch Is Ended", "Kissed by Fire", "The Climb", "The Bear and the Maiden Fair", "Second Sons", "The Rains of Castamere", "Mhysa"],
      ["Two Swords", "The Lion and the Rose", "Breaker of Chains", "Oathkeeper", "First of His Name", "The Laws of Gods and Men", "Mockingbird", "The Mountain and the Viper", "The Watchers on the Wall", "The Children"],
      ["The Wars to Come", "The House of Black and White", "High Sparrow", "Sons of the Harpy", "Kill the Boy", "Unbowed, Unbent, Unbroken", "The Gift", "Hardhome", "The Dance of Dragons", "Mother’s Mercy"],
      ["The Red Woman", "Home", "Oathbreaker", "Book of the Stranger", "The Door", "Blood of My Blood", "The Broken Man", "No One", "Battle of the Bastards", "The Winds of Winter"],
      ["Dragonstone", "Stormborn", "The Queen’s Justice", "The Spoils of War", "Eastwatch", "Beyond the Wall", "The Dragon and the Wolf"],
      ["Winterfell", "A Knight of the Seven Kingdoms", "The Long Night", "The Last of the Starks", "The Bells", "The Iron Throne"],
    ],
    tlou: [
      ["When You’re Lost in the Darkness", "Infected", "Long, Long Time", "Please Hold to My Hand", "Endure and Survive", "Kin", "Left Behind", "When We Are in Need", "Look for the Light"],
    ],
  };

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
  STARTERS.push({
    name: 'Game of Thrones', theme: 'got', canonOn: true, cutoff: null, ending: '',
    track: { type: 'episodes', seasons: [10, 10, 10, 10, 10, 10, 7, 6] },
  });
  STARTERS.push({
    name: 'Firefly', theme: 'firefly', canonOn: true, cutoff: null, ending: '',
    // The episodes in the order they were meant to be seen, then the movie.
    track: {
      type: 'list', noun: 'Episode',
      items: ['Serenity', 'The Train Job', 'Bushwhacked', 'Shindig', 'Safe', 'Our Mrs. Reynolds', 'Jaynestown', 'Out of Gas',
        'Ariel', 'War Stories', 'Trash', 'The Message', 'Heart of Gold', 'Objects in Space', 'Serenity'],
      labels: ['Episode 1 (the pilot)', 'Episode 2', 'Episode 3', 'Episode 4', 'Episode 5', 'Episode 6', 'Episode 7', 'Episode 8',
        'Episode 9', 'Episode 10', 'Episode 11', 'Episode 12', 'Episode 13', 'Episode 14', 'The movie'],
    },
  });
  STARTERS.push({
    name: 'The Last of Us', theme: 'tlou', canonOn: true, cutoff: null, ending: '',
    track: { type: 'episodes', seasons: [9] }, // Season 1 only
  });
  STARTERS.push({
    name: 'Pirates of the Caribbean', theme: 'potc', canonOn: true, cutoff: null, ending: '',
    track: { type: 'list', noun: 'Film', items: ['The Curse of the Black Pearl', 'Dead Man’s Chest', 'At World’s End', 'On Stranger Tides'] },
  });
  STARTERS.push({
    name: 'Disney', theme: 'disney', canonOn: false, cutoff: null, ending: '',
    track: {
      type: 'list', noun: 'Movie', shuffle: true,
      // (Stored as objects: the database can't save a list inside a list.)
      sections: [{ name: 'Classics', count: 24 }, { name: 'Princesses', count: 12 }, { name: 'Pixar & friends', count: 11 }],
      items: [
        'Pinocchio (1940)', 'Dumbo (1941)', 'Bambi (1942)', 'Alice in Wonderland (1951)', 'Peter Pan (1953)', 'Lady and the Tramp (1955)',
        '101 Dalmatians (1961)', 'The Sword in the Stone (1963)', 'The Jungle Book (1967)', 'The Aristocats (1970)', 'Robin Hood (1973)',
        'The Rescuers (1977)', 'The Fox and the Hound (1981)', 'The Great Mouse Detective (1986)', 'Oliver & Company (1988)',
        'The Lion King (1994)', 'The Hunchback of Notre Dame (1996)', 'Hercules (1997)', 'Tarzan (1999)', 'The Emperor’s New Groove (2000)',
        'Atlantis: The Lost Empire (2001)', 'Lilo & Stitch (2002)', 'Treasure Planet (2002)', 'Brother Bear (2003)',
        'Snow White and the Seven Dwarfs (1937)', 'Cinderella (1950)', 'Sleeping Beauty (1959)', 'The Little Mermaid (1989)',
        'Beauty and the Beast (1991)', 'Aladdin (1992)', 'Pocahontas (1995)', 'Mulan (1998)', 'The Princess and the Frog (2009)',
        'Tangled (2010)', 'Brave (2012)', 'Moana (2016)',
        'Toy Story (1995)', 'Anastasia (1997)', 'A Bug’s Life (1998)', 'Monsters, Inc. (2001)', 'Shrek (2001)',
        'Spirit: Stallion of the Cimarron (2002)', 'Finding Nemo (2003)', 'The Incredibles (2004)', 'Cars (2006)', 'Up (2009)', 'Onward (2020)',
      ],
    },
  });
  STARTERS.push({
    name: 'Narnia', theme: 'narnia', canonOn: false, cutoff: null, ending: '',
    track: { type: 'list', noun: 'Film', items: ['The Lion, the Witch and the Wardrobe', 'Prince Caspian', 'The Voyage of the Dawn Treader'] },
  });

  // Added the first time you sign in, alongside STARTERS (by index).
  const STARTER_ITEMS = [
    { world: 0, kind: 'ship', name: 'Zutara', note: 'Endgame.', colors: ['#b8352b', '#2f6f9f'] },
    { world: 1, kind: 'fav', name: 'Daryl Dixon', order: 0 },
    { world: 1, kind: 'fav', name: 'Rick Grimes', order: 1 },
    { world: 1, kind: 'fav', name: 'Glenn Rhee', order: 2 },
    { world: 1, kind: 'fav', name: 'Maggie Greene', order: 3 },
  ];

  // The three books your bookcase starts with (added once, to your account only).
  const BOOK_STARTERS = [
    {
      title: 'A Court of Thorns and Roses', author: 'Sarah J. Maas', series: 'A Court of Thorns and Roses', seriesNo: '1', pages: 419,
      coverUrl: 'https://covers.openlibrary.org/b/id/15102579-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/15102579-M.jpg',
      blurb: 'When nineteen-year-old huntress Feyre kills a wolf in the woods, a beastly creature comes to demand a life for a life and carries her off to Prythian, the land of the faeries. Her captor isn’t what he seems, and the shadow spreading over the faerie lands may soon reach them all.',
      theme: 'custom', look: { bg: '#2a1418', card: '#fbf1ee', ink: '#2e1a1c', accent: '#b3263a', font: 'Cinzel' },
      spineFont: 'Cinzel', spineInk: '#f3e3c3', spineBg: '#8f1426', spineOrn: 'rose',
    },
    // The rest of A Court of Thorns and Roses (each spine the color of its cover).
    {
      title: 'A Court of Mist and Fury', author: 'Sarah J. Maas', series: 'A Court of Thorns and Roses', seriesNo: '2', pages: 626,
      coverUrl: 'https://covers.openlibrary.org/b/id/13802801-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/13802801-M.jpg',
      blurb: 'Feyre survived Under the Mountain, but she can’t shake what it cost her. As she struggles with the darkness she carried home, a bargain she once made pulls her to the Night Court and its High Lord, Rhysand, just as a threat from across the sea begins to stir.',
      theme: 'custom', look: { bg: '#2a1418', card: '#fbf1ee', ink: '#2e1a1c', accent: '#b3263a', font: 'Cinzel' },
      spineFont: 'Cinzel', spineInk: '#f3e3c3', spineBg: '#127a70', spineOrn: 'rose',
    },
    {
      title: 'A Court of Wings and Ruin', author: 'Sarah J. Maas', series: 'A Court of Thorns and Roses', seriesNo: '3', pages: 720,
      coverUrl: 'https://covers.openlibrary.org/b/id/15102352-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/15102352-M.jpg',
      blurb: 'War is coming to Prythian. Feyre plays a dangerous game behind enemy lines while the High Lords must decide whose side they’re on before the King of Hybern’s armies arrive.',
      theme: 'custom', look: { bg: '#2a1418', card: '#fbf1ee', ink: '#2e1a1c', accent: '#b3263a', font: 'Cinzel' },
      spineFont: 'Cinzel', spineInk: '#f3e3c3', spineBg: '#9c2668', spineOrn: 'rose',
    },
    {
      title: 'A Court of Frost and Starlight', author: 'Sarah J. Maas', series: 'A Court of Thorns and Roses', seriesNo: '3.5', pages: 259,
      coverUrl: 'https://covers.openlibrary.org/b/id/14348662-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/14348662-M.jpg',
      blurb: 'A short winter story set after the war: Feyre and her friends rebuild their city and celebrate the Winter Solstice, while old wounds quietly come to the surface.',
      theme: 'custom', look: { bg: '#2a1418', card: '#fbf1ee', ink: '#2e1a1c', accent: '#b3263a', font: 'Cinzel' },
      spineFont: 'Cinzel', spineInk: '#f3e3c3', spineBg: '#1f7fae', spineOrn: 'rose',
    },
    {
      title: 'A Court of Silver Flames', author: 'Sarah J. Maas', series: 'A Court of Thorns and Roses', seriesNo: '4', pages: 768,
      coverUrl: 'https://covers.openlibrary.org/b/id/13316179-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/13316179-M.jpg',
      blurb: 'Nesta Archeron has been spiraling since the war: drinking, fighting, shutting everyone out. Sent to train with the warrior Cassian, she finds something she never expected, just as a new danger rises that could undo everything they fought for.',
      theme: 'custom', look: { bg: '#2a1418', card: '#fbf1ee', ink: '#2e1a1c', accent: '#b3263a', font: 'Cinzel' },
      spineFont: 'Cinzel', spineInk: '#f3e3c3', spineBg: '#c45a14', spineOrn: 'rose',
    },
    // Rebel of the Sands (desert, gunslingers and djinni).
    {
      title: 'Rebel of the Sands', author: 'Alwyn Hamilton', series: 'Rebel of the Sands', seriesNo: '1', pages: 314,
      coverUrl: 'https://covers.openlibrary.org/b/id/8458747-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/8458747-M.jpg',
      blurb: 'Amani Al’Hiza is a sharpshooter stuck in a dead-end desert town with no future. Desperate to get out, she enters a shooting contest, meets Jin, a mysterious foreigner on the run, and is swept across a desert full of djinni, magic and rebellion against the Sultan.',
      theme: 'custom', look: { bg: '#2e1c12', card: '#f6ead6', ink: '#33200f', accent: '#d07a2a', font: 'Rye' },
      spineFont: 'Rye', spineInk: '#f2d9a6', spineBg: '#5a2416', spineOrn: 'sun',
    },
    {
      title: 'Traitor to the Throne', author: 'Alwyn Hamilton', series: 'Rebel of the Sands', seriesNo: '2', pages: 518,
      coverUrl: 'https://covers.openlibrary.org/b/id/8738907-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/8738907-M.jpg',
      blurb: 'Amani has become a legend of the rebellion. When a mission goes wrong and she lands inside the Sultan’s palace, she has to spy from within its walls, and starts to learn the Sultan may not be the villain she thought.',
      theme: 'custom', look: { bg: '#2e1c12', card: '#f6ead6', ink: '#33200f', accent: '#d07a2a', font: 'Rye' },
      spineFont: 'Rye', spineInk: '#f2d9a6', spineBg: '#8a5a2b', spineOrn: 'sun',
    },
    {
      title: 'Hero at the Fall', author: 'Alwyn Hamilton', series: 'Rebel of the Sands', seriesNo: '3', pages: 466,
      coverUrl: 'https://covers.openlibrary.org/b/id/8798051-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/8798051-M.jpg',
      blurb: 'The rebellion has been shattered, and it falls to Amani to lead what’s left of it. To save the people she loves and the desert she calls home, she has to face the Sultan one last time, and decide what she’s willing to lose to win.',
      theme: 'custom', look: { bg: '#2e1c12', card: '#f6ead6', ink: '#33200f', accent: '#d07a2a', font: 'Rye' },
      spineFont: 'Rye', spineInk: '#f2d9a6', spineBg: '#3d2f4a', spineOrn: 'sun',
    },
    {
      title: 'The 100', author: 'Kass Morgan', series: 'The 100', seriesNo: '1', pages: 323,
      coverUrl: 'https://covers.openlibrary.org/b/id/9257624-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/9257624-M.jpg',
      blurb: 'Centuries after nuclear war drove humanity into space, a hundred teenage prisoners are sent down to Earth to find out whether it can be lived on again. Clarke, Wells, Bellamy and Glass each carry secrets of their own, and as the hundred fight to survive on a planet no one has seen in three hundred years, those secrets threaten to tear them apart.',
      theme: 'custom', look: { bg: '#0b0d17', card: '#1a1d30', ink: '#e7e9f3', accent: '#5fc4e8', font: 'Orbitron' },
      spineFont: 'Orbitron', spineInk: '#e8edf2', spineBg: '#16181d', spineOrn: 'star',
    },
    // The rest of The 100 (each spine the color of its cover).
    {
      title: 'Day 21', author: 'Kass Morgan', series: 'The 100', seriesNo: '2', pages: 320,
      coverUrl: 'https://covers.openlibrary.org/b/id/8999988-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/8999988-M.jpg',
      blurb: 'Twenty-one days after landing, the hundred are still fighting to survive, and when one of them goes missing they start to suspect they aren’t alone on Earth. Up on the Colony, Glass and Luke race against an air supply that is running out.',
      theme: 'custom', look: { bg: '#0b0d17', card: '#1a1d30', ink: '#e7e9f3', accent: '#5fc4e8', font: 'Orbitron' },
      spineFont: 'Orbitron', spineInk: '#1d2328', spineBg: '#b9c6cc', spineOrn: 'star',
    },
    {
      title: 'Homecoming', author: 'Kass Morgan', series: 'The 100', seriesNo: '3', pages: 352,
      coverUrl: 'https://covers.openlibrary.org/b/id/10372364-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/10372364-M.jpg',
      blurb: 'Ships from the Colony finally reach the ground, but the reunion is anything but peaceful. As the newcomers try to take charge, Clarke, Wells and Bellamy have to decide who they can trust, while Earth’s other survivors make a move of their own.',
      theme: 'custom', look: { bg: '#0b0d17', card: '#1a1d30', ink: '#e7e9f3', accent: '#5fc4e8', font: 'Orbitron' },
      spineFont: 'Orbitron', spineInk: '#e8edf2', spineBg: '#3a3029', spineOrn: 'star',
    },
    {
      title: 'Rebellion', author: 'Kass Morgan', series: 'The 100', seriesNo: '4', pages: 305,
      coverUrl: 'https://covers.openlibrary.org/b/id/8453489-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/8453489-M.jpg',
      blurb: 'The hundred have finally made a home on Earth, until strangers attack the camp and carry some of them off. Clarke and Bellamy set out to bring their friends back and find a group with its own plans for the land and everyone on it.',
      theme: 'custom', look: { bg: '#0b0d17', card: '#1a1d30', ink: '#e7e9f3', accent: '#5fc4e8', font: 'Orbitron' },
      spineFont: 'Orbitron', spineInk: '#e8edf2', spineBg: '#4a5a3c', spineOrn: 'star',
    },
    // The Lord of the Rings and The Hobbit (the black ring editions; linked to the Lord of the Rings world).
    {
      title: 'The Hobbit', author: 'J.R.R. Tolkien', series: '', seriesNo: '', pages: 300,
      coverUrl: 'https://covers.openlibrary.org/b/id/14624642-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/14624642-M.jpg',
      blurb: 'Bilbo Baggins is a comfortable, unadventurous hobbit, until the wizard Gandalf and thirteen dwarves turn up at his door. Swept off on a quest to win back the dwarves’ treasure from the dragon Smaug, he finds trolls, goblins, giant spiders, a strange creature named Gollum, and a small gold ring that will change everything.',
      theme: 'lotr', worldTheme: 'lotr',
      spineFont: 'Cinzel', spineInk: '#d9a83a', spineBg: '#17150f', spineOrn: 'dragon',
    },
    {
      title: 'The Fellowship of the Ring', author: 'J.R.R. Tolkien', series: 'The Lord of the Rings', seriesNo: '1', pages: 432,
      coverUrl: 'https://covers.openlibrary.org/b/id/15173637-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/15173637-M.jpg',
      blurb: 'The ring Bilbo found turns out to be the One Ring of the Dark Lord Sauron. Frodo Baggins inherits it, and with eight companions sets out on a desperate journey to destroy it in the fires of Mount Doom before Sauron can reclaim it.',
      theme: 'lotr', worldTheme: 'lotr',
      spineFont: 'Cinzel', spineInk: '#d9a83a', spineBg: '#17150f', spineOrn: 'leaf',
    },
    {
      title: 'The Two Towers', author: 'J.R.R. Tolkien', series: 'The Lord of the Rings', seriesNo: '2', pages: 352,
      coverUrl: 'https://covers.openlibrary.org/b/id/14349269-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/14349269-M.jpg',
      blurb: 'The Fellowship is broken. While Aragorn, Legolas and Gimli chase the orcs who took their friends and are drawn into the war for Rohan, Frodo and Sam push on toward Mordor with a treacherous guide: Gollum.',
      theme: 'lotr', worldTheme: 'lotr',
      spineFont: 'Cinzel', spineInk: '#d6453b', spineBg: '#17150f', spineOrn: 'leaf',
    },
    {
      title: 'The Return of the King', author: 'J.R.R. Tolkien', series: 'The Lord of the Rings', seriesNo: '3', pages: 416,
      coverUrl: 'https://covers.openlibrary.org/b/isbn/9780547928197-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/isbn/9780547928197-M.jpg',
      blurb: 'The war for Middle-earth reaches its end. As the armies of the West make their last stand against Sauron, Frodo and Sam take the final, hardest steps into Mordor carrying the Ring.',
      theme: 'lotr', worldTheme: 'lotr',
      spineFont: 'Cinzel', spineInk: '#6cb36c', spineBg: '#17150f', spineOrn: 'leaf',
    },
    {
      title: 'Fourth Wing', author: 'Rebecca Yarros', series: 'The Empyrean', seriesNo: '1', pages: 518,
      coverUrl: 'https://covers.openlibrary.org/b/id/14407898-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/14407898-M.jpg',
      blurb: 'Violet Sorrengail expected a quiet life as a scribe, until her mother, the commanding general, orders her into Basgiath War College to train as a dragon rider. Smaller and more fragile than the other cadets, Violet has to outthink her rivals, earn a dragon’s bond, and survive Xaden Riorson, a wingleader with every reason to want her dead.',
      theme: 'custom', look: { bg: '#e6d7b5', card: '#fbf4e2', ink: '#3a2c1b', accent: '#8c5a2b', font: 'Uncial Antiqua' },
      spineFont: 'Uncial Antiqua', spineInk: '#2b2118', spineBg: '#e9dcc0', spineOrn: 'dragon',
    },
    {
      title: 'House of Earth and Blood', author: 'Sarah J. Maas', series: 'Crescent City', seriesNo: '1', pages: 803,
      coverUrl: 'https://covers.openlibrary.org/b/id/9289603-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/9289603-M.jpg',
      blurb: 'Bryce Quinlan’s life in Crescent City is all late nights and half-Fae charm, until a demon murders her closest friends. Two years later the killings start again, and Bryce is forced to team up with Hunt Athalar, a fallen angel bound to serve the city’s rulers, to find the killer before the whole city burns.',
      theme: 'custom', look: { bg: '#1a1020', card: '#f7f1ee', ink: '#2a1a22', accent: '#c8281e', font: 'Playfair Display' },
      spineFont: 'Playfair Display', spineInk: '#b5121b', spineBg: '#f2ede6', spineOrn: 'moon',
    },
    {
      title: 'One Dark Window', author: 'Rachel Gillig', series: 'The Shepherd King', seriesNo: '1', pages: 400,
      coverUrl: 'https://covers.openlibrary.org/b/id/12431959-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/12431959-M.jpg',
      blurb: 'Elspeth Spindle shares her head with an ancient, unpredictable spirit she calls the Nightmare. He keeps her safe and keeps her secrets, but magic always has a price. When she crosses paths with a mysterious highwayman on the forest road, she is pulled into a dangerous quest to rid her mist-bound kingdom of its dark magic, just as the Nightmare begins to take over her mind.',
      theme: 'custom', look: { bg: '#1c2421', card: '#eef0ea', ink: '#1e2622', accent: '#a3272b', font: 'IM Fell English SC' },
      spineFont: 'IM Fell English SC', spineInk: '#d8cfb4', spineBg: '#26332e', spineOrn: 'branches',
    },
    {
      title: 'The Ever King', author: 'L.J. Andrews', series: 'The Ever Seas', seriesNo: '1', pages: 480,
      coverUrl: 'https://covers.openlibrary.org/b/id/15259740-L.jpg', coverThumb: 'https://covers.openlibrary.org/b/id/15259740-M.jpg',
      blurb: 'Princess Livia Ferus accidentally breaks open the magical barrier on the sea, setting free Erik Bloodsinger, the feared pirate king of the Ever. He takes her captive to use against her father, but the two share a childhood secret, matching magical marks, and a pull neither of them can ignore. Pirates, sea fae and old hatreds, ending on a cliffhanger.',
      theme: 'custom', look: { bg: '#0f2f30', card: '#f1f4ef', ink: '#16292a', accent: '#c49a45', font: 'Cinzel' },
      spineFont: 'Cinzel', spineInk: '#e2c27a', spineBg: '#14504f', spineOrn: 'sword',
    },
  ];

  // The built-in looks under their show names (themes.js has the App Store names).
  const LOOKS = {
    avatar: { label: 'Avatar' },
    twd: { label: 'The Walking Dead', empty: 'Nothing here yet. Just walkers.' },
    hp: { label: 'Harry Potter', empty: 'Mischief managed. Nothing here yet.' },
    lotr: { label: 'The Lord of the Rings' },
    got: { label: 'Game of Thrones', empty: 'Nothing here yet. Winter is coming.' },
    firefly: { label: 'Firefly', empty: 'Nothing here yet. Keep flying.' },
    tlou: { label: 'The Last of Us', empty: 'Nothing here yet. Endure and survive.' },
    potc: { label: 'Pirates of the Caribbean', empty: 'Nothing here yet. Savvy?' },
    disney: { label: 'Disney', empty: 'Nothing here yet. Wish upon a star.' },
    narnia: { label: 'Narnia', empty: 'Nothing here yet. Step through the wardrobe.', palette: [['Lion gold', '#c8963e'], ['Narnian red', '#9e2b2b'], ['Winter', '#6f93b8'], ['Forest', '#4f6f4a']] },
  };

  // Defaults for the short series names on the bookcase's plates.
  const SERIES_SHORT = { 'a court of thorns and roses': 'ACOTAR', 'the lord of the rings': 'LOTR' };

  // The tour's sample screens (tour.js has generic ones for the App Store app).
  const TOUR = {
    doors: ['avatar', 'hp', 'lotr', 'twd'],
    world: { theme: 'avatar', now: 'The Southern Air Temple', at: 'Book One, Episode 3', total: 61 },
    canon: { theme: 'twd', endAt: 'S5 E1 · No Sanctuary', ending: 'They walk out of Terminus together, and nobody else gets left behind.', headcanon: 'Daryl keeps every one of the kids’ drawings in his saddlebag.' },
    bookTitles: ['A Court of Thorns and Roses', 'A Court of Mist and Fury', 'A Court of Wings and Ruin', 'Fourth Wing', 'House of Earth and Blood'],
    quote: { text: '“To the stars who listen, and the dreams that are answered.”', by: 'Rhysand to Feyre, p. 312' },
    notes: [['Sep 28', 'p. 112', 'Tamlin’s masks!! And the Suriel scene was so creepy.'], ['Sep 30', 'p. 241', 'Calanmai… not sure how I feel about this.'], ['Oct 2', 'p. 356', 'Rhysand stealing every scene he’s in.']],
  };

  return { EPISODE_TITLES, STARTERS, STARTER_ITEMS, BOOK_STARTERS, SERIES_SHORT, TOUR, LOOKS, SHIP_HINT: 'Zutara' };
})();
