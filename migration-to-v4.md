## Migrating to version 4.

Version 4 has some breaking changes from the previous versions. This documents those changes and how to migrate existing code.

### No more bundled Redis client.

The `redis` package is no longer bundled with `connect-redis`. This means you have to bring your own configured client. If you didn't depend on the built-in client, this requires no changes on your part and you can continue passing in the `client` as you did before.

If you did use the bundled `redis` client, you now have to pass it in instead of having `connect-redis` create it for you.

Older versions:

```js
const session = require('express-session')
let RedisStore = require('connect-redis')(session)

let store = new RedisStore({
  host: 'localhost',
  port: 6123,
  pass: 'my secret',
  db: 1,
  unref: true,
  logErrors: true,
})
```

Version 4 (make sure you also install the `redis` package):

```js
const redis = require('redis')
const session = require('express-session')
let RedisStore = require('connect-redis')(session)

let redisClient = redis.createClient({
  host: 'localhost',
  port: 6123,
  password: 'my secret',
  db: 1,
})
redisClient.unref()
redisClient.on('error', console.log)

let store = new RedisStore({ client: redisClient })
```

Given the bundled client does not exist, version 4 no longer has the following options:

```
host
port
pass
socket
unref
logErrors
```

### Changes to TTL management.

If you didn't use the `ttl` and `disableTTL` options in the past, this section will not apply to you.

There was a lot of confusion over how TTL behaves in Redis for sessions and how they expire. For this reason, we have greatly simplified the behavior and have opted to match the behavior found in other stores like `connect-mongo`.

Now, Redis keys will always expire (have their TTL set) based on the `cookie.expires` date set by and managed by `express-session`. In the case where the cookie has _no expiration_, we will fall back to a custom `ttl`, which keeps the same default of one day.

We added a `disableTouch` option which causes `touch` calls from `express-session` to do nothing. You may want to enable this under certain circumstances, see the [readme][1] for more details.

Other notable changes:

- Version 4 removed the ability to pass in a function as the `ttl`.
- Version 4 removed the `disableTTL` option.

### Conformity to the `express-session` store API.

We now support the complete `express-session` store API adding one missing method (`clear`) and modifying another method (`destroy`).

If you used `destroy` to remove session IDs by passing _in an array_, you can no longer do that, instead you must use the Redis client directly or you can use the new `clear` method if you were removing all tracked keys.

[1]: readme.md
