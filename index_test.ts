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

