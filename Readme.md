# Connect Redis

connect-redis is a Redis session store backed by [node_redis](http://github.com/mranney/node_redis), and is insanely fast :). Requires redis >= `2.0.0` for the _SETEX_ command.

> Note: connect-redis `>= 2.0.0` only supports express `>= 4.0.0`. Use connect-redis `1.4.7` for express 3.x.

## Installation

	  $ npm install connect-redis

## Options

  A Redis client is required.  An existing client can be passed directly using the `client` param or created for you using the `host`, `port`, or `socket` params.
  - `client` An existing client created using `redis.createClient()`
  - `host` Redis server hostname
  - `port` Redis server portno
  - `socket` Redis server unix_socket

The following additional params may be included:

  - `ttl` Redis session TTL (expiration) in seconds
  - `db` Database index to use
  - `pass` Password for Redis authentication
  - `prefix` Key prefix defaulting to "sess:"
  - `unref` Set `true` to unref the Redis client. **Warning**: this is [an experimental feature](https://github.com/mranney/node_redis#clientunref).

Any options not included in this list will be passed to the redis `createClient()` method directly.

## Usage

Due to express `>= 4` changes, we now need to pass `express-session` to the function `connect-redis` exports in order to extend `session.Store`:

    var session = require('express-session');
    var RedisStore = require('connect-redis')(session);

    app.use(session({
        store: new RedisStore(options),
        secret: 'keyboard cat'
    }));

# License

  MIT
