
/**
 * Module dependencies.
 */

var assert = require('assert'),
    RedisStore = require('./index');

var store = new RedisStore;

store.set('123', { name: 'tj' }, function(err, ok){
    assert.ok(!err, '#set() got an error');
    assert.ok(ok, '#set() is not ok');
    store.get('123', function(err, data){
        assert.ok(!err, '#get() got an error');
        assert.deepEqual({ name: 'tj' }, data);
        store.length(function(err, len){
            assert.ok(!err, '#length() got an error');
            assert.equal(1, len, '#length() with keys');
            store.clear(function(err, ok){
                assert.ok(!err, '#clear()');
                assert.ok(ok, '#clear()');
                store.length(function(err, len){
                    assert.ok(!err, '#length()');
                    assert.equal(0, len, '#length() without keys');
                    store.client.close();
                });
            });
        });
    })
});
