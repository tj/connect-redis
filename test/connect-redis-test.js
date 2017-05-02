/* eslint-env es6 */
var test = require('blue-tape');
var redisSrv = require('./redis-server');
var session = require('express-session');
var RedisStore = require('../')(session);
var redis = require('redis');
var ioRedis = require('ioredis');
var P = require('bluebird');

var lifecycleTest = P.coroutine(function *(store, t) {
  P.promisifyAll(store);

  var ok = yield store.setAsync('123', { cookie: { maxAge: 2000 }, name: 'tj' });
  t.equal(ok, 'OK', '#set() ok');

  var data = yield store.getAsync('123');
  t.deepEqual({ cookie: { maxAge: 2000 }, name: 'tj' }, data, '#get() ok');

  ok = yield store.setAsync('123', { cookie: { maxAge: undefined }, name: 'tj' });
  t.equal(ok, 'OK', '#set() no maxAge ok');

  data = yield store.allAsync();
  t.deepEqual([{ id: '123', cookie: {}, name: 'tj' }], data, '#all() ok');

  data = yield store.idsAsync();
  t.deepEqual(['123'], data, '#ids() ok');

  ok = yield store.destroyAsync('123');
  t.equal(ok, 1, '#destroy() ok');

  store.client.end(false);
});

test('setup', redisSrv.connect);

test('defaults', function (t) {
  var store = new RedisStore();
  t.equal(store.prefix, 'sess:', 'defaults to sess:');
  t.notOk(store.ttl, 'ttl not set');
  t.notOk(store.disableTTL, 'disableTTL not set');
  t.ok(store.client, 'creates client');

  store.client.end(false);
  t.end();
});

test('basic', function (t) {
  t.throws(RedisStore, TypeError, 'constructor not callable as function');
  var store = new RedisStore({ port: redisSrv.port });
  return lifecycleTest(store, t);
});

test('existing client', function (t) {
  var client = redis.createClient(redisSrv.port, 'localhost');
  var store = new RedisStore({ client: client });
  return lifecycleTest(store, t);
});

test('io redis client', function (t) {
  var client = ioRedis.createClient(redisSrv.port, 'localhost');
  var store = new RedisStore({ client: client });
  return lifecycleTest(store, t);
});

test('options', function (t) {
  var store = new RedisStore({
    host: 'localhost',
    port: redisSrv.port,
    prefix: 'tobi',
    ttl: 1000,
    disableTTL: true,
    db: 1,
    scanCount: 32,
    unref: true,
    pass: 'secret'
  });

  t.equal(store.prefix, 'tobi', 'uses provided prefix');
  t.equal(store.ttl, 1000, 'ttl set');
  t.ok(store.disableTTL, 'disableTTL set');
  t.ok(store.client, 'creates client');
  t.equal(store.client.address, 'localhost:'+redisSrv.port, 'sets host and port');
  t.equal(store.scanCount, 32, 'sets scan count');

  var socketStore = new RedisStore({ socket: 'word' });
  t.equal(socketStore.client.address, 'word', 'sets socket address');
  socketStore.client.end(false);

  var urlStore = new RedisStore({ url: 'redis://127.0.0.1:8888' });
  t.equal(urlStore.client.address, '127.0.0.1:8888', 'sets url address');
  urlStore.client.end(false);

  var hostNoPort = new RedisStore({ host: 'host' });
  t.equal(hostNoPort.client.address, 'host:6379', 'sets default port');
  hostNoPort.client.end(false);

  return lifecycleTest(store, t);
});

test('interups', function (t) {
  var store = P.promisifyAll(new RedisStore({ port: redisSrv.port, connect_timeout: 500 }));
  return store.setAsync('123', { cookie: { maxAge: 2000 }, name: 'tj' })
    .catch(function (er) {
      t.ok(/broken/.test(er.message), 'failed connection');
      store.client.end(false);
    });
});

test('serializer', function (t) {
  var serializer = {
    stringify: function() { return 'XXX'+JSON.stringify.apply(JSON, arguments); },
    parse: function(x) {
      t.ok(x.match(/^XXX/));
      return JSON.parse(x.substring(3));
    }
  };
  t.equal(serializer.stringify('UnitTest'), 'XXX"UnitTest"');
  t.equal(serializer.parse(serializer.stringify('UnitTest')), 'UnitTest');

  var store = new RedisStore({ port: redisSrv.port, serializer: serializer });
  return lifecycleTest(store, t);
});

test('teardown', redisSrv.disconnect);
