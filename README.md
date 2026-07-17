# Chess-IO

Real-time chess over socket.io. My fork of
[Reti-Chess](https://github.com/romanmatiasko/reti-chess).

Built with [Node.js](https://nodejs.org/) | [Express](https://expressjs.com/) |
[Socket.IO](https://socket.io/) | [Pug](https://pugjs.org/) |
[chess.js](https://github.com/jhlywa/chess.js)

Games live in memory only: reload or disconnect and the game is gone. There is
no database and no accounts — the game link is the only thing gating a game.

## Run it

```sh
npm install
cp .env.example .env
npm run dev          # or: npm start
```

`npm run dev` loads `.env` and restarts on change. With `BASE_PATH=/chess` the
app serves at <http://localhost:8181/chess/>.

## Configuration

Everything comes from the environment — see `.env.example`. This replaces the
old `ENV` switch in `public/javascripts/app.js`, which hardcoded a host and port
into the client and had to be hand-edited per deploy.

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `8181` | Internal; Apache fronts it in production. |
| `BASE_PATH` | *(empty)* | `/chess` to mount at a subpath. Empty = domain root. |
| `TRUST_PROXY` | *(empty)* | `1` behind one reverse proxy. |
| `LOG_FILE` | `logs/games.log` | What `GET /logs` serves. |
| `DAW_ORIGIN` | *(empty)* | **Local dev only.** See "Shared chrome". |

`BASE_PATH` drives three things at once: the Express mount, the socket.io path
(`${BASE_PATH}/socket.io`), and every asset URL in the templates. The client
reads it back from `window.$BASE`, which `views/layout.pug` emits. Nothing is
baked in at build time, so the same tree serves `/` or `/chess` unchanged.

## Mounted at /chess

The app sits behind Apache at `davidwindham.com/chess`, same shape as `/radio`:

```apache
ProxyPass        /chess http://127.0.0.1:8181/chess upgrade=websocket
ProxyPassReverse /chess http://127.0.0.1:8181/chess
```

The prefix is kept on **both** sides — `BASE_PATH=/chess` tells the app to expect
it. `upgrade=websocket` is what carries socket.io; it needs httpd 2.4.47+ and no
`mod_proxy_wstunnel`.

Being same-origin with the main site is the point: the client calls `io()` with
no host, so it follows http/https on its own. The old build dialled
`ws://chess.davidawindham.com:8181` explicitly, which a TLS page blocks as mixed
content.

## Shared chrome

`views/layout.pug` renders `<daw-header>` / `<daw-footer>` and loads
`/embed/chrome.js` root-relative. In production Apache serves `/embed` from the
WordPress docroot alongside `/chess`, so it just works.

Locally, hitting node directly on `:8181` has no Apache in front and the chrome
would 404 — set `DAW_ORIGIN=http://daw.stu` and the app proxies `/embed` to the
main site. **Leave `DAW_ORIGIN` unset in production.** Going through
`daw.stu/chess` doesn't need it either way.

`public/stylesheets/daw.css` is the integration layer that pulls the page onto
the site's slate/card palette. It is deliberately separate from `style.css` so
the migration delta stays isolated — see the comment at the top of that file.

## Routes

All relative to `BASE_PATH`.

| Route | Notes |
| --- | --- |
| `/` | Create a game, get a link. |
| `/about` | |
| `/play/:token/:time/:increment` | The board. Params are validated; anything malformed is a 404. |
| `/logs` | Serves `games.log`. **Unauthenticated** — see below. |

## Gotchas

- **`style.css` is edited directly — there is no sass build.** A `style.scss`
  used to sit alongside it but had drifted years out of sync (different button,
  different palette) with no build step wiring the two, so it was deleted rather
  than left as a trap. `daw.css` holds the daw-integration styles separately.
- **`/logs` is public.** Nothing gates it. `gameLogger` is its only writer and it
  records a running game count and nothing else — no addresses, no chat, no
  player identifiers. Keep it that way, or put the route behind auth. Operational
  logging goes to the console logger precisely so it stays out of that file.
- **Tokens are the only access control.** They're 15 CSPRNG bytes as base64url;
  `TOKEN_RE` in `server.js` pins the shape the `/play` route will accept.
- **Node 24.** Runs on the same 24.x as the server. The pre-migration tree
  (Express 4 / socket.io 2 / jade) also booted on 24 — the upgrade was for
  support and security, not because 24 forced it.

## History

- 2015 — original fork of Reti-Chess.
- 2020 — reworked toward Express 5.
- May 2022 — merged `_old` back into `master`, still on the old fork.
- July 2026 — modernized (Express 5 / socket.io 4 / Pug) and mounted under
  `davidwindham.com/chess` with the shared site chrome.
