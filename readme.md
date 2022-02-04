![Build Status](https://github.com/tj/connect-redis/workflows/build/badge.svg?branch=master) [![npm](https://img.shields.io/npm/v/connect-redis.svg)](https://npmjs.com/package/connect-redis) [![code-style](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://gitter.im/jlongster/prettier) ![Downloads](https://img.shields.io/npm/dm/connect-redis.svg)

**connect-redis** provides Redis session storage for Express. Requires Redis >= `2.0.0`.

## Installation

npm:

```sh
npm install redis connect-redis express-session
```

Yarn:

```sh
yarn add redis connect-redis express-session
```

## API

```js
const session = require("express-session")
let RedisStore = require("connect-redis")(session)

// redis@v4
const { createClient } = require("redis")
let redisClient = createClient({ legacyMode: true })
redisClient.connect().catch(console.error)

// redis@v3
const { createClient } = require("redis")
let redisClient = createClient()

// ioredis
const Redis = require("ioredis")
let redisClient = new Redis()

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    saveUninitialized: false,
    secret: "keyboard cat",
    resave: false,
  })
)
```

### RedisStore(options)

The `RedisStore` requires an existing Redis client. Any clients compatible with the [`redis`][1] API will work. See `client` option for more details.

#### Options

##### client

An instance of [`redis`][1] or a `redis` compatible client.

Known compatible and tested clients:

- [redis][1] (v3, v4 with `legacyMode: true`)
- [ioredis](https://github.com/luin/ioredis)
- [redis-mock](https://github.com/yeahoffline/redis-mock) for testing.

##### prefix

Key prefix in Redis (default: `sess:`).

This prefix appends to whatever prefix you may have set on the `client` itself.

**Note**: You may need unique prefixes for different applications sharing the same Redis instance. This limits bulk commands exposed in `express-session` (like `length`, `all`, `keys`, and `clear`) to a single application's data.

##### ttl

If the session cookie has a `expires` date, `connect-redis` will use it as the TTL.

Otherwise, it will expire the session using the `ttl` option (default: `86400` seconds or one day).

**Note**: The TTL is reset every time a user interacts with the server. You can disable this behavior in _some_ instances by using `disableTouch`.

**Note**: `express-session` does not update `expires` until the end of the request life cycle. Calling `session.save()` manually beforehand will have the previous value.

##### disableTouch

Disables re-saving and resetting the TTL when using `touch` (default: `false`)

The `express-session` package uses `touch` to signal to the store that the user has interacted with the session but hasn't changed anything in its data. Typically, this helps keep the users session alive if session changes are infrequent but you may want to disable it to cut down the extra calls or to prevent users from keeping sessions open too long. Also consider enabling if you store a lot of data on the session.

Ref: https://github.com/expressjs/session#storetouchsid-session-callback

##### disableTTL

Disables key expiration completely (default: `false`)

This option disables key expiration requiring the user to manually manage key cleanup outside of `connect-redis`. Only use if you know what you are doing and have an exceptional case where you need to manage your own expiration in Redis. Note this has no effect on `express-session` setting cookie expiration.

##### serializer

The encoder/decoder to use when storing and retrieving session data from Redis (default: `JSON`).

```ts
interface Serializer {
  parse(string): object
  stringify(object): string
}
```

##### scanCount

Value used for _count_ parameter in [Redis `SCAN` command](https://redis.io/commands/scan#the-count-option). Used for `ids()` and `all()` methods (default: `100`).

## FAQ

#### How to log Redis errors?

```js
client.on("error", console.error)
```

#### How do I handle lost connections to Redis?

By default, the [`redis`][1] client will [auto-reconnect](https://github.com/mranney/node_redis#overloading) on lost connections. But requests may come in during that time. In Express, one way you can handle this scenario is including a "session check":

```js
app.use(session(/* setup session here */))
app.use(function (req, res, next) {
  if (!req.session) {
    return next(new Error("oh no")) // handle error
  }
  next() // otherwise continue
})
```

If you want to retry, here is [another option](https://github.com/expressjs/session/issues/99#issuecomment-63853989).

[1]: https://github.com/NodeRedis/node-redis
