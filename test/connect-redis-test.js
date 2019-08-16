var test = require('blue-tape');
var redisSrv = require('./redis-server');
var session = require('express-session');
var RedisStore = require('../')(session);
var redis = require('redis');
var ioRedis = require('ioredis');
var redisMock = require('redis-mock');
var sinon = require('sinon');

test('setup', redisSrv.connect);

test('defaults', function(t) {
  var store = new RedisStore();
  t.equal(store.prefix, 'sess:', 'defaults to sess:');
  t.notOk(store.ttl, 'ttl not set');
  t.notOk(store.disableTTL, 'disableTTL not set');
  t.ok(store.client, 'creates client');

  store.client.end(false);
  t.end();
});

test('minimal', t => {
  t.throws(RedisStore, TypeError, 'constructor not callable as function');
  var store = new RedisStore({ port: redisSrv.port });
  return lifecycleTest(store, t);
});

test('options', function(t) {
  var store = new RedisStore({
    host: 'localhost',
    port: redisSrv.port,
    prefix: 'tobi',
    ttl: 1000,
    disableTTL: true,
    db: 1,
    scanCount: 32,
    unref: true,
    pass: 'secret',
  });

  t.equal(store.prefix, 'tobi', 'uses provided prefix');
  t.equal(store.ttl, 1000, 'ttl set');
  t.ok(store.disableTTL, 'disableTTL set');
  t.ok(store.client, 'creates client');
  t.equal(
    store.client.address,
    'localhost:' + redisSrv.port,
    'sets host and port'
  );
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

test('ttl options', async t => {
  var store = new RedisStore({ port: redisSrv.port });
  var setFn = p(store, 'set');

  var sid = '123';
  var data, ok;
  sinon.stub(store.client, 'set').callsArgWith(1, null, 'OK');

  // Basic (one day)
  data = { cookie: {}, name: 'tj' };
  ok = await setFn(sid, data);
  t.equal(ok, 'OK', '#set() ok');
  assertSetCalledWith(t, store, sid, data, ['EX', 86400]);

  // maxAge in cookie
  data = { cookie: { maxAge: 2000 }, name: 'tj' };
  ok = await setFn(sid, data);
  t.equal(ok, 'OK', '#set() ok');
  assertSetCalledWith(t, store, sid, data, ['EX', 2]);

  // Floors maxage
  data = { cookie: { maxAge: 2500 }, name: 'tj' };
  ok = await setFn(sid, data);
  t.equal(ok, 'OK', '#set() ok');
  assertSetCalledWith(t, store, sid, data, ['EX', 2]);

  // store.disableTTL
  store.disableTTL = true;
  data = { cookie: {}, name: 'tj' };
  ok = await setFn(sid, data);
  t.equal(ok, 'OK', '#set() ok');
  assertSetCalledWith(t, store, sid, data);
  store.disableTTL = false;

  // store.ttl: number
  store.ttl = 50;
  data = { cookie: {}, name: 'tj' };
  ok = await setFn(sid, data);
  t.equal(ok, 'OK', '#set() ok');
  assertSetCalledWith(t, store, sid, data, ['EX', 50]);
  store.ttl = null;

  // store.ttl: function
  store.ttl = sinon.stub().returns(200);
  data = { cookie: {}, name: 'tj' };
  ok = await setFn(sid, data);
  t.equal(ok, 'OK', '#set() ok');
  assertSetCalledWith(t, store, sid, data, ['EX', 200]);
  t.ok(store.ttl.called, 'TTL fn was called');
  t.deepEqual(store.ttl.firstCall.args, [store, data, sid]);
  store.ttl = null;

  // store.ttl: string (invalid)
  store.ttl = {};
  data = { cookie: {}, name: 'tj' };
  try {
    ok = await setFn(sid, data);
    t.ok(false, '#set() should throw with bad TTL');
  } catch (e) {
    t.ok(
      /must be a number or function/i.test(e.message),
      'bad TTL type throws error'
    );
  }
  store.ttl = null;
  store.client.end(false);
});

test('node_redis client', t => {
  var client = redis.createClient(redisSrv.port, 'localhost');
  var store = new RedisStore({ client: client });
  return lifecycleTest(store, t);
});

test('ioredis client', async t => {
  var client = ioRedis.createClient(redisSrv.port, 'localhost');
  var store = new RedisStore({ client: client });
  await lifecycleTest(store, t);
  client.disconnect();
});

test('redis-mock client', async t => {
  var client = redisMock.createClient();
  var store = new RedisStore({ client: client });
  await lifecycleTest(store, t);
});

test('interups', async t => {
  var store = new RedisStore({ port: redisSrv.port, connect_timeout: 500 });
  store.client.end(false);
  try {
    await p(store, 'set')('123', {
      cookie: { maxAge: 2000 },
      name: 'tj',
    });
    t.fail();
  } catch (err) {
    t.pass();
  }
});

test('serializer', function(t) {
  var serializer = {
    stringify: function() {
      return 'XXX' + JSON.stringify.apply(JSON, arguments);
    },
    parse: function(x) {
      t.ok(x.match(/^XXX/));
      return JSON.parse(x.substring(3));
    },
  };
  t.equal(serializer.stringify('UnitTest'), 'XXX"UnitTest"');
  t.equal(serializer.parse(serializer.stringify('UnitTest')), 'UnitTest');

  var store = new RedisStore({ port: redisSrv.port, serializer: serializer });
  return lifecycleTest(store, t);
});

test('logErrors', function(t) {
  // Default to true, thus using console.error
  var store = new RedisStore();
  t.equal(typeof store.logErrors, 'function');
  store.client.end(false);

  // Disabled logging
  store = new RedisStore({ logErrors: false });
  t.equal(store.logErrors, false);
  store.client.end(false);

  // Using custom function
  var logErrors = function(error) {
    console.warn('Error caught: ', error);
  };
  store = new RedisStore({ logErrors });
  t.equal(store.logErrors, logErrors);
  store.client.end(false);
  t.end();
});

test('teardown', redisSrv.disconnect);

async function lifecycleTest(store, t) {
  let table = [
    {
      method: 'set',
      in: ['123', { cookie: { maxAge: 2000 }, name: 'tj' }],
      out: 'OK',
    },
    {
      method: 'get',
      in: ['123'],
      out: { cookie: { maxAge: 2000 }, name: 'tj' },
    },
    {
      method: 'set',
      in: ['123', { cookie: { maxAge: undefined } }],
      out: 'OK',
    },
    {
      method: 'all',
      in: [],
      out: [{ id: '123', cookie: {} }],
    },
    {
      method: 'ids',
      in: [],
      out: ['123'],
    },
    {
      method: 'length',
      in: [],
      out: 1,
    },
    {
      method: 'destroy',
      in: ['123'],
      out: 1,
    },
  ];

  for (let tt of table) {
    let out = await p(store, tt.method)(...tt.in);
    t.deepEqual(out, tt.out);
  }

  store.client.end(false);
}

function assertSetCalledWith(t, store, sid, data, addl) {
  var args = [store.prefix + sid, store.serializer.stringify(data)];
  if (Array.isArray(addl)) args = args.concat(addl);
  t.deepEqual(
    store.client.set.lastCall.args[0],
    args,
    '#.set() called with expected params'
  );
}

var p = (ctx, method) => (...args) =>
  new Promise((resolve, reject) => {
    ctx[method](...args, (err, d) => {
      if (err) reject(err);
      resolve(d);
    });
  });
