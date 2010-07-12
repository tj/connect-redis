
# Connect Redis

connect-redis is a Redis session store backed by [node-redis-client](http://github.com/fictorial/redis-node-client).
 
## Installation

Via git:

    $ git clone git://github.com/visionmedia/connect-redis.git ~/.node_libraries/connect-redis

via npm:

	$ npm install connect-redis@latest

## Options

  * `maxAge` Sets key via the **EXPIRE** command (also the session's cookie)
  * `host` Redis server hostname
  * `port` Redis server portno
  * ...    Remaining options passed to the redis `createClient()` method.

## Example

    var connect = require('connect'),
	 	RedisStore = require('connect-redis');

    connect.createServer(
        connect.cookieDecoder(),
        connect.session({ store: new RedisStore({ maxAge: 150 }) })
    );