[![npm](https://img.shields.io/npm/v/connect-redis.svg)](https://npmjs.com/package/connect-redis) [![Dependencies](https://img.shields.io/david/tj/connect-redis.svg)](https://david-dm.org/tj/connect-redis) ![Downloads](https://img.shields.io/npm/dm/connect-redis.svg) [![code-style](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://gitter.im/jlongster/prettier)

**connect-redis** is a Redis session store backed by [node_redis](http://github.com/mranney/node_redis), and is insanely fast :). Requires redis >= `2.0.0` for the _SETEX_ command.

## Installation

Yarn:

```sh
yarn add connect-redis express-session
```

npm:

```sh
npm install connect-redis express-session
```

## API

```js
var session = require('express-session');
var RedisStore = require('connect-redis')(session);

app.use(
  session({
    store: new RedisStore(options),
    secret: 'keyboard cat',
    resave: false,
  })
);
```

### RedisStore(options)

`RedisStore` will generate a new Redis client (using `node-redis`) given `host`, `port` or `socket` options. You may also provide an existing client using the `client` option. Existing clients must be compatible with the `node-redis` API (e.g. `ioredis` is a popular alternative).

#### Options

##### host

Redis host (default: `localhost`). Ignored when `client` option used.

##### port

Redis port (default: `6379`). Ignored when `client` option used.

##### db

Redis database (default: `0`). Ignored when `client` option used.

##### pass

Password for Redis authentication. Ignored when `client` option used.

##### socket

Redis socket. Ignored when `client` option used.

##### unref

Set `true` to unref the Redis client, allowing Node to shutdown the process if Redis holding open the event loop.. Ignored when `client` option used. **Warning**: this is [an experimental feature](https://github.com/mranney/node_redis#clientunref).

##### logErrors

Log Redis client errors to the console (default: `true`). Ignored when `client` option used.

If you need more explicit control you can provide a custom function instead:

```js
var logFn = err => {
  // Log client errors programmatically.
};
```

##### client

An instance of a `node_redis` or `node_redis` compatible client

Known compatible alternatives to `node_redis`:

- [ioredis](https://github.com/luin/ioredis)
- [redis-mock](https://github.com/yeahoffline/redis-mock) for testing.

##### prefix

Key prefix in Redis (default: `sess:`)

##### ttl

Redis session TTL in seconds. (default: `session.cookie.maxAge` if set or one day)

If you need more explicit control you can provide a custom function instead:

```js
var ttlFn = (store, sess, sessionID) => {
  // Calculate TTL programmatically.
  return ttl;
};
```

##### disableTTL

Disables setting a TTL. This means keys will never expire and will stay in Redis until evicted by
other means (overrides `ttl` option).

##### serializer

The encoder/decoder to use when storing and retrieving session data from Redis (default: `JSON`).

```ts
interface Serializer {
  parse(string): object;
  stringify(object): string;
}
```

##### scanCount

Value used for _count_ parameter in [Redis `SCAN` command](https://redis.io/commands/scan#the-count-option). Used for `ids()` and `all()` methods (default: `100`).

## FAQ

#### How do I handle lost connections to Redis?

By default, the `node_redis` client will [auto-reconnect](https://github.com/mranney/node_redis#overloading) on lost connections. But requests may come in during that time. In Express, one way you can handle this scenario is including a "session check":

```js
app.use(session(/* setup session here */));
app.use(function(req, res, next) {
  if (!req.session) {
    return next(new Error('oh no')); // handle error
  }
  next(); // otherwise continue
});
```

If you want to retry, here is [another option](https://github.com/expressjs/session/issues/99#issuecomment-63853989).

# License

MIT
