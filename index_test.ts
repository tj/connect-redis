import {Cookie} from "express-session"
import {Redis} from "ioredis"
import {promisify} from "node:util"
import {createClient} from "redis"
import {expect, test} from "vitest"
import {RedisStore} from "./"
import * as redisSrv from "./testdata/server"

test("setup", async () => {
  await redisSrv.connect()
})

test("defaults", async () => {
  let client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()

  let store = new RedisStore({client})

  expect(store.client).toBeDefined()
  expect(store.prefix).toBe("sess:")
  expect(store.ttl).toBe(86400) // defaults to one day
  expect(store.scanCount).toBe(100)
  expect(store.serializer).toBe(JSON)
  expect(store.disableTouch).toBe(false)
  expect(store.disableTTL).toBe(false)
  await client.disconnect()
})

test("redis", async () => {
  let client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()
  let store = new RedisStore({client})
  await lifecycleTest(store, client)
  await client.disconnect()
})

test("ioredis", async () => {
  let client = new Redis(`redis://localhost:${redisSrv.port}`)
  let store = new RedisStore({client})
  await lifecycleTest(store, client)
  client.disconnect()
})

test("teardown", redisSrv.disconnect)

async function lifecycleTest(store: RedisStore, client: any): Promise<void> {
  const P = (f: any) => promisify(f).bind(store)
  let res = await P(store.clear)()

  let sess = {foo: "bar"}
  await P(store.set)("123", sess)

  res = await P(store.get)("123")
  expect(res).toEqual(sess)

  let ttl = await client.ttl("sess:123")
  expect(ttl).toBeGreaterThanOrEqual(86399)

  ttl = 60
  let expires = new Date(Date.now() + ttl * 1000).toISOString()
  await P(store.set)("456", {cookie: {expires}})
  ttl = await client.ttl("sess:456")
  expect(ttl).toBeLessThanOrEqual(60)

  ttl = 90
  let expires2 = new Date(Date.now() + ttl * 1000).toISOString()
  await P(store.touch)("456", {cookie: {expires: expires2}})
  ttl = await client.ttl("sess:456")
  expect(ttl).toBeGreaterThan(60)

  res = await P(store.length)()
  expect(res).toBe(2) // stored two keys length

  res = await P(store.ids)()
  res.sort()
  expect(res).toEqual(["123", "456"])

  res = await P(store.all)()
  res.sort((a: any, b: any) => (a.id > b.id ? 1 : -1))
  expect(res).toEqual([
    {id: "123", foo: "bar"},
    {id: "456", cookie: {expires}},
  ])

  await P(store.destroy)("456")
  res = await P(store.length)()
  expect(res).toBe(1) // one key remains

  res = await P(store.clear)()

  res = await P(store.length)()
  expect(res).toBe(0) // no keys remain

  let count = 1000
  await load(store, count)

  res = await P(store.length)()
  expect(res).toBe(count)

  await P(store.clear)()
  res = await P(store.length)()
  expect(res).toBe(0)

  expires = new Date(Date.now() + ttl * 1000).toISOString() // expires in the future
  res = await P(store.set)("789", {cookie: {expires}})

  res = await P(store.length)()
  expect(res).toBe(1)

  expires = new Date(Date.now() - ttl * 1000).toISOString() // expires in the past
  await P(store.set)("789", {cookie: {expires}})

  res = await P(store.length)()
  expect(res).toBe(0) // no key remains and that includes session 789
}

async function load(store: RedisStore, count: number) {
  let cookie = new Cookie()
  for (let sid = 0; sid < count; sid++) {
    cookie.expires = new Date(Date.now() + 1000)
    await store.set("s" + sid, {cookie})
  }
}
