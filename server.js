import { createServer } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import { Server } from 'socket.io';
import winston from 'winston';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ***************************************************************************
// Config
// ***************************************************************************

// Everything comes from the environment -- see .env.example. `npm run dev`
// loads .env; in production the service manager passes real env vars. This
// replaces the old client-side ENV switch in public/javascripts/app.js, which
// hardcoded chess.davidawindham.com:8181 and had to be hand-edited per host.
const config = {
  port: Number(process.env.PORT ?? 8181),
  // '' when served at the domain root, '/chess' when mounted at a subpath.
  basePath: normalizeBasePath(process.env.BASE_PATH ?? ''),
  // Number of reverse proxies in front of us, or a preset like 'loopback'.
  trustProxy: process.env.TRUST_PROXY ?? '',
  logFile: process.env.LOG_FILE ?? path.join(__dirname, 'logs/games.log'),
  // Local dev only. See the /embed proxy below.
  dawOrigin: process.env.DAW_ORIGIN ?? '',
};

function normalizeBasePath(value) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

// A game link is the only thing gating access to a game, so tokens are the
// closest thing this app has to a credential. Shape is fixed by makeToken:
// 15 random bytes as base64url = 20 chars from [A-Za-z0-9_-].
const TOKEN_RE = /^[A-Za-z0-9_-]{20}$/;

// Mirrors the bounds the form enforces client-side (views/index.pug).
const MIN_MINUTES = 1;
const MAX_MINUTES = 50;
const MAX_INCREMENT = 50;

const TOKEN_TTL_MS = 5 * 60 * 1000;

// ***************************************************************************
// Logging
// ***************************************************************************

fs.mkdirSync(path.dirname(config.logFile), { recursive: true });

const format = winston.format.combine(winston.format.timestamp(), winston.format.simple());

// Operational messages -- boot, config, the embed proxy. Console only, so the
// service manager collects them. Deliberately kept out of games.log: that file
// is world-readable over GET /logs, and this is where the port and DAW_ORIGIN
// would otherwise leak into it.
const logger = winston.createLogger({
  level: 'info',
  format,
  transports: [new winston.transports.Console()],
});

// games.log, which GET /logs serves. Winston had no file transport at all
// before, so the file was never written and that route could only ever reach
// its error path. Game counts only -- see the note on the route.
const gameLogger = winston.createLogger({
  level: 'info',
  format,
  transports: [
    new winston.transports.File({ filename: config.logFile }),
    new winston.transports.Console(),
  ],
});

// ***************************************************************************
// App
// ***************************************************************************

const app = express();
const server = createServer(app);

if (config.trustProxy) {
  // Needed for correct client IPs / protocol when Apache fronts us at /chess.
  const asNumber = Number(config.trustProxy);
  app.set('trust proxy', Number.isNaN(asNumber) ? config.trustProxy : asNumber);
}

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Templates build every asset URL from this, so the same views work whether the
// app is at the domain root or under /chess.
app.locals.basePath = config.basePath;

const router = express.Router();

router.use(express.static(path.join(__dirname, 'public')));

router.get('/', (req, res) => {
  res.render('index');
});

router.get('/about', (req, res) => {
  res.render('about');
});

// The three params land in a <script> block in views/play.pug, so they are
// validated here rather than escaped there: `time` and `increment` are numeric
// in that context, and Pug's HTML escaping does nothing to a payload like
// `1;alert(1)` that contains no HTML characters. Anything that isn't a
// well-formed game link is simply not a game.
router.get('/play/:token/:time/:increment', (req, res) => {
  const { token } = req.params;
  const time = Number(req.params.time);
  const increment = Number(req.params.increment);

  const valid =
    TOKEN_RE.test(token) &&
    Number.isInteger(time) &&
    time >= MIN_MINUTES &&
    time <= MAX_MINUTES &&
    Number.isInteger(increment) &&
    increment >= 0 &&
    increment <= MAX_INCREMENT;

  if (!valid) {
    res.sendStatus(404);
    return;
  }

  res.render('play', { token, time, increment });
});

// Served unauthenticated, so what gets written matters more than what gets read:
// gameLogger is the only writer, and it records a running game count and nothing
// else -- no addresses, no chat, no player identifiers. Keep it that way, or put
// this route behind auth.
router.get('/logs', async (req, res) => {
  try {
    res.type('text/plain').send(await fs.promises.readFile(config.logFile, 'utf8'));
  } catch {
    // The old version called res.redirect() without returning and then fell
    // through to res.send(data) with `data` undefined, so a single request to
    // /logs took the process down with ERR_HTTP_HEADERS_SENT. One send per path.
    res.redirect(`${config.basePath}/`);
  }
});

// Local dev only: serve the shared site chrome (/embed/chrome.js + its fonts)
// by proxying to the main site.
//
// The layout loads /embed/chrome.js root-relative. In production Apache serves
// that path from the WordPress docroot alongside /chess, and only routes
// /chess here, so this never runs there. Locally, hitting node directly on
// :8181 has no Apache in front, so without this the chrome would 404 and the
// page would render bare. Unset DAW_ORIGIN => not mounted at all.
if (config.dawOrigin) {
  app.use('/embed', async (req, res) => {
    try {
      const upstream = await fetch(new URL(`/embed${req.url}`, config.dawOrigin), {
        signal: AbortSignal.timeout(5000),
      });
      if (!upstream.ok) {
        res.sendStatus(upstream.status);
        return;
      }
      const type = upstream.headers.get('content-type');
      if (type) res.type(type);
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.sendStatus(502);
    }
  });
  logger.info('embed proxy enabled', { origin: config.dawOrigin });
}

// Canonicalize /chess -> /chess/ before the router sees it. Without the
// trailing slash the browser resolves the page's relative asset URLs against
// the parent directory, so every script and stylesheet 404s.
//
// The exact `req.path ===` test matters: Express's default non-strict routing
// treats '/chess' and '/chess/' as the same route, so a plain app.get(basePath)
// would also match the slashed URL and redirect it to itself, forever.
if (config.basePath) {
  app.use((req, res, next) => {
    if (req.path === config.basePath) res.redirect(301, `${config.basePath}/`);
    else next();
  });
}

app.use(config.basePath || '/', router);

// ***************************************************************************
// Sockets
// ***************************************************************************

const io = new Server(server, {
  // Must line up with the client and with the proxy's websocket location.
  path: `${config.basePath}/socket.io`,
});

const games = {};

// The old token was `new Buffer(Math.random() + Date.now() + socket.id)` sliced
// out of base64 -- guessable, since Math.random() is not a CSPRNG and the other
// two terms are largely knowable. Anyone who guesses a live token joins the
// game, so this is the one place unpredictability actually matters.
function makeToken() {
  return crypto.randomBytes(15).toString('base64url');
}

io.on('connection', (socket) => {
  socket.on('start', function () {
    const token = makeToken();

    // Token is valid for 5 minutes.
    const timeout = setTimeout(() => {
      // The game may already be gone -- disconnect deletes it without clearing
      // this timer, and the old body dereferenced games[token] unguarded.
      if (games[token]?.players.length === 0) {
        delete games[token];
        socket.emit('token-expired');
      }
    }, TOKEN_TTL_MS);

    games[token] = {
      creator: socket,
      players: [],
      interval: null,
      timeout,
    };

    socket.emit('created', { token });
  });

  socket.on('join', function (data) {
    let color;

    if (!(data.token in games)) {
      socket.emit('token-invalid');
      return;
    }

    clearTimeout(games[data.token].timeout);
    const game = games[data.token];

    if (game.players.length >= 2) {
      socket.emit('full');
      return;
    } else if (game.players.length === 1) {
      color = game.players[0].color === 'black' ? 'white' : 'black';
      gameLogger.info('Number of currently running games', { '#': Object.keys(games).length });
    } else {
      const colors = ['black', 'white'];
      color = colors[Math.floor(Math.random() * 2)];
    }

    socket.join(data.token);

    games[data.token].players.push({
      id: socket.id,
      socket,
      color,
      time: data.time - data.increment + 1,
      increment: data.increment,
    });

    game.creator.emit('ready', {});

    socket.emit('joined', { color });
  });

  socket.on('timer-white', function (data) {
    runTimer('white', data.token, socket);
  });

  socket.on('timer-black', function (data) {
    runTimer('black', data.token, socket);
  });

  socket.on('timer-clear-interval', function (data) {
    if (data.token in games) {
      clearInterval(games[data.token].interval);
    }
  });

  socket.on('new-move', function (data) {
    if (data.token in games) {
      const opponent = getOpponent(data.token, socket);
      if (opponent) {
        opponent.socket.emit('move', { move: data.move });
      }
    }
  });

  socket.on('resign', function (data) {
    if (data.token in games) {
      clearInterval(games[data.token].interval);
      io.in(data.token).emit('player-resigned', { color: data.color });
    }
  });

  socket.on('rematch-offer', function (data) {
    if (data.token in games) {
      const opponent = getOpponent(data.token, socket);
      if (opponent) {
        opponent.socket.emit('rematch-offered');
      }
    }
  });

  socket.on('rematch-decline', function (data) {
    if (data.token in games) {
      const opponent = getOpponent(data.token, socket);
      if (opponent) {
        opponent.socket.emit('rematch-declined');
      }
    }
  });

  socket.on('rematch-confirm', function (data) {
    if (data.token in games) {
      for (const j in games[data.token].players) {
        games[data.token].players[j].time = data.time - data.increment + 1;
        games[data.token].players[j].increment = data.increment;
        games[data.token].players[j].color =
          games[data.token].players[j].color === 'black' ? 'white' : 'black';
      }

      const opponent = getOpponent(data.token, socket);
      if (opponent) {
        io.in(data.token).emit('rematch-confirmed');
      }
    }
  });

  socket.on('disconnect', function () {
    for (const token in games) {
      const game = games[token];

      for (const j in game.players) {
        const player = game.players[j];

        if (player.socket === socket) {
          const opponent = game.players[Math.abs(j - 1)];
          if (opponent) {
            opponent.socket.emit('opponent-disconnected');
          }
          clearInterval(games[token].interval);
          clearTimeout(games[token].timeout);
          delete games[token];
        }
      }
    }
  });

  socket.on('send-message', function (data) {
    if (data.token in games) {
      const opponent = getOpponent(data.token, socket);
      if (opponent) {
        opponent.socket.emit('receive-message', data);
      }
    }
  });
});

function runTimer(color, token, socket) {
  const game = games[token];

  if (!game) return;

  for (const i in game.players) {
    const player = game.players[i];

    if (player.socket === socket && player.color === color) {
      clearInterval(games[token].interval);
      games[token].players[i].time += games[token].players[i].increment;

      return (games[token].interval = setInterval(() => {
        games[token].players[i].time -= 1;
        const timeLeft = games[token].players[i].time;

        if (timeLeft >= 0) {
          io.in(token).emit('countdown', { time: timeLeft, color });
        } else {
          io.in(token).emit('countdown-gameover', { color });
          clearInterval(games[token].interval);
        }
      }, 1000));
    }
  }
}

function getOpponent(token, socket) {
  const game = games[token];

  for (const j in game.players) {
    if (game.players[j].socket === socket) {
      return game.players[Math.abs(j - 1)];
    }
  }
}

server.listen(config.port, () => {
  logger.info('chess-io listening', {
    port: config.port,
    basePath: config.basePath || '/',
  });
});
