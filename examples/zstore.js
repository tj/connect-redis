/*
 * Example showing the use of the event callbacks to maintain
 * a list of all sessions.
 */

var assert     = require('assert')
  , redis      = require('redis')
  , connect    = require('connect')
  , RedisStore = require('../')(connect);

var ZStore = (function () {
  function ZStore(client) {
    RedisStore.call(this, client);

    this.sessions = this.key('sessions');
      
    /* 
     * [Explanation of set for keyspace.](redis.io/commands/keys)
     * [Explanation of zset for keyspace with expiry.](http://groups.google.com/group/redis-db/browse_thread/thread/ad75cc08b364352b)
     */

    this.on('set', function(sid, ttl){
      var self = this;
      ttl = ttl * 1000;
      self.client.zadd(self.sessions, new Date().getTime() + ttl, sid);
      if (!self.timer) {
        function timeout() {
          var now = new Date().getTime();
          self.client.zremrangebyscore(self.sessions, '-inf', now);
          self.client.zrange(self.sessions, 0, 0, 'withscores', function (err, replies) {
            if (replies.length != 0) {
              self.timer = setTimeout(timeout, replies[1] - now);
            } else {
              self.timer = null;
            }
          });
        }
        self.timer = setTimeout(timeout, ttl);
      }
    });

    this.on('destroy', function(sid){
      this.client.zrem(this.sessions, sid);
    });
  };

  ZStore.prototype.__proto__ = RedisStore.prototype;

  ZStore.prototype.all = function(fn){
    this.client.zrange(this.key('sessions'), 0, -1, fn);
  };

  return ZStore;
})()

var client  = redis.createClient()
  , store   = new ZStore(client);

store.set(connect.utils.uid(9), { cookie: { maxAge: 2000 }, k: 'v' });
store.set(connect.utils.uid(9), { cookie: { maxAge: 2000 }, k: 'v' });
store.set(connect.utils.uid(9), { cookie: { maxAge: 4000 }, k: 'v' });
setTimeout(function(){
  store.all(function(err, replies){
    assert.ok(!err && replies.length == 3);
  });
}, 1000);
setTimeout(function(){
  store.all(function(err, replies){
    assert.ok(!err && replies.length == 1); // prove zstore expires keys
  });
}, 3000);
setTimeout(function(){
  store.all(function(err, replies){
    assert.ok(!err && replies.length == 0);
    console.log('done');
    client.quit();
  });
}, 5000);
