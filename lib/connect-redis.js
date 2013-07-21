/*!
 * Connect - Redis
 * Copyright(c) 2012 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var redis = require('redis')
  , debug = require('debug')('connect:redis');

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

  function RedisStore(options) {
    var self = this;

    options = options || {};
    Store.call(this, options);
    this.prefix = null == options.prefix
      ? 'sess:'
      : options.prefix;

    this.client = options.client || new redis.createClient(options.port || options.socket, options.host, options);
    if (options.pass) {
      this.client.auth(options.pass, function(err){
        if (err) throw err;
      });    
    }

    this.ttl =  options.ttl;

    if (options.db) {
      self.client.select(options.db);
      self.client.on("connect", function() {
        self.client.send_anyways = true;
        self.client.select(options.db);
        self.client.send_anyways = false;
      });
    }
    
    this.options = options;

    self.client.on('error', function () { self.emit('disconnect'); });
    self.client.on('connect', function () { self.emit('connect'); });
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
    sid = this.prefix + sid;
    debug('GET "%s"', sid);
    this.client.get(sid, function(err, data){
      if (err) return fn(err);
      if (!data) return fn();
      var result;
      data = data.toString();
      debug('GOT %s', data);
      try {
        result = JSON.parse(data); 
      } catch (err) {
        return fn(err);
      }
      return fn(null, result);
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
    sid = this.prefix + sid;
    try {
      var maxAge = sess.cookie.maxAge
        , ttl = this.ttl
        , sess = JSON.stringify(sess)
        , self = this;

      ttl = ttl || ('number' == typeof maxAge
          ? maxAge / 1000 | 0
          : oneDay);
      
      if (sess && this.options.merge)
      {
        this.client.get(sid, function(err, data){
          if (err) return fn(err);
          var result, oSess;
          if(data)
          {
            data = data.toString();
            try {
              result = JSON.parse(data); 
              oSess = JSON.parse(sess);
            } catch (err) {
              return fn(err);
            }
            debug(result);
            debug("should merge:");
            debug(oSess);
            sess = JSON.stringify(self.merge(result, oSess));
          }
          debug('SETEX "%s" ttl:%s %s', sid, ttl, sess);
          self.client.setex(sid, ttl, sess, function(err){
            err || debug('SETEX complete');
            fn && fn.apply(this, arguments);
          });  
        });
      }
      else {
        debug('SETEX "%s" ttl:%s %s', sid, ttl, sess);
        client.setex(sid, ttl, sess, function(err){
          err || debug('SETEX complete');
          fn && fn.apply(this, arguments);
        });
      }
    } catch (err) {
      fn && fn(err);
    } 
  };

  RedisStore.prototype.merge = function(obj1, obj2){
    for (var p in obj2) 
    {
      try {
        // Property in destination object set; update its value.
        if (obj2[p] != null && typeof obj2[p] === 'object') 
        {
          obj1[p] = mergeRecursive(obj1[p], obj2[p]);
        } 
        else {
          obj1[p] = obj2[p];
        }
      } catch(e) {
        // Property in destination object not set; create it and set its value.
        obj1[p] = obj2[p];
      }
    }
  
    return obj1;
  }


  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @api public
   */

  RedisStore.prototype.destroy = function(sid, fn){
    sid = this.prefix + sid;
    this.client.del(sid, fn);
  };

  return RedisStore;
};
