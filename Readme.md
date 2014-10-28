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
  - `disableTTL` disables setting TTL, keys will stay in redis until evicted by other means (overides `ttl`)
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

## FAQ

#### Can I use a URL scheme to make a connection?

Since `node_redis` which this library wraps does not include the ability to create a client from a URL.  Neither does this library.  However, there's a [separate module](https://github.com/ddollar/redis-url) that can be used in conjunction to get this behavior.

#### How do I handle lost connections to Redis?

By default, the `node_redis` client will [auto-reconnect](https://github.com/mranney/node_redis#overloading) when a connection is lost.  But requests may come in during that time. In express, one way this scenario can be handled is including a "session check" after setting up a session (checking for the existence of `req.session`):

```js
app.use(session( /* setup session here */ ))
app.use(function (req, res, next) {
  if (!req.session) {
    return next(new Error('oh no')) // handle error
  }
  next() // otherwise continue
})
```

# License

  MIT
