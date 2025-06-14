import {type SessionData, Store} from "express-session"
import type {RedisClientType, RedisClusterType} from "redis"

type Callback = (_err?: unknown, _data?: any) => any

function optionalCb(err: unknown, data: unknown, cb?: Callback) {
  if (cb) return cb(err, data)
  if (err) throw err
  return data
}

interface Serializer {
  parse(s: string): SessionData | Promise<SessionData>
  stringify(s: SessionData): string
}

interface RedisStoreOptions {
  client: any
  prefix?: string
  scanCount?: number
  serializer?: Serializer
  ttl?: number | ((sess: SessionData) => number)
  disableTTL?: boolean
  disableTouch?: boolean
}

export class RedisStore extends Store {
  client: RedisClientType | RedisClusterType
  prefix: string
  scanCount: number
  serializer: Serializer
  ttl: number | ((sess: SessionData) => number)
  disableTTL: boolean
  disableTouch: boolean

  constructor(opts: RedisStoreOptions) {
    super()
    this.prefix = opts.prefix == null ? "sess:" : opts.prefix
    this.scanCount = opts.scanCount || 100
    this.serializer = opts.serializer || JSON
    this.ttl = opts.ttl || 86400 // One day in seconds.
    this.disableTTL = opts.disableTTL || false
    this.disableTouch = opts.disableTouch || false
    this.client = opts.client
  }

  async get(sid: string, cb?: Callback) {
    let key = this.prefix + sid
    try {
      let data = await this.client.get(key)
      if (!data) return optionalCb(null, null, cb)
      return optionalCb(null, await this.serializer.parse(data), cb)
    } catch (err) {
      return optionalCb(err, null, cb)
    }
  }

  async set(sid: string, sess: SessionData, cb?: Callback) {
    let key = this.prefix + sid
    let ttl = this.getTTL(sess)
    try {
      if (ttl > 0) {
        let val = this.serializer.stringify(sess)
        if (this.disableTTL) await this.client.set(key, val)
        else
          await this.client.set(key, val, {
            expiration: {type: "EX", value: ttl},
          })
        return optionalCb(null, null, cb)
      }
      return this.destroy(sid, cb)
    } catch (err) {
      return optionalCb(err, null, cb)
    }
  }

  async touch(sid: string, sess: SessionData, cb?: Callback) {
    let key = this.prefix + sid
    if (this.disableTouch || this.disableTTL) return optionalCb(null, null, cb)
    try {
      await this.client.expire(key, this.getTTL(sess))
      return optionalCb(null, null, cb)
    } catch (err) {
      return optionalCb(err, null, cb)
    }
  }

  async destroy(sid: string, cb?: Callback) {
    let key = this.prefix + sid
    try {
      await this.client.del([key])
      return optionalCb(null, null, cb)
    } catch (err) {
      return optionalCb(err, null, cb)
    }
  }

  async clear(cb?: Callback) {
    try {
      let keys = await this.getAllKeys()
      if (!keys.length) return optionalCb(null, null, cb)
      await this.client.del(keys)
      return optionalCb(null, null, cb)
    } catch (err) {
      return optionalCb(err, null, cb)
    }
  }

  async length(cb?: Callback) {
    try {
      let keys = await this.getAllKeys()
      return optionalCb(null, keys.length, cb)
    } catch (err) {
      return optionalCb(err, null, cb)
    }
  }

  async ids(cb?: Callback) {
    let len = this.prefix.length
    try {
      let keys = await this.getAllKeys()
      return optionalCb(
        null,
        keys.map((k) => k.substring(len)),
        cb,
      )
    } catch (err) {
      return optionalCb(err, null, cb)
    }
  }

  async all(cb?: Callback) {
    let len = this.prefix.length
    try {
      let keys = await this.getAllKeys()
      if (keys.length === 0) return optionalCb(null, [], cb)

      let data = await this.client.mGet(keys)
      let results = data.reduce((acc, raw, idx) => {
        if (!raw) return acc
        let sess = this.serializer.parse(raw) as any
        sess.id = keys[idx].substring(len)
        acc.push(sess)
        return acc
      }, [] as SessionData[])
      return optionalCb(null, results, cb)
    } catch (err) {
      return optionalCb(err, null, cb)
    }
  }

  private getTTL(sess: SessionData) {
    if (typeof this.ttl === "function") {
      return this.ttl(sess)
    }

    let ttl
    if (sess?.cookie?.expires) {
      let ms = Number(new Date(sess.cookie.expires)) - Date.now()
      ttl = Math.ceil(ms / 1000)
    } else {
      ttl = this.ttl
    }
    return ttl
  }

  private async getAllKeys() {
    let pattern = this.prefix + "*"
    let set = new Set<string>()
    for await (let keys of this.scanIterator(pattern, this.scanCount)) {
      for (let key of keys) {
        set.add(key)
      }
    }
    return set.size > 0 ? Array.from(set) : []
  }

  private scanIterator(match: string, count: number) {
    let client = this.client

    if (!("masters" in client)) {
      return client.scanIterator({MATCH: match, COUNT: count})
    }

    return (async function* () {
      for (let master of client.masters) {
        let c = await client.nodeClient(master)
        for await (let keys of c.scanIterator({
          COUNT: count,
          MATCH: match,
        })) {
          yield keys
        }
      }
    })()
  }
}
