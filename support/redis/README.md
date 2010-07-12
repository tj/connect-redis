# Redis client for Node.js

## In a nutshell

- Talk to Redis from Node.js 
- Fully asynchronous; your code is called back when an operation completes
- [Binary-safe](http://github.com/fictorial/redis-node-client/blob/master/test/test.js#L353-363); uses Node.js Buffer objects for request serialization and reply parsing
    - e.g. store a PNG in Redis if you'd like
- Client API directly follows Redis' [command specification](http://code.google.com/p/redis/wiki/CommandReference) 
- *You have to understand how Redis works and the semantics of its command set to most effectively use this client*
- Supports Redis' new exciting [PUBSUB](http://code.google.com/p/redis/wiki/PublishSubscribe) commands
- Automatically reconnects to Redis (doesn't drop commands sent while waiting to reconnect either) using [exponential backoff](http://en.wikipedia.org/wiki/Exponential_backoff)
    - Be sure to see [this script](http://github.com/fictorial/redis-node-client/blob/master/test/test_shutdown_reconnect.js) for a deeper discussion

## Synopsis

When working from a git clone:

    var sys = require("sys");
    var client = require("../lib/redis-client").createClient();
    client.info(function (err, info) {
        if (err) throw new Error(err);
        sys.puts("Redis Version is: " + info.redis_version);
        client.close();
    });

When working with a Kiwi-based installation:

    // $ kiwi install redis-client

    var sys = require("sys"), 
        kiwi = require("kiwi"),
        client = kiwi.require("redis-client").createClient();

    client.info(function (err, info) {
        if (err) throw new Error(err);
        sys.puts("Redis Version is: " + info.redis_version);
        client.close();
    });

- Refer to the many tests in `test/test.js` for many usage examples.
- Refer to the `examples/` directory for focused examples.

## Installation

This version requires at least `Node.js v0.1.90` and Redis `1.3.8`.

Tested with Node.js `v0.1.95` and `v0.1.96` and Redis `2.1.1` (the current unstable).

You have a number of choices:

- git clone this repo or download a tarball and simply copy `lib/redis-client.js` into your project
- use git submodule
- use the [Kiwi](http://github.com/visionmedia/kiwi) package manager for Node.js

Please let me know if the package manager "seeds" and/or metadata have issues.
Installation via Kiwi or NPM at this point isn't really possible since this repo
depends on a unreleased version of Node.js.

## Running the tests

A good way to learn about this client is to read the test code.

To run the tests, install and run redis on the localhost on port 6379 (defaults).
Then run `node test/test.js [-v|-q]` where `-v` is for "verbose" and `-q` is for "quiet".

    $ node test/test.js
    ..................................................................
    ...........................++++++++++++++++++++++++++++++++++++

    [INFO] All tests have passed.

If you see something like "PSUBSCRIBE: unknown command" then it is time to upgrade
your Redis installation.

## Documentation

There is a method per Redis command.  E.g. `SETNX` becomes `client.setnx`.

For example, the Redis command [INCRBY](http://code.google.com/p/redis/wiki/IncrCommand)
is specified as `INCRBY key integer`.  Also, the INCRBY spec says that the reply will
be "... the new value of key after the increment or decrement."

This translates to the following client code which increments key 'foo' by 42.  If
the value at key 'foo' was 0 or non-existent, 'newValue' will take value 42 when
the callback function is called.

    client.incrby('foo', 42, function (err, newValue) {
        // ...
    });

This can get [a little wacky](http://github.com/fictorial/redis-node-client/blob/master/test/test.js#L1093-1097). 
I'm open to suggestions for improvement here.

Note: for PUBSUB, you should use `subscribeTo` and `unsubscribeFrom` instead of the generated
methods for Redis' `SUBSCRIBE` and `UNSUBSCRIBE` commands.  See [this](http://github.com/fictorial/redis-node-client/blob/master/lib/redis-client.js#L682-694)
and [this](http://github.com/fictorial/redis-node-client/blob/master/examples/subscriber.js#L14).

## Notes

All commands/requests use the Redis *multi-bulk request* format which will be
the only accepted request protocol come Redis 2.0.

