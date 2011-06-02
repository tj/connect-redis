
/**
 * Module dependencies.
 */

var assert = require('assert')
  , connect = require('connect')
  , RedisStore = require('./')(connect);

var store = new RedisStore;
var store_alt = new RedisStore({ db: 15 });

store.client.on('connect', function(){
  // #set()
  store.set('123', { cookie: { maxAge: 2000 }, name: 'tj' }, function(err, ok){
    assert.ok(!err, '#set() got an error');
    assert.ok(ok, '#set() is not ok');
    
    // #get()
    store.get('123', function(err, data){
      assert.ok(!err, '#get() got an error');
      assert.deepEqual({ cookie: { maxAge: 2000 }, name: 'tj' }, data);
  
      // #length()
      store.length(function(err, len){
        assert.ok(!err, '#length() got an error');
        assert.equal(1, len, '#length() with keys');

        // #db option
        store_alt.length(function (err, len) {
          assert.ok(!err, '#alt db got an error');
          assert.equal(0, len, '#alt db with keys'); 

          // #clear()
          store.clear(function(err, ok){
            assert.ok(!err, '#clear()');
            assert.ok(ok, '#clear()');

            // #length()
            store.length(function(err, len){
              assert.ok(!err, '#length()');
              assert.equal(0, len, '#length() without keys');

              // #set null
              store.set('123', { cookie: { maxAge: 2000 }, name: 'tj' }, function(){
                store.destroy('123', function(){
                  store.length(function(err, len){
                   assert.equal(0, len, '#set() null');
                   console.log('done');
                   store.client.end(); 
                   store_alt.client.end();
                  });
                });
              });
            });
          });
        });
      });
    })
  });
});
