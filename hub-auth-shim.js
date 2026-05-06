//
//  hub-auth-shim.js
//
//  Drop-in auth gate for R&D tools that share an origin with hub.html.
//  Add this BEFORE the tool's main script:
//
//      <script src="hub-auth-shim.js"></script>
//      <script>
//        // tool's normal script
//        // window.HUB_USER is now { email, role, embedded }
//      </script>
//
//  Behavior:
//    - Same-window load + no valid session → redirects to hub.html?return=<current>
//    - Same-window load + valid session    → exposes window.HUB_USER and continues
//    - Iframe context (e.g. Confluence)    → bypassed; HUB_USER set to anonymous
//                                            viewer (browser ITP often blocks
//                                            third-party iframe localStorage)
//
//  Adjust HUB_PATH if hub.html lives in a different directory than the tool.
//
(function () {
  'use strict';

  const SESSION_KEY = 'hub_session_v1';
  const HUB_PATH = 'https://corey.github.io/rd-hub/';

  // ---- Iframe bypass ----
  // If the tool is loaded inside any iframe (Confluence macro etc.), skip auth.
  // Two cases: (a) cross-origin parent throws on access; (b) same-origin parent
  // returns a different window. Either way: embedded.
  let embedded = false;
  try {
    embedded = (window.top !== window.self);
  } catch (_) {
    embedded = true;
  }
  if (embedded) {
    window.HUB_USER = { email: 'iframe-anonymous', role: 'viewer', embedded: true };
    return;
  }

  // ---- Session check ----
  let session = null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) session = JSON.parse(raw);
  } catch (_) { /* corrupt or unavailable storage */ }

  const valid =
    session &&
    typeof session.email === 'string' &&
    typeof session.expiresAt === 'number' &&
    session.expiresAt > Date.now();

  if (!valid) {
    const ret = encodeURIComponent(window.location.href);
    window.location.replace(HUB_PATH + '?return=' + ret);
    return;
  }

  // ---- Expose to host script ----
  window.HUB_USER = {
    email: session.email,
    role: session.role || 'user',
    embedded: false,
    // Convenience: stamp on edits, etc.
    stamp: function () {
      return { by: session.email, at: Date.now() };
    }
  };
})();
