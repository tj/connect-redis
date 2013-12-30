/*!
 * Connect - Redis
 * Copyright(c) 2012 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var debug = require('debug')('connect:redis')
  , crypto = require('crypto');

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

  crypto.DEFAULT_ENCODING = 'hex';

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

    this.client = options.client || new require('redis').createClient(options.port || options.socket, options.host, options);
    if (options.pass) {
      this.client.auth(options.pass, function(err){
        if (err) throw err;
      });    
    }

    this.ttl =  options.ttl;

    this.secret = options.secret || false;
    this.algorithm = options.algorithm || false;

    if (options.db) {
      self.client.select(options.db);
      self.client.on("connect", function() {
        self.client.send_anyways = true;
        self.client.select(options.db);
        self.client.send_anyways = false;
      });
    }

    self.client.on('error', function () { self.emit('disconnect'); });
    self.client.on('connect', function () { self.emit('connect'); });
  };

  /**
   * Wrapper to create cipher text, digest & encoded payload
   *
   * @param {String} payload
   * @api private
   */

  function encryptData(plaintext){
    var pt = encrypt(this.secret, plaintext, this.algo)
      , hmac = digest(this.secret, pt)

    return {
      ct: pt,
      mac: hmac
    };
  }

  /**
   * Wrapper to extract digest, verify digest & decrypt cipher text
   *
   * @param {String} payload
   * @api private
   */

  function decryptData(ciphertext){
    ciphertext = JSON.parse(ciphertext)
    var hmac = digest(this.secret, ciphertext.ct);

    if (hmac != ciphertext.mac) {
      throw 'Encrypted session was tampered with!';
    }

    return decrypt(this.secret, ciphertext.ct, this.algo);
  }

    /**
   * Generates HMAC as digest of cipher text
   *
   * @param {String} key
   * @param {String} obj
   * @param {String} algo
   * @api private
   */

  function digest(key, obj) {
    var hmac = crypto.createHmac('sha1', key);
    hmac.setEncoding('hex');
    hmac.write(obj);
    hmac.end();
    return hmac.read();
  }

  /**
   * Creates cipher text from plain text
   *
   * @param {String} key
   * @param {String} pt
   * @param {String} algo
   * @api private
   */

  function encrypt(key, pt, algo) {
    algo = algo || 'aes-256-ctr';
    pt = (Buffer.isBuffer(pt)) ? pt : new Buffer(pt);

    var cipher = crypto.createCipher(algo, key)
      , ct = [];

    ct.push(cipher.update(pt));
    ct.push(cipher.final('hex'));

    return ct.join('');
  }

  /**
   * Creates plain text from cipher text
   *
   * @param {String} key
   * @param {String} pt
   * @param {String} algo
   * @api private
   */

  function decrypt(key, ct, algo) {
    algo = algo || 'aes-256-ctr';
    var cipher = crypto.createDecipher(algo, key)
      , pt = [];

    pt.push(cipher.update(ct, 'hex', 'utf8'));
    pt.push(cipher.final('utf8'));

    return pt.join('');
  }

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
    secret = this.secret || false;
    this.client.get(sid, function(err, data){
      if (err) return fn(err);
      if (!data) return fn();
      data = (secret) ? decryptData.call(this, data) : data.toString();
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

      sess = JSON.stringify((this.secret) ? encryptData.call(this, JSON.stringify(sess), this.secret, this.algorithm) : sess);

      ttl = ttl || ('number' == typeof maxAge
          ? maxAge / 1000 | 0
          : oneDay);

      debug('SETEX "%s" ttl:%s %s', sid, ttl, sess);
      this.client.setex(sid, ttl, sess, function(err){
        err || debug('SETEX complete');
        fn && fn.apply(this, arguments);
      });
    } catch (err) {
      fn && fn(err);
    } 
  };

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
