let test = require('blue-tape')
let redisSrv = require('../test/redis-server')
let session = require('express-session')
let RedisStore = require('../')(session)
let redis = require('redis')
var ioRedis = require('ioredis')
var redisMock = require('redis-mock')

var p = (ctx, method) => (...args) =>
  new Promise((resolve, reject) => {
    ctx[method](...args, (err, d) => {
      if (err) reject(err)
      resolve(d)
    })
  })

test('setup', redisSrv.connect)

test('defaults', async t => {
  t.throws(() => new RedisStore(), 'client is required')

  var client = redis.createClient(redisSrv.port, 'localhost')
  var store = new RedisStore({ client })

  t.equal(store.client, client, 'stores client')
  t.equal(store.prefix, 'sess:', 'defaults to sess:')
  t.equal(store.ttl, 86400, 'defaults to one day')
  t.equal(store.scanCount, 100, 'defaults SCAN count to 100')
  t.equal(store.serializer, JSON, 'defaults to JSON serialization')
  t.equal(store.disableTouch, false, 'defaults to having `touch` enabled')
  client.end(false)
})

test('node_redis', async t => {
  var client = redis.createClient(redisSrv.port, 'localhost')
  var store = new RedisStore({ client })
  await lifecycleTest(store, t)
  client.end(false)
})

test('ioredis', async t => {
  var client = ioRedis.createClient(redisSrv.port, 'localhost')
  var store = new RedisStore({ client })
  await lifecycleTest(store, t)
  client.disconnect()
})

test('redis-mock client', async t => {
  var client = redisMock.createClient()
  var store = new RedisStore({ client })
  await lifecycleTest(store, t)
})

test('teardown', redisSrv.disconnect)

async function lifecycleTest(store, t) {
  let res = await p(store, 'set')('123', { foo: 'bar' })
  t.equal(res, 'OK', 'set value')

  res = await p(store, 'get')('123')
  t.same(res, { foo: 'bar' }, 'get value')

  res = await p(store.client, 'ttl')('sess:123')
  t.ok(res >= 86399, 'check one day ttl')

  let ttl = 60
  let expires = new Date(Date.now() + ttl * 1000).toISOString()
  res = await p(store, 'set')('456', { cookie: { expires } })
  t.equal(res, 'OK', 'set cookie expires')

  res = await p(store.client, 'ttl')('sess:456')
  t.ok(res <= 60, 'check expires ttl')

  ttl = 90
  expires = new Date(Date.now() + ttl * 1000).toISOString()
  res = await p(store, 'touch')('456', { cookie: { expires } })
  t.equal(res, 'OK', 'set cookie expires touch')

  res = await p(store.client, 'ttl')('sess:456')
  t.ok(res >= 60, 'check expires ttl touch')

  res = await p(store, 'length')()
  t.equal(res, 2, 'stored two keys length')

  res = await p(store, 'ids')()
  res.sort()
  t.same(res, ['123', '456'], 'stored two keys ids')

  res = await p(store, 'all')()
  res.sort((a, b) => (a.id > b.id ? 1 : -1))
  t.same(
    res,
    [{ id: '123', foo: 'bar' }, { id: '456', cookie: { expires } }],
    'stored two keys data'
  )

  res = await p(store, 'destroy')('456')
  t.equal(res, 1, 'destroyed one')

  res = await p(store, 'length')()
  t.equal(res, 1, 'one key remains')

  res = await p(store, 'clear')()
  t.equal(res, 1, 'cleared remaining key')

  res = await p(store, 'length')()
  t.equal(res, 0, 'no key remains')
}
