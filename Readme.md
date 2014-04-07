# Connect Redis

connect-redis is a Redis session store backed by [node_redis](http://github.com/mranney/node_redis), and is insanely fast :). Requires redis >= `2.0.0` for the _SETEX_ command.

## connect-redis `>= 2.0.0` support only express `>= 4.0.0`. Use connect-redis 1.4.7 for express 3x.

## Installation

	  $ npm install connect-redis

## Options
  
  - `client` An existing redis client object you normally get from `redis.createClient()`
  - `host` Redis server hostname
  - `port` Redis server portno
  - `ttl` Redis session TTL in seconds
  - `db` Database index to use
  - `pass` Password for Redis authentication
  - `prefix` Key prefix defaulting to "sess:"
  - `url` String that contains connection information in a single url (redis://user:pass@host:port/db)
  - ...    Remaining options passed to the redis `createClient()` method.

## Usage

 Due to express 4.x.x changes, we now need to pass express-session to the function `connect-redis` exports in order to extend `express-session.Store`:

    var session = require('express-session')
	 	  , RedisStore = require('connect-redis')(session);

    
      app.use(session({ store: new RedisStore(options), secret: 'keyboard cat' }))

# License

  MIT
