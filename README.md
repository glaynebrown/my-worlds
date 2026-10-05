# My Worlds

A personal fandom app: each world (Avatar, The Walking Dead, Harry Potter, and
any you add) has its own look and these sections:

- **Board**: a mood board of photos from your camera roll
- **Quotes**: tagged by who said it and where
- **Favorites**: ranked characters with a photo, favorite line and notes
- **My Canon** (optional per world): where your story ends, your ending, ships, headcanons
- **Fics**: saved AO3 links with ship and a note to self
- **Rewatch**: where you are, and it stops at your canon ending

**From a photo** (scan.js, books only): in a book's Quote and Note forms, take a
picture of the page; the phone reads it (Tesseract, loaded from jsDelivr the
first time) and you drag across the words you want. A page number it spots fills
Page only if Page is empty. The photo is never saved. Quotes on both sides also
have an optional "Said to".

**Take the tour** (tour.js + tour.css): a guided tour on a pretend phone (sample
doors and books, a glowing spot, an arrow and an info bubble). Everyone sees
both sides' tours once (settings.tourSeen), starting with the side they're on;
after that, "Take the tour" in each side's gear menu replays that side.

**Backup & restore** (backup.js; gear menu on both sides): "Download my data"
saves one .zip on the phone (backup.json, a readable "My Worlds.html", and
photos/ if "Include photos" is ticked). Nothing goes to Firebase. "Restore from
backup" puts back only worlds, books and items whose ids aren't in the app now
(photos re-uploaded from the zip, within the photo limit; shared worlds come
back as your own).

**Shared names:** everyone in a shared world or buddy read can change "Your
name in this world" in its settings; notes and items show each person's current
name (shared.names), so older notes update too.

**Photos offline** (store.js PendingPhotos + sw.js): a photo added with no
signal waits on the phone (IndexedDB) and shows right away (the service worker
serves pending-photo/<id>.jpg); board and favorite photos get a small cloud.
It uploads when there's signal and the app is open, then its real links are
swapped in. Other phones in a shared world see a soft placeholder until then.

**Accessories** (Worlds gear; decor.js + decor.css, fx.js): fairy lights, and
how a world opens: Theater curtains (default), VHS tape (optional "Start with
static"), Old TV (power on), Color bars, or None. "Exit effect" plays on
"‹ Worlds": curtains close; TV, VHS and color bars switch off like an old TV.
Tap skips. Saved in settings.openFx / vhsStatic / exitFx.

Plus a **Books** side (tap the big doorway/book icon at the top to flip sides; settings are under the gear, top right; books.js + books.css):
a wooden bookcase with your shelves (Currently reading / Read / Want to read /
DNF, editable, each with its own sort; hold a book to drag it). Spine thickness
comes from the page count; tap a book and it flies open. Inside: About (cover,
half-star rating, shelf, page progress, reading dates per read with physical /
audiobook), Notes (date + page, or chapter for audiobooks), Quotes (page
optional), Reviews (full + spoiler-free; "Copy for review" makes a prompt for
Claude and "Paste Claude's reply" fills both in), Board, Map (optional, with
pins) and My Canon (optional). Looks per book (book looks, world looks, or your
own colors); series share a look. Books can link to a world ("The books" row on
the world's page). Reading goal + stats at #/books/stats. Buddy reads share a
book like a shared world (stars, dates and reviews stay personal). Book search
uses Open Library (free, no key), with Google Books as a backup.

**Book library:** the books on your (the owner's) bookcase are published to
`library/books` (details, cover, look, spine, map; never stars, dates, notes or
reviews). Everyone who joins picks from it the first time (after picking worlds,
or "No worlds for now") at #/books/pick, and later from "From the library" on
Add a book. Your bookcase starts with A Court of Thorns and Roses, Fourth Wing,
House of Earth and Blood, One Dark Window and The Ever King (each added once;
settings.bookStarters lists them, so new starters in BOOK_STARTERS arrive later).

Plain HTML/CSS/JS + Firebase (Auth, Firestore, Storage), hosted on GitHub Pages.
Until `firebase-config.js` is filled in, the app offers **sample mode** (nothing saved).

## Setup (same steps as A&W / CertKeeper)

1. **Firebase project**: create one at console.firebase.google.com (Blaze plan
   for Storage, with a budget alert).
2. **Authentication** → Email/Password → enable. Add your one user under
   Users. Then Settings → User actions → turn off sign-ups (create) and deletion.
   Settings → Authorized domains → add `glaynebrown.github.io`.
3. **Firestore** and **Storage**: create both, then publish `firestore.rules`
   and `storage.rules` (or `firebase deploy --only firestore:rules,storage`).
4. **Web app**: Project settings → Your apps → add a Web app, and paste its
   config into `firebase-config.js`.
5. **GitHub**: new repo, upload the site files below, then Settings → Pages →
   deploy from the main branch.

The first time you sign in, your three worlds are created for you (TWD ends at
S5 E1, Zutara is on the Avatar ships list, Daryl/Rick/Glenn/Maggie are TWD favorites).

## Site files (upload these to GitHub)

index.html, styles.css, themes.css, books.css, tour.css, decor.css, themes.js, app.js, world.js, share.js, library.js, together.js, books.js, tour.js, scan.js, decor.js, fx.js, backup.js, store.js,
demo.js, photos.js, firebase-config.js, sw.js, manifest.json,
icon-192.png, icon-512.png, apple-touch-icon.png

(`firestore.rules`, `storage.rules`, `firebase.json` are for Firebase, not the site.)

## Adding a world

Use **Add a world** on the library screen (pick a look, colors, title font,
optional background photo, and a tracker). For a fully custom look like the
first three, the theme goes in `themes.css` + `themes.js` as a new built-in.

## Sharing a copy (e.g. with a sister)

1. Signed in as you, open the hidden page `…/my-worlds/#/share`, type her email, send.
   (Copies worlds, looks, trackers, boards, quotes, favorites, ships, headcanons;
   not fics, rewatch notes, wishlist, watched marks, or the Zutara ship. Adds Zukka.)
2. Firebase console → Authentication → Users → Add user with that same email.
3. She signs in; her worlds are built from the copy and the copy is deleted.
   Her data lives under her own users/{uid}; the two accounts never touch.

## Inviting friends (they make their own accounts)

- Invite link: `https://glaynebrown.github.io/my-worlds/?invite=Mellon9`
  ("New here? Create an account" appears on the sign-in screen). The code is
  checked by firestore.rules (`users/{uid}` can only be created with it); to
  change it, edit the rules and redeploy.
- Needs Firebase console → Authentication → Settings → User actions:
  Enable create (sign-up) and Enable deletion both ON.
- New people pick doors from the Library (library.js): built-in worlds start
  neutral but use your home-card photos/name colors (your app publishes them to
  library/wallpapers whenever it opens).
- Everyone except you has a 500-photo limit. "Delete my account" is in the
  gear menu (top right of either side).

## Shared worlds (Step 1: shared Rewatch)

World settings → Share → "Share this world…" → their email + your name. They
must already have an account; the invite pops up the next time they open the
app and joining adds a separate door "<World> (with <you>)". One set of watched
marks for the group; each person's rewatch notes show side by side. Only the
sharer can change the tracker or Stop sharing; others can Leave. Either way
everyone keeps a personal copy (tracker, marks, all notes). Data: shared/{sid}
+ shared/{sid}/notes (firestore.rules), code in together.js.
