import {Cookie} from "express-session"
import {Redis} from "ioredis"
import {promisify} from "node:util"
import {createClient} from "redis"
import {expect, test} from "vitest"
import {RedisStore} from "./"
import * as redisSrv from "./testdata/server"
import { vi } from "vitest"

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


test("error handling", async () => {
  // Create a mock client that throws errors
  const mockClient = {
    get: vi.fn().mockRejectedValue(new Error("get error")),
    set: vi.fn().mockRejectedValue(new Error("set error")),
    expire: vi.fn().mockRejectedValue(new Error("expire error")),
    del: vi.fn().mockRejectedValue(new Error("del error")),
    mget: vi.fn().mockRejectedValue(new Error("mget error")),
    scanIterator: vi.fn().mockImplementation(() => {
      throw new Error("scan error")
    })
  }
  
  const store = new RedisStore({client: mockClient})
  
  // Test get error handling
  await expect(promisify(store.get.bind(store))("test-id"))
    .rejects.toThrow("get error")
  
  // Test set error handling
  await expect(promisify(store.set.bind(store))("test-id", {cookie: {}}))
    .rejects.toThrow("set error")
  
  // Test touch error handling
  await expect(promisify(store.touch.bind(store))("test-id", {cookie: {}}))
    .rejects.toThrow("expire error")
  
  // Test destroy error handling
  await expect(promisify(store.destroy.bind(store))("test-id"))
    .rejects.toThrow("del error")
  
  // Test clear error handling
  await expect(promisify(store.clear.bind(store))())
    .rejects.toThrow("scan error")
  
  // Test length error handling
  await expect(promisify(store.length.bind(store))())
    .rejects.toThrow("scan error")
  
  // Test ids error handling
  await expect(promisify(store.ids.bind(store))())
    .rejects.toThrow("scan error")
  
  // Test all error handling
  await expect(promisify(store.all.bind(store))())
    .rejects.toThrow("scan error")
})


test("clear length and ids methods", async () => {
  const client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()
  
  const store = new RedisStore({client})
  
  // Clear any existing sessions
  await promisify(store.clear.bind(store))()
  
  // Create multiple sessions
  const sessions = [
    { id: "session1", data: { cookie: {}, value: "data1" } },
    { id: "session2", data: { cookie: {}, value: "data2" } },
    { id: "session3", data: { cookie: {}, value: "data3" } }
  ]
  
  for (const session of sessions) {
    await promisify(store.set.bind(store))(session.id, session.data)
  }
  
  // Test length
  const length = await promisify(store.length.bind(store))()
  expect(length).toBe(sessions.length)
  
  // Test ids
  const ids = await promisify(store.ids.bind(store))()
  expect(ids).toHaveLength(sessions.length)
  expect(ids.sort()).toEqual(sessions.map(s => s.id).sort())
  
  // Test clear
  await promisify(store.clear.bind(store))()
  const lengthAfterClear = await promisify(store.length.bind(store))()
  expect(lengthAfterClear).toBe(0)
  
  await client.disconnect()
})


test("session with expired cookie", async () => {
  const client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()
  
  const store = new RedisStore({client})
  const sid = "expired-session-id"
  
  // Create a session with an expired cookie
  const pastDate = new Date(Date.now() - 10000) // 10 seconds in the past
  const sess = {
    cookie: { expires: pastDate }
  }
  
  // Set should call destroy internally for expired sessions
  const destroySpy = vi.spyOn(store, 'destroy')
  await promisify(store.set.bind(store))(sid, sess)
  
  // Verify destroy was called
  expect(destroySpy).toHaveBeenCalledWith(sid, expect.any(Function))
  
  // Verify session doesn't exist
  const result = await promisify(store.get.bind(store))(sid)
  expect(result).toBeUndefined()
  
  destroySpy.mockRestore()
  await client.disconnect()
})


test("get non-existent session", async () => {
  const client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()
  
  const store = new RedisStore({client})
  const sid = "non-existent-session-id"
  
  const result = await promisify(store.get.bind(store))(sid)
  expect(result).toBeUndefined()
  
  await client.disconnect()
})


test("custom store options", async () => {
  const client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()
  
  const customSerializer = {
    parse: (s: string) => JSON.parse(s),
    stringify: (s: any) => JSON.stringify(s)
  }
  
  const customTtl = 3600
  const customPrefix = "custom-prefix:"
  const customScanCount = 200
  
  const store = new RedisStore({
    client,
    prefix: customPrefix,
    scanCount: customScanCount,
    ttl: customTtl,
    disableTTL: true,
    disableTouch: true,
    serializer: customSerializer
  })
  
  expect(store.prefix).toBe(customPrefix)
  expect(store.scanCount).toBe(customScanCount)
  expect(store.ttl).toBe(customTtl)
  expect(store.disableTTL).toBe(true)
  expect(store.disableTouch).toBe(true)
  expect(store.serializer).toBe(customSerializer)
  
  await client.disconnect()
})


test("complete session lifecycle", async () => {
  const client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()
  
  const store = new RedisStore({client})
  const sid = "test-session-id"
  const sess = {
    cookie: { maxAge: 2000 },
    name: "test-session"
  }
  
  // Set session
  await promisify(store.set.bind(store))(sid, sess)
  
  // Get session
  const result = await promisify(store.get.bind(store))(sid)
  expect(result).toEqual(sess)
  
  // Touch session
  await promisify(store.touch.bind(store))(sid, sess)
  
  // Destroy session
  await promisify(store.destroy.bind(store))(sid)
  
  // Verify session is gone
  const afterDestroy = await promisify(store.get.bind(store))(sid)
  expect(afterDestroy).toBeUndefined()
  
  await client.disconnect()
})

