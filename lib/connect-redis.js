
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

module.exports = function RedisStore(options) {

    var client = null,
        redisStore = Store.prototype;

    options = options || {};
    Store.call(redisStore, options);
    client = new redis.createClient(options.port, options.host, options);

    /**
     * Attempt to fetch session by the given `hash`.
     *
     * @param {String} hash
     * @param {Function} fn
     * @api public
     */

    redisStore.get = function(hash, fn){
        client.get(hash, function(err, data){
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

    redisStore.set = function(hash, sess, fn){
        var self = this;
        try {
            client.set(hash, JSON.stringify(sess), function(){
                client.expire(hash, self.maxAge / 1000);
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
     * @return {Object} client
     * @api public
     */

    redisStore.destroy = function(hash, fn){
        client.del(hash, fn);
    };

    /**
     * Fetch number of sessions.
     *
     * @param {Function} fn
     * @api public
     */

    redisStore.length = function(fn){
        client.dbsize(fn);
    };

    /**
     * Clear all sessions.
     *
     * @param {Function} fn
     * @api public
     */

    redisStore.clear = function(fn){
        client.flushdb(fn);
    };

    /**
     * Get the client
     *
     * @param
     * @api public
     */
    redisStore.getClient = function(fn){
        return client;
    };

    return redisStore;
};
