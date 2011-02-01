
# Connect Redis

connect-redis is a Redis session store backed by [node_redis](http://github.com/mranney/node_redis), and is insanely fast :). Requires redis >= `1.3.10` for the _SETEX_ command.
 
## Installation

via npm:

	$ npm install connect-redis

## Options

  - `maxAge` Sets key via the **EXPIRE** command (also the session's cookie)
  - `host` Redis server hostname
  - `port` Redis server portno
  - `db` Database index to use
  - ...    Remaining options passed to the redis `createClient()` method.

## Example

    var connect = require('connect')
	 	  , RedisStore = require('connect-redis');

    connect.createServer(
      connect.cookieDecoder(),
      // 5 minutes
      connect.session({ store: new RedisStore({ maxAge: 300000 }) })
    );
