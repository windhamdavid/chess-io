####Chess-IO
==========

My fork of [Reti-Chess](https://github.com/romanmatiasko/reti-chess)
Built with [Node](https://github.com/nodejs/node), [Express](https://github.com/strongloop/express), [Socket.IO](https://github.com/socketio/socket.io), [React](https://github.com/facebook/react), [Flux](https://github.com/facebook/flux) and [Immutable](https://github.com/facebook/immutable-js), and [chess.js](https://github.com/jhlywa/chess.js).


```sh
npm install
mkdir logs
touch logs/games.log
npm start
```

- with nodemon
```sh
npm install -g nodemon # if you don't have nodemon installed yet
export NODE_ENV=development
nodemon bin/www
```

- recompile static assets on save
```sh
npm run build
```

- tests
```sh
npm test
```


####License
-------

Available under [the MIT License (MIT)](./LICENSE.md).