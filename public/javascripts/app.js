/*global io:true */

// Shared client bootstrap: where the app is mounted, and the one socket the
// page uses. Loaded before start.js and play.js, which both rely on these.
//
// This replaces the old ENV switch ('dev' | 'code' | 'chess'), which hardcoded
// a host and port per environment and had to be hand-edited to deploy -- the
// last such edit being the `ENV = 'chess'` line that came down from the server.
// Mounted under /chess the app is same-origin with the rest of the site, so
// there is nothing left to hardcode: io() defaults to the page's own origin,
// which follows http/https on its own and so can't trip mixed-content blocking
// on a TLS page the way ws://chess.davidawindham.com:8181 did.
var $URL, $socket;

// window.$BASE is emitted by views/layout.pug from the server's BASE_PATH.
// '' when served at a domain root, '/chess' behind Apache.
var $BASE = window.$BASE || '';

// Absolute -- start.js builds the shareable game link out of this, so it needs
// the origin, unlike the page's own assets.
$URL = window.location.origin + $BASE;

// Must line up with the server's socket.io path and the proxy's websocket rule.
$socket = io({ path: $BASE + '/socket.io' });
