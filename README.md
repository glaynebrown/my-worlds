# My Worlds

A personal fandom app: each world (Avatar, The Walking Dead, Harry Potter, and
any you add) has its own look and these sections:

- **Board**: a mood board of photos from your camera roll
- **Quotes**: tagged by who said it and where
- **Favorites**: ranked characters with a photo, favorite line and notes
- **My Canon** (optional per world): where your story ends, your ending, ships, headcanons
- **Fics**: saved AO3 links with ship and a note to self
- **Rewatch**: where you are, and it stops at your canon ending

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

index.html, styles.css, themes.css, themes.js, app.js, world.js, store.js,
demo.js, photos.js, firebase-config.js, sw.js, manifest.json,
icon-192.png, icon-512.png, apple-touch-icon.png

(`firestore.rules`, `storage.rules`, `firebase.json` are for Firebase, not the site.)

## Adding a world

Use **Add a world** on the library screen (pick a look, colors, title font,
optional background photo, and a tracker). For a fully custom look like the
first three, the theme goes in `themes.css` + `themes.js` as a new built-in.
