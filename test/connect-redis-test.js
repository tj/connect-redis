var P = require('bluebird');
var test = require('blue-tape');
var redisSrv = require('./redis-server');
var session = require('express-session');
var RedisStore = require('../')(session);

test('lifecycle', function (t) {
  var store = P.promisifyAll(new RedisStore({ port: '8543' }));

  return redisSrv.connect()
    .then(function () {
      return store.setAsync('123', { cookie: { maxAge: 2000 }, name: 'tj' });
    })
    .then(function (ok) {
      t.equal(ok, 'OK', '#set() ok');
      return store.getAsync('123');
    })
    .then(function (data) {
      t.deepEqual({ cookie: { maxAge: 2000 }, name: 'tj' }, data, '#get() ok');
      return store.destroyAsync('123');
    })
    .then(function (ok) {
      t.equal(ok, 1, '#destroy() ok');
      store.client.end();
      return redisSrv.disconnect();
    });
});

test('lifecycle w/ interups', function (t) {
  var store = P.promisifyAll(new RedisStore({ port: '8543' }));

  return store.setAsync('123', { cookie: { maxAge: 2000 }, name: 'tj' })
    .catch(function (er) {
      t.ok(/failed/.test(er.message), 'failed connection');
      store.client.end();
    });
});

test('lifecycle w/ retries', function (t) {
  var store = P.promisifyAll(new RedisStore({ port: '8543', retry: true }));

  var delayed = P.delay(500).cancellable().then(redisSrv.connect);

  return store.setAsync('123', { cookie: { maxAge: 2000 }, name: 'tj' })
    .then(function (ok) {
      t.equal(ok, 'OK', 'retried #set() ok');
    })
    .catch(function (er) {
      return delayed.cancel(er);
    })
    .finally(function () {
      store.client.end();
      redisSrv.disconnect();
    });
});
