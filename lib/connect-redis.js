
/*!
 * Connect - Redis
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Store = require('connect').session.Store
  , redis = require('redis');

/**
 * One day in seconds.
 */

var oneDay = 86400;

/**
 * Initialize RedisStore with the given `options`.
 *
 * @param {Object} options
 * @api public
 */

var RedisStore = module.exports = function RedisStore(options) {
  options = options || {};
  Store.call(this, options);
  this.client = new redis.createClient(options.port, options.host, options);
  if (options.db) {
    var self = this;
    self.client.on('connect', function() {
      self.client.select(options.db);
    });
  }
};

/**
 * Inherit from `Store`.
 */

RedisStore.prototype.__proto__ = Store.prototype;

/**
 * Attempt to fetch session by the given `hash`.
 *
 * @param {String} hash
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.get = function(hash, fn){
  this.client.get(hash, function(err, data){
    try {
      if (!data) return fn();
      fn(null, JSON.parse(data.toString()));
    } catch (err) {
      fn(err);
    } 
  });
};

/**
 * Commit the given `sess` object associated with the given `hash`.
 *
 * @param {String} hash
 * @param {Session} sess
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.set = function(hash, sess, fn){
  try {
    var maxAge = sess.cookie.maxAge
      , ttl = 'number' == typeof maxAge
        ? maxAge / 1000 | 0
        : oneDay
      , sess = JSON.stringify(sess);
    this.client.setex(hash, ttl, sess, function(){
      fn && fn.apply(this, arguments);
    });
  } catch (err) {
    fn && fn(err);
  } 
};

/**
 * Destroy the session associated with the given `hash`.
 *
 * @param {String} hash
 * @api public
 */

RedisStore.prototype.destroy = function(hash, fn){
  this.client.del(hash, fn);
};

/**
 * Fetch number of sessions.
 *
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.length = function(fn){
  this.client.dbsize(fn);
};

/**
 * Clear all sessions.
 *
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.clear = function(fn){
  this.client.flushdb(fn);
};
