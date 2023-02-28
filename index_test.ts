import test from "blue-tape"
import {Cookie} from "express-session"
import {Redis} from "ioredis"
import {promisify} from "node:util"
import {createClient} from "redis"
import RedisStore from "./"
import * as redisSrv from "./testdata/server"

test("setup", redisSrv.connect)

test("defaults", async (t) => {
  let client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()

  let store = new RedisStore({client})

  t.ok(store.client, "stores client")
  t.equal(store.prefix, "sess:", "defaults to sess:")
  t.equal(store.ttl, 86400, "defaults to one day")
  t.equal(store.scanCount, 100, "defaults SCAN count to 100")
  t.equal(store.serializer, JSON, "defaults to JSON serialization")
  t.equal(store.disableTouch, false, "defaults to having `touch` enabled")
  t.equal(store.disableTTL, false, "defaults to having `ttl` enabled")
  await client.disconnect()
})

test("redis", async (t) => {
  let client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()
  let store = new RedisStore({client})
  await lifecycleTest(store, client, t)
  await client.disconnect()
})

test("ioredis", async (t) => {
  let client = new Redis(`redis://localhost:${redisSrv.port}`)
  let store = new RedisStore({client})
  await lifecycleTest(store, client, t)
  client.disconnect()
})

test("teardown", redisSrv.disconnect)

async function lifecycleTest(
  store: RedisStore,
  client: any,
  t: test.Test
): Promise<void> {
  const P = (f: any) => promisify(f).bind(store)
  let res = await P(store.clear)()

  let sess = {foo: "bar"}
  await P(store.set)("123", sess)

  res = await P(store.get)("123")
  t.same(res, sess, "store.get")

  let ttl = await client.ttl("sess:123")
  t.ok(ttl >= 86399, "check one day ttl")

  ttl = 60
  let expires = new Date(Date.now() + ttl * 1000).toISOString()
  await P(store.set)("456", {cookie: {expires}})
  ttl = await client.ttl("sess:456")
  t.ok(ttl <= 60, "check expires ttl")

  ttl = 90
  let expires2 = new Date(Date.now() + ttl * 1000).toISOString()
  await P(store.touch)("456", {cookie: {expires: expires2}})
  ttl = await client.ttl("sess:456")
  t.ok(ttl > 60, "check expires ttl touch")

  res = await P(store.length)()
  t.equal(res, 2, "stored two keys length")

  res = await P(store.ids)()
  res.sort()
  t.same(res, ["123", "456"], "stored two keys ids")

  res = await P(store.all)()
  res.sort((a: any, b: any) => (a.id > b.id ? 1 : -1))
  t.same(
    res,
    [
      {id: "123", foo: "bar"},
      {id: "456", cookie: {expires}},
    ],
    "stored two keys data"
  )

  await P(store.destroy)("456")
  res = await P(store.length)()
  t.equal(res, 1, "one key remains")

  res = await P(store.clear)()

  res = await P(store.length)()
  t.equal(res, 0, "no keys remain")

  let count = 1000
  await load(store, count)

  res = await P(store.length)()
  t.equal(res, count, "bulk count")

  await P(store.clear)()
  res = await P(store.length)()
  t.equal(res, 0, "bulk clear")

  expires = new Date(Date.now() + ttl * 1000).toISOString() // expires in the future
  res = await P(store.set)("789", {cookie: {expires}})

  res = await P(store.length)()
  t.equal(res, 1, "one key exists (session 789)")

  expires = new Date(Date.now() - ttl * 1000).toISOString() // expires in the past
  await P(store.set)("789", {cookie: {expires}})

  res = await P(store.length)()
  t.equal(res, 0, "no key remains and that includes session 789")
}

async function load(store: RedisStore, count: number) {
  let cookie = new Cookie()
  for (let sid = 0; sid < count; sid++) {
    cookie.expires = new Date(Date.now() + 1000)
    await store.set("s" + sid, {cookie})
  }
}
