
# Connect Redis

connect-redis is a Redis session store backed by [node_redis](http://github.com/mranney/node_redis), and is insanely fast :). Requires redis >= `1.3.10` for the _SETEX_ command.

 connect-redis `>= 1.0.0` support only connect `>= 1.0.0`.

## Installation

	  $ npm install connect-redis

## Options

  - `host` Redis server hostname
  - `port` Redis server portno
  - `db` Database index to use
  - `pass` Password for Redis authentication
  - ...    Remaining options passed to the redis `createClient()` method.

## Usage

 Due to npm 1.x changes, we now need to pass connect to the function `connect-redis` exports in order to extend `connect.session.Store`:

    var connect = require('connect')
	 	  , RedisStore = require('connect-redis')(connect);

    connect.createServer(
      connect.cookieParser(),
      // 5 minutes
      connect.session({ store: new RedisStore, secret: 'keyboard cat' })
    );

 This means express users may do the following, since `express.session.Store` points to the `connect.session.Store` function:
 
    var RedisStore = require('connect-redis')(express);