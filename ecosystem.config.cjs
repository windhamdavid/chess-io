// pm2 process config for chess-io.
//
// CommonJS (.cjs) on purpose: package.json has "type": "module", so a plain
// ecosystem.config.js would be parsed as ESM and `module.exports` would throw.
// pm2 reads .cjs fine.
//
//   pm2 start ecosystem.config.cjs
//   pm2 logs chess-io --lines 5      # confirm  basePath":"/chess"
//   pm2 save                         # remember this process across restarts
//   pm2 startup                      # prints a sudo command to enable on boot
//
module.exports = {
  apps: [
    {
      name: 'chess-io',
      script: 'server.js',
      cwd: __dirname,

      // Single process, fork mode -- NOT cluster. The `games` object lives in
      // memory in one process; multiple workers would each hold a different
      // slice, so a player routed to the wrong worker sees "token-invalid", and
      // socket.io would additionally need a shared adapter + sticky sessions.
      // One process is correct for this app.
      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
        PORT: 8181,
        BASE_PATH: '/chess',
        TRUST_PROXY: 1,
        // DAW_ORIGIN is intentionally omitted -- it is a local-dev-only shim for
        // the shared chrome and must stay unset in production.
      },
    },
  ],
};
