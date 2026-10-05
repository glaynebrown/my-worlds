/* Which version this is. Same code, same Firebase, same logins:
   - 'family': the website your family uses (built-in looks under their show
     names, starter worlds and books, the invite code).
   - 'store': the App Store app (generic look names, open sign-up, a free trial,
     then "Unlock everything"). Its build sets 'store' and leaves out
     family-data.js. On the website, adding ?edition=store previews it. */
const EDITION = (() => {
  try { return new URLSearchParams(location.search).get('edition') === 'store' ? 'store' : 'family'; } catch { return 'family'; }
})();
const STORE = EDITION === 'store';
