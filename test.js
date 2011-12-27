
/**
 * Module dependencies.
 */

var assert = require('assert')
  , connect = require('connect')
  , RedisStore = require('./')(connect);

var store = new RedisStore;

store.client.on('connect', function(){
  // #set()
  store.set('123', { cookie: { maxAge: 2000 }, name: 'tj' }, function(err, ok){
    assert.ok(!err, '#set() got an error');
    assert.ok(ok, '#set() is not ok');
    // #get()
    store.get('123', function(err, data){
      assert.ok(!err, '#get() got an error');
      //throw new Error('uncaughtException'); 
      assert.deepEqual({ cookie: { maxAge: 2000 }, name: 'tj' }, data);
      store.destroy('123', function(){
        store.get('123',function(err, data){
          assert.ok(!err, '#get() null got an error');
          assert.ok(!data, '#get() null got data error');
          throw new Error('uncaughtException');  
          store.client.end();
        })
      });
    })
  });
});

process.on('uncaughtException', function (err) {
  if(err.message==='uncaughtException'){
    console.log('done');
  }else{
    console.log(err.message);
  }
  store.client.end();
}); 