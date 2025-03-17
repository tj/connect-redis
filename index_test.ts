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


test("null or undefined client", () => {
  // Test with null client
  expect(() => {
    new RedisStore({ client: null })
  }).toThrow()
  
  // Test with undefined client
  expect(() => {
    new RedisStore({ client: undefined })
  }).toThrow()
})


test("negative TTL value", async () => {
  const client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()
  
  const store = new RedisStore({client})
  const sid = "negative-ttl-session"
  
  // Create a session with a cookie that expired in the past
  const pastDate = new Date(Date.now() - 1000000) // Far in the past
  const sess = {
    cookie: { expires: pastDate }
  }
  
  // Spy on destroy method
  const destroySpy = vi.spyOn(store, 'destroy')
  
  // Set the session (should call destroy internally)
  await promisify(store.set.bind(store))(sid, sess)
  
  // Verify destroy was called
  expect(destroySpy).toHaveBeenCalledWith(sid, expect.any(Function))
  
  // Verify session doesn't exist
  const result = await promisify(store.get.bind(store))(sid)
  expect(result).toBeUndefined()
  
  destroySpy.mockRestore()
  await client.disconnect()
})


test("corrupted session data", async () => {
  const client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()
  
  const store = new RedisStore({client})
  const sid = "corrupted-session"
  const key = store.prefix + sid
  
  // Directly set invalid JSON in Redis
  await client.set(key, "{invalid json")
  
  // Attempt to get the corrupted session
  const getCallback = vi.fn()
  await store.get(sid, getCallback)
  
  // Verify the error was passed to the callback
  expect(getCallback).toHaveBeenCalledWith(expect.any(Error))
  
  // Clean up
  await client.del(key)
  await client.disconnect()
})


test("extremely large session data", async () => {
  const client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()
  
  const store = new RedisStore({client})
  const sid = "large-data-session"
  
  // Create a large nested object
  const generateLargeObject = (depth: number, breadth: number, size: number): any => {
    if (depth === 0) {
      return "x".repeat(size)
    }
    
    const obj: Record<string, any> = {}
    for (let i = 0; i < breadth; i++) {
      obj[`key${i}`] = generateLargeObject(depth - 1, breadth, size)
    }
    return obj
  }
  
  // Create a session with large nested data (approximately 1MB)
  const largeData = generateLargeObject(3, 5, 1000)
  const sess = {
    cookie: {},
    largeData
  }
  
  // Set and get the session
  await promisify(store.set.bind(store))(sid, sess)
  const result = await promisify(store.get.bind(store))(sid)
  
  // Verify the data was stored and retrieved correctly
  expect(result).toEqual(sess)
  expect(JSON.stringify(result?.largeData).length).toEqual(JSON.stringify(largeData).length)
  
  await client.disconnect()
})


test("custom TTL function", async () => {
  const client = createClient({url: `redis://localhost:${redisSrv.port}`})
  await client.connect()
  
  // Create a custom TTL function that returns different TTLs based on session data
  const ttlFunction = (sess: any) => {
    if (sess.priority === "high") return 3600 // 1 hour
    if (sess.priority === "medium") return 1800 // 30 minutes
    return 600 // 10 minutes for low priority
  }
  
  const store = new RedisStore({
    client,
    ttl: ttlFunction
  })
  
  // Test with different priority sessions
  const highPrioritySid = "high-priority-session"
  const mediumPrioritySid = "medium-priority-session"
  const lowPrioritySid = "low-priority-session"
  
  const highPrioritySession = { cookie: {}, priority: "high" }
  const mediumPrioritySession = { cookie: {}, priority: "medium" }
  const lowPrioritySession = { cookie: {}, priority: "low" }
  
  // Spy on client.set to verify TTL values
  const setSpy = vi.spyOn(store.client, 'set')
  
  // Set sessions
  await promisify(store.set.bind(store))(highPrioritySid, highPrioritySession)
  expect(setSpy).toHaveBeenLastCalledWith(
    expect.stringContaining(highPrioritySid), 
    expect.any(String), 
    3600
  )
  
  await promisify(store.set.bind(store))(mediumPrioritySid, mediumPrioritySession)
  expect(setSpy).toHaveBeenLastCalledWith(
    expect.stringContaining(mediumPrioritySid), 
    expect.any(String), 
    1800
  )
  
  await promisify(store.set.bind(store))(lowPrioritySid, lowPrioritySession)
  expect(setSpy).toHaveBeenLastCalledWith(
    expect.stringContaining(lowPrioritySid), 
    expect.any(String), 
    600
  )
  
  setSpy.mockRestore()
  await client.disconnect()
})


test("ioredis client scanIterator implementation", async () => {
  const client = new Redis(`redis://localhost:${redisSrv.port}`)
  
  const store = new RedisStore({client})
  
  // Clear any existing sessions
  await promisify(store.clear.bind(store))()
  
  // Create multiple sessions
  const sessions = [
    { id: "ioredis1", data: { cookie: {}, value: "data1" } },
    { id: "ioredis2", data: { cookie: {}, value: "data2" } },
    { id: "ioredis3", data: { cookie: {}, value: "data3" } }
  ]
  
  for (const session of sessions) {
    await promisify(store.set.bind(store))(session.id, session.data)
  }
  
  // Test that _getAllKeys works with ioredis client
  const keys = await store["_getAllKeys"]()
  expect(keys).toHaveLength(sessions.length)
  
  // Test that all method works with ioredis client
  const allSessions = await promisify(store.all.bind(store))()
  expect(allSessions).toHaveLength(sessions.length)
  
  // Verify session data is correctly retrieved
  for (const session of allSessions) {
    expect(session.value).toMatch(/data[1-3]/)
  }
  
  await client.disconnect()
})

