
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
      throw new Error('uncaughtException');
    })
  });
});

process.on('uncaughtException', function (err) {
  if('Error: uncaughtException' === err.toString()){
    console.log('done');
  }else{
    console.log('try catch error');
  }
});