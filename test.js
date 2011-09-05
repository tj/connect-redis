
/**
 * Module dependencies.
 */

var assert     = require('assert')
  , redis      = require('redis')
  , connect    = require('connect')
  , RedisStore = require('./')(connect);

var client   = redis.createClient();
var store    = new RedisStore(client);
var storeAlt = new RedisStore(client, { prefix : 'alt:' }) 
var sids     = [];

store.on('set', function(sid, ttl){
  sids.push(sid);
})

store.on('destroy', function(sid){
  sids = sids.filter(function (x){ return x != sid; });
})

store.client.on('connect', function(){
  // #set()
  store.set('123', { cookie: { maxAge: 2000 }, name: 'tj' }, function(err, ok){
    assert.ok(!err, '#set() got an error');
    assert.ok(ok, '#set() is not ok');
    assert.deepEqual(['123'], sids, '#set() did not emit event'); // assume expiry is not a factor 
    
    // #get()
    store.get('123', function(err, data){
      assert.ok(!err, '#get() got an error');
      assert.deepEqual({ cookie: { maxAge: 2000 }, name: 'tj' }, data);
  
      // #destroy()
      store.destroy('123', function(err){
        assert.ok(!err, '#destroy() got an error');
        assert.deepEqual([], sids, '#destroy() did not emit event');
        store.get('123', function(err, data){
          assert.ok(err, '#destroy() did not destroy the key');
          
          // options.prefix
          storeAlt.set('123', { cookie: { maxAge: 2000 }, name: 'tj' }, function(err, ok){
            client.get('alt:123', function(err, data){
              assert.ok(!err, 'options.prefix is not prefixed to key');
              console.log('done');
              client.quit();
            });
          });
        });
      });
    });
  });
});
