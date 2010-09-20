
/*!
 * Connect - Redis
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Store = require('connect').session.Store,
    redis = require('./redis');

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
            fn(null, data
                ? JSON.parse(data.toString())
                : data);
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
    var self = this;
    try {
        this.client.set(hash, JSON.stringify(sess), function(){
            self.client.expire(hash, self.maxAge / 1000);
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