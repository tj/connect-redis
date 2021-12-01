/*!
 * Connect - Redis
 * Copyright(c) 2010-2020 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

module.exports = function (session) {
  const Store = session.Store

  // All callbacks should have a noop if none provided for compatibility
  // with the most Redis clients.
  const noop = () => {}
  const TOMBSTONE = 'TOMBSTONE'

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
      this.disableTTL = options.disableTTL || false
      this.disableTouch = options.disableTouch || false
    }

    get(sid, cb = noop, showTombs = false) {
      let key = this.prefix + sid

      this.client
        .GET(key)
        .then((data) => {
          if (!data) {
            cb()
            return
          }
          if (data === TOMBSTONE) {
            cb(null, showTombs ? data : undefined)
            return
          }

          let result
          try {
            result = this.serializer.parse(data)
          } catch (err) {
            cb(err)
            return
          }
          cb(null, result)
        })
        .catch((err) => {
          cb(err)
        })
    }

    set(sid, sess, cb = noop) {
      this.get(
        sid,
        (err, oldSess) => {
          if (oldSess === TOMBSTONE) {
            return cb()
          } else if (oldSess && oldSess.lastModified !== sess.lastModified) {
            sess = mergeDeep(oldSess, sess)
          }
          let args = ['SET', this.prefix + sid]
          let value
          sess.lastModified = Date.now()
          try {
            value = this.serializer.stringify(sess)
          } catch (er) {
            return cb(er)
          }
          args.push(value)
          args.push('EX', this._getTTL(sess))

          let ttl = 1
          if (!this.disableTTL) {
            ttl = this._getTTL(sess)
            args.push('EX', ttl)
          }

          if (ttl > 0) {
            this.client
              .sendCommand(args)
              .then((r) => {
                cb(null, r)
              })
              .catch((err) => {
                cb(err)
              })
          } else {
            // If the resulting TTL is negative we can delete / destroy the key
            this.destroy(sid, cb)
          }
        },
        true
      )
    }

    touch(sid, sess, cb = noop) {
      if (this.disableTouch || this.disableTTL) return cb()
      let key = this.prefix + sid
      this.client
        .EXPIRE(key, this._getTTL(sess))
        .then((ret) => {
          if (ret !== 1) return cb(null, 'EXPIRED')
          return cb(null, 'OK')
        })
        .catch((err) => {
          return cb(err)
        })
    }

    destroy(sid, cb = noop) {
      let key = this.prefix + sid
      this.client
        .sendCommand(['SET', key, TOMBSTONE, 'EX', '300'])
        .then((r) => {
          cb(r)
        })
        .catch((err) => {
          cb(err, 1)
        })
    }

    clear(cb = noop) {
      this._getAllKeys((err, keys) => {
        if (err) return cb(err)
        this.client
          .DEL(keys)
          .then((r) => {
            cb(r)
          })
          .catch((err) => {
            cb(err)
          })
      })
    }

    length(cb = noop) {
      this.all((err, result) => {
        if (err) return cb(err)
        return cb(null, result.length)
      })
    }

    ids(cb = noop) {
      let prefixLen = this.prefix.length

      this._getAllKeys((err, keys) => {
        if (err) return cb(err)
        keys = keys.map((key) => key.substr(prefixLen))
        return cb(null, keys)
      })
    }

    all(cb = noop) {
      let prefixLen = this.prefix.length

      this._getAllKeys((err, keys) => {
        if (err) return cb(err)
        if (keys.length === 0) return cb(null, [])

        this.client
          .MGET(keys)
          .then((sessions) => {
            let result
            try {
              result = sessions.reduce((accum, data, index) => {
                if (!data || data === TOMBSTONE) return accum
                data = this.serializer.parse(data)
                data.id = keys[index].substr(prefixLen)
                accum.push(data)
                return accum
              }, [])
            } catch (e) {
              err = e
            }
            return cb(err, result)
          })
          .catch((err) => {
            return cb(err)
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
      // v4 cast to string
      return '' + ttl
    }

    _getAllKeys(cb = noop) {
      let pattern = this.prefix + '*'
      this._scanKeys({}, 0, pattern, this.scanCount, cb)
    }

    _scanKeys(keys = {}, cursor, pattern, count, cb = noop) {
      let args = [cursor, 'match', pattern, 'count', count]
      this.client
        .SCAN(args)
        .then((data) => {
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
        .catch((err) => {
          return cb(err)
        })
    }
  }

  return RedisStore
}

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item)
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
function mergeDeep(target, ...sources) {
  if (!sources.length) return target
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} })
        mergeDeep(target[key], source[key])
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return mergeDeep(target, ...sources)
}
