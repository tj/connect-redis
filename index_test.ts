import {Cookie} from "express-session"
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
  client.destroy()
})

test("redis", async () => {
  let client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()
  let store = new RedisStore({client})
  await lifecycleTest(store, client)
  client.destroy()
})

test("teardown", redisSrv.disconnect)

async function lifecycleTest(store: RedisStore, client: any): Promise<void> {
  let res = await store.clear()

  let sess = {foo: "bar", cookie: {originalMaxAge: null}}
  await store.set("123", sess)

  res = await store.get("123")
  expect(res).toEqual(sess)

  let ttl = await client.ttl("sess:123")
  expect(ttl).toBeGreaterThanOrEqual(86399)

  ttl = 60
  let expires = new Date(Date.now() + ttl * 1000)
  await store.set("456", {cookie: {originalMaxAge: null, expires}})
  ttl = await client.ttl("sess:456")
  expect(ttl).toBeLessThanOrEqual(60)

  ttl = 90
  let expires2 = new Date(Date.now() + ttl * 1000)
  await store.touch("456", {cookie: {originalMaxAge: null, expires: expires2}})
  ttl = await client.ttl("sess:456")
  expect(ttl).toBeGreaterThan(60)

  res = await store.length()
  expect(res).toBe(2) // stored two keys length

  res = await store.ids()
  res.sort()
  expect(res).toEqual(["123", "456"])

  res = await store.all()
  res.sort((a: any, b: any) => (a.id > b.id ? 1 : -1))
  expect(res).toEqual([
    {id: "123", foo: "bar", cookie: {originalMaxAge: null}},
    {id: "456", cookie: {originalMaxAge: null, expires: expires.toISOString()}},
  ])

  await store.destroy("456")
  res = await store.length()
  expect(res).toBe(1) // one key remains

  res = await store.clear()

  res = await store.length()
  expect(res).toBe(0) // no keys remain

  let count = 1000
  await load(store, count)

  res = await store.length()
  expect(res).toBe(count)

  await store.clear()
  res = await store.length()
  expect(res).toBe(0)

  expires = new Date(Date.now() + ttl * 1000) // expires in the future
  res = await store.set("789", {cookie: {originalMaxAge: null, expires}})

  res = await store.length()
  expect(res).toBe(1)

  expires = new Date(Date.now() - ttl * 1000) // expires in the past
  await store.set("789", {cookie: {originalMaxAge: null, expires}})

  res = await store.length()
  expect(res).toBe(0) // no key remains and that includes session 789
}

async function load(store: RedisStore, count: number) {
  let cookie = new Cookie()
  for (let sid = 0; sid < count; sid++) {
    cookie.expires = new Date(Date.now() + 1000)
    await store.set("s" + sid, {cookie})
  }
}
