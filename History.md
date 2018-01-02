# 3.3.3 / 2018-01-02

- Fix error when no keys [ranjan14196]
- Ensure resave value is defined [kevinsimper]

# 3.3.2 / 2017-09-28

- Allow strings for store.ttl [tswaters]

# 3.3.1 / 2017-09-28

- Updated Dependency Version [MeesterHok]
- Add support for store.ttl fn. [STRML]

# 3.3.0 / 2017-05-02

- Update tests.
- Use Redis SCAN and MGET commands in ids() and all() [naholyr]

# 3.2.0 / 2016-12-24

- Implement .all(), introduce .ids() [anotherpit]
- Allow .destroy to take an array of sids [barisusakli]
- Update docs [kidlj]
- Document defaults for ttl and db [pasieronen]

# 3.1.0 / 2016-06-16

- Add logErrors option [r3wt]

# 3.0.2 / 2016-01-08

- Do not pass prefix option to redis client [Josh-a-e]

# 3.0.1 / 2015-10-15

- Remove attempts option added in 3.0 to enable reconnect again [fintura]

# 3.0.0 / 2015-10-03

- Update node_redis to 2.0, reinstate `url` option [fintura]

# 2.5.1 / 2015-09-18

- Prevent RedisStore constructor from being called as a normal function [venning]

# 2.5.0 / 2015-08-28

- Add support to override serializer
- Add io-redis test

# 2.4.1 / 2015-07-24

- Make touch a noop when disableTTY is set

# 2.4.0 / 2015-07-10

- Add custom client support
- Add debug statement for redis client errors [scriptoLLC]
- Fix use Math.floor instead of |0 trick
- Removed send_anyway magic (unused)

# 2.3.0 / 2015-04-28

- add; `touch` / support `resave: false` [stuartpb]
- mod; package.json license [mikaturunen]

# 2.2.0 / 2015-01-26

- add; option to disable setting a TTL [despairblue]
- mod; forward redis errors to session callbacks
- mod; pass error object on disconnect

# 2.1.0 / 2014-08-29

- add; unref option
- dep; redis@0.12.x
- mod; deprecate warning for url param

# 2.0.0 / 2014-03-06

- update to express 4x

# 1.4.7 / 2014-03-06

- allow redis url

# 1.4.6 / 2013-11-13

- lazy load redis. fixes #56
- update redis to 0.9.0
- added Unit tests ready for travis
- added repository field to package.json

# 1.4.5 / 2012-11-02

- revert to redis 0.7.x which actually works...

# 1.4.4 / 2012-09-12

- update redis to 0.8.1 for "import bug fix?"

# 1.4.3 / 2012-09-11

- add license. Closes #58
- peg redis to 0.8.0

# 1.4.2 / 2012-09-05

- add disconnect / connect events

# 1.4.1 / 2012-07-26

- fix ignoring of .get() error

# 1.4.0 / 2012-06-14

- Added `ttl` option [Vyacheslav Bazhinov]

# 1.3.0 / 2012-03-23

- Added debug() instrumentation

# 1.2.0 / 2011-11-17

- Added an option 'client' to reuse an existing redis Client [Thomas Fritz]

# 1.1.0 / 2011-10-05

- Added `prefix` option
- Removed `clear()` and `length()` methods

# 1.0.7 / 2011-08-04

- Fixed: re-select db on connection (reconnection logic issue with node_redis)

# 1.0.6 / 2011-06-21

- Added `socket` option so that we can connect to a sockets as well [mekwall]

# 1.0.5 / 2011-06-02

- Implemented `require("connect-redis")(connect)` for npm 1.x. Closes #23

# 1.0.4 / 2011-05-01

- Changed; issue SELECT immediately since it is queued

# 1.0.3 / 2011-04-17

- Fixed auth support again [garrensmith]

# 1.0.2 / 2011-04-15

- Fixed auth support [garrensmith]

# 1.0.1 / 2011-04-14

- Added authentication support [garrensmith]

# 1.0.0 / 2011-02-25

- Added connect 1.0 support. This release will _not_ work with older versions of connect.

# 0.2.3 / 2011-02-01

- Refactoring

# 0.2.2 / 2011-01-02

- Added `db` option [Clément]

# 0.2.1 / 2010-12-20

- Redis is now an npm dep

# 0.2.0 / 2010-11-01

- Use **SETEX** instead of **SET** / **EXPIRE** combo this should be reasonably faster.

# 0.1.3 / 2010-10-25

- Updated redis

# 0.1.2 / 2010-09-22

- Updated redis

# 0.1.1 / 2010-09-20

- Fixed expires, `maxAge` in seconds
- Updated redis

# 0.1.0 / 2010-09-17

- Now using node_redis as the client, much faster

# 0.0.2 / 2010-07-27

- Moved redis to lib/redis
- Added lib/connect-redis.js
