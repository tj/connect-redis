
/**
 * Module dependencies.
 */

var assert = require('assert'),
    RedisStore = require('./index');

var store = new RedisStore({ maxAge: 150 });

store.client.on('connect', function(){
  // #set()
  store.set('123', { name: 'tj' }, function(err, ok){
      assert.ok(!err, '#set() got an error');
      assert.ok(ok, '#set() is not ok');

      // #get()
      store.get('123', function(err, data){
          assert.ok(!err, '#get() got an error');
          assert.deepEqual({ name: 'tj' }, data);

          // #length()
          store.length(function(err, len){
              assert.ok(!err, '#length() got an error');
              assert.equal(1, len, '#length() with keys');

              // #clear()
              store.clear(function(err, ok){
                  assert.ok(!err, '#clear()');
                  assert.ok(ok, '#clear()');

                  // #length()
                  store.length(function(err, len){
                      assert.ok(!err, '#length()');
                      assert.equal(0, len, '#length() without keys');

                      // #set null
                      store.set('123', { name: 'tj' }, function(){
                          store.destroy('123', function(){
                              store.length(function(err, len){
                                 assert.equal(0, len, '#set() null');
                                 console.log('done');
                                 store.client.end(); 
                              });
                          });
                      });
                  });
              });
          });
      })
  });
  
});