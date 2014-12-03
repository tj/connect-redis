var P = require('bluebird');
var test = require('blue-tape');
var redisSrv = require('./redis-server');
var session = require('express-session');
var RedisStore = require('../')(session);
var redis = require('redis');

// Takes a store through all the operations
function lifecycleTest (store, t) {
  P.promisifyAll(store);

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
    })
    .then(function () {
      return store.setAsync('123', { cookie: { maxAge: undefined }, name: 'tj' });
    })
    .then(function (ok) {
      t.equal(ok, 'OK', '#set() no maxAge ok');
      return store.destroyAsync('123');
    })
    .then(function (ok) {
      t.equal(ok, 1, '#destroy() ok');
      store.client.end();
      return redisSrv.disconnect()
    });
}

test('defaults', function (t) {
  var store = new RedisStore();
  t.equal(store.prefix, 'sess:', 'defaults to sess:');
  t.notOk(store.ttl, 'ttl not set');
  t.notOk(store.disableTTL, 'disableTTL not set');
  t.ok(store.client, 'creates client');

  store.client.end();
  t.end();
});

test('basic', function (t) {
  var store = new RedisStore({ port: 8543 });
  return lifecycleTest(store, t);
});

test('existing client', function (t) {
  var client = redis.createClient(8543, 'localhost');
  var store = new RedisStore({ client: client })
  return lifecycleTest(store, t);
});

test('options', function (t) {
  var store = new RedisStore({
    host: 'localhost',
    port: 8543,
    prefix: 'tobi',
    ttl: 1000,
    disableTTL: true,
    db: 1,
    unref: true,
    pass: 'secret'
  });

  t.equal(store.prefix, 'tobi', 'uses provided prefix');
  t.equal(store.ttl, 1000, 'ttl set');
  t.ok(store.disableTTL, 'disableTTL set');
  t.ok(store.client, 'creates client');
  t.equal(store.client.address, 'localhost:8543', 'sets host and port');

  var socketStore = new RedisStore({ socket: 'word' });
  t.equal(socketStore.client.address, 'word', 'sets socket address');
  socketStore.client.end()

  var hostNoPort = new RedisStore({ host: 'host' });
  t.equal(hostNoPort.client.address, 'host:6379', 'sets default port');
  hostNoPort.client.end()

  return lifecycleTest(store, t);
});

test('interups', function (t) {
  var store = P.promisifyAll(new RedisStore({ port: 8543 }));

  return store.setAsync('123', { cookie: { maxAge: 2000 }, name: 'tj' })
    .catch(function (er) {
      t.ok(/failed/.test(er.message), 'failed connection');
      store.client.end();
    });
});
