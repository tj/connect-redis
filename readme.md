[![npm](https://img.shields.io/npm/v/connect-redis.svg)](https://npmjs.com/package/connect-redis) [![Dependencies](https://img.shields.io/david/tj/connect-redis.svg)](https://david-dm.org/tj/connect-redis) ![Downloads](https://img.shields.io/npm/dm/connect-redis.svg) [![code-style](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://gitter.im/jlongster/prettier) [![travis](https://travis-ci.org/tj/connect-redis.svg?branch=master)](https://travis-ci.org/tj/connect-redis)

**connect-redis** provides Redis session storage for Express. Requires Redis >= `2.0.0`.

**Migrating to V4?** See [this guide](migration-to-v4.md) on what's changed.

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
const redis = require('redis')
const session = require('express-session')

let RedisStore = require('connect-redis')(session)
let client = redis.createClient()

app.use(
  session({
    store: new RedisStore({ client }),
    secret: 'keyboard cat',
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

- [redis][1]
- [ioredis](https://github.com/luin/ioredis)
- [redis-mock](https://github.com/yeahoffline/redis-mock) for testing.

##### prefix

Key prefix in Redis (default: `sess:`)

##### ttl

If the session cookie has a `expires` date, `connect-redis` will use it as the TTL.

Otherwise, it will expire the session using the `ttl` option (default: `86400` seconds or one day).

**Note**: The TTL is reset every time a user interacts with the server. You can disable this behavior in _some_ instances by using `disableTouch`.

##### disableTouch

Disables re-saving and resetting the TTL when using `touch` (default: `false`)

The `express-session` package uses `touch` to signal to the store that the user has interacted with the session but hasn't changed anything in its data. Typically, this helps keep the users session alive if session changes are infrequent but you may want to disable it to cut down the extra calls or to prevent users from keeping sessions open too long. Also consider enabling if you store a lot of data on the session.

Ref: https://github.com/expressjs/session#storetouchsid-session-callback

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

#### How to a log Redis errors?

```js
client.on('error', console.error)
```

#### How do I handle lost connections to Redis?

By default, the [`redis`][1] client will [auto-reconnect](https://github.com/mranney/node_redis#overloading) on lost connections. But requests may come in during that time. In Express, one way you can handle this scenario is including a "session check":

```js
app.use(session(/* setup session here */))
app.use(function(req, res, next) {
  if (!req.session) {
    return next(new Error('oh no')) // handle error
  }
  next() // otherwise continue
})
```

If you want to retry, here is [another option](https://github.com/expressjs/session/issues/99#issuecomment-63853989).

# License

MIT

[1]: https://github.com/NodeRedis/node_redis
