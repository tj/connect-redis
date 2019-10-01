/*!
 * Connect - Redis
 * Copyright(c) 2012 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

module.exports = function(session) {
  const Store = session.Store

  // All callbacks should have a noop if none provided for compatibility
  // with the most Redis clients.
  const noop = () => {}

  class RedisStore extends Store {
    constructor(options = {}) {
      super(options)
      if (!options.client) {
        throw new Error('A client must be directly provided to the RedisStore')
      }

      this.prefix = options.prefix == null ? 'sess:' : options.prefix
      this.scanCount = Number(options.scanCount) || 100
      this.serializer = options.serializer || JSON
      this.client = options.client
      this.ttl = options.ttl || 86400 // One day in seconds.
      this.disableTouch = options.disableTouch || false
    }

    get(sid, cb = noop) {
      let key = this.prefix + sid

      this.client.get(key, (err, data) => {
        if (err) return cb(err)
        if (!data) return cb()

        let result
        try {
          result = this.serializer.parse(data)
        } catch (err) {
          return cb(err)
        }
        return cb(null, result)
      })
    }

    set(sid, sess, cb = noop) {
      let args = [this.prefix + sid]

      let value
      try {
        value = this.serializer.stringify(sess)
      } catch (er) {
        return cb(er)
      }
      args.push(value)
      args.push('EX', this._getTTL(sess))

      this.client.set(args, cb)
    }

    touch(sid, sess, cb = noop) {
      if (this.disableTouch) return cb()

      let key = this.prefix + sid
      this.client.expire(key, this._getTTL(sess), (err, ret) => {
        if (err) return cb(err)
        if (ret !== 1) return cb(null, 'EXPIRED')
        cb(null, 'OK')
      })
    }

    destroy(sid, cb = noop) {
      let key = this.prefix + sid
      this.client.del(key, cb)
    }

    clear(cb = noop) {
      this._getAllKeys((err, keys) => {
        if (err) return cb(err)
        this.client.del(keys, cb)
      })
    }

    length(cb = noop) {
      this._getAllKeys((err, keys) => {
        if (err) return cb(err)
        return cb(null, keys.length)
      })
    }

    ids(cb = noop) {
      let prefixLen = this.prefix.length

      this._getAllKeys((err, keys) => {
        if (err) return cb(err)
        keys = keys.map(key => key.substr(prefixLen))
        return cb(null, keys)
      })
    }

    all(cb = noop) {
      let prefixLen = this.prefix.length

      this._getAllKeys((err, keys) => {
        if (err) return cb(err)
        if (keys.length === 0) return cb(null, [])

        this.client.mget(keys, (err, sessions) => {
          if (err) return cb(err)

          let result
          try {
            result = sessions.map((data, index) => {
              data = this.serializer.parse(data)
              data.id = keys[index].substr(prefixLen)
              return data
            })
          } catch (e) {
            err = e
          }
          return cb(err, result)
        })
      })
    }

    _getTTL(sess) {
      let ttl
      if (sess && sess.cookie && sess.cookie.expires) {
        let ms = Number(new Date(sess.cookie.expires)) - Date.now()
        ttl = Math.ceil(ms / 1000)
      } else {
        ttl = this.ttl
      }
      return ttl
    }

    _getAllKeys(cb = noop) {
      let pattern = this.prefix + '*'
      this._scanKeys({}, 0, pattern, this.scanCount, cb)
    }

    _scanKeys(keys = {}, cursor, pattern, count, cb = noop) {
      let args = [cursor, 'match', pattern, 'count', count]
      this.client.scan(args, (err, data) => {
        if (err) return cb(err)

        let [nextCursorId, scanKeys] = data
        for (let key of scanKeys) {
          keys[key] = true
        }

        // This can be a string or a number. We check both.
        if (Number(nextCursorId) !== 0) {
          return this._scanKeys(keys, nextCursorId, pattern, count, cb)
        }

        cb(null, Object.keys(keys))
      })
    }
  }

  return RedisStore
}
