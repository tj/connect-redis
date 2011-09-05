/*!
 * Connect - Redis
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * One day in seconds.
 */

var oneDay = 86400;

/**
 * Return the `RedisStore` extending `connect`'s session Store.
 *
 * @param {object} connect
 * @return {Function}
 * @api public
 */

module.exports = function(connect){

  /**
   * Connect's Store.
   */

  var Store = connect.session.Store;

  /**
   * Initialize RedisStore with the given `options`.
   *
   * @param {Object} options
   * @api public
   */

  function RedisStore(client, options) {
    if (!client) throw new Error('RedisStore() client required');
    this.client = client;

    options = options || {};
    Store.call(this, options);
    options.prefix = options.prefix || 'session:';
    this.key = function(key){ return options.prefix + key; };
  };

  /**
   * Inherit from `Store`.
   */

  RedisStore.prototype.__proto__ = Store.prototype;

  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */

  RedisStore.prototype.get = function(sid, fn){
    this.client.get(this.key(sid), function(err, data){
      if (err) {
        fn.apply(this, arguments);
      } else {
        try {
          data = JSON.parse(data.toString());
        } catch (err) {
          return fn(err);
        }
        fn(null, data);
      }
    });
  };

  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */

  RedisStore.prototype.set = function(sid, sess, fn){
    var maxAge = sess.cookie.maxAge
      , ttl = 'number' == typeof maxAge
        ? maxAge / 1000 | 0
        : oneDay
      , sess 
      , self = this;
    try {
      sess = JSON.stringify(sess);
    } catch (err) {
      return fn && fn(err);
    }
    this.client.setex(this.key(sid), ttl, sess, function(err){
      self.emit('set', sid, ttl);
      fn && fn.apply(this, arguments);
    });
  };

  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @api public
   */

  RedisStore.prototype.destroy = function(sid, fn){
    var self = this;
    this.client.del(this.key(sid), function (err, reply) {
      self.emit('destroy', sid);
      fn && fn.apply(this, arguments);
    });
  };

  return RedisStore;
};
