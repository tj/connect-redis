
# Connect Redis

connect-redis is a Redis session store backed by [node_redis](http://github.com/mranney/node_redis), and is insanely fast :). Requires redis >= `1.3.10` for the _SETEX_ command.

 connect-redis `>= 1.0.0` support only connect `>= 1.0.0`.

## Installation

via npm:

	  $ npm install connect-redis

## Options

  - `host` Redis server hostname
  - `port` Redis server portno
  - `db` Database index to use
  - `pass` Password for Redis authentication
  - ...    Remaining options passed to the redis `createClient()` method.

## Example

    var connect = require('connect')
	 	  , RedisStore = require('connect-redis');

    connect.createServer(
      connect.cookieParser(),
      // 5 minutes
      connect.session({ store: new RedisStore, secret: 'keyboard cat' })
    );
