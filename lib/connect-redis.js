/*!
 * Connect - Redis
 * Copyright(c) 2012 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var debug = require('debug')('connect:redis');
var redis = require('redis');
var _     = require('lodash');

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
    this.options = options;
    Store.call(this, options);
    this.prefix = null == options.prefix
      ? 'sess:'
      : options.prefix;

    if (options.url) {
      var url = require('url').parse(options.url);
      if (url.protocol === 'redis:') {
        if (url.auth) {
          var userparts = url.auth.split(":");
          options.user = userparts[0];
          if (userparts.length === 2) {
            options.pass = userparts[1];
          }
        }
        options.host = url.hostname;
        options.port = url.port;
        if (url.pathname) {
          options.db   = url.pathname.replace("/", "", 1);
        }
      }
    }

    this.master = options.client || new redis.createClient(options.port || options.socket, options.host, options);
    this.slaves = {};

    if (options.pass) {
      this.master.auth(options.pass, function(err){
        if (err) throw err;
      });
    }

    this.ttl =  options.ttl;

    if (options.db) {
      self.master.select(options.db);
      self.master.on("connect", function() {
        self.master.send_anyways = true;
        self.master.select(options.db);
        self.master.send_anyways = false;

        getSlaves.call(self);
      });
    }

    self.master.on('error', function () { self.emit('disconnect'); });
    self.master.on('connect', function () { self.emit('connect'); });
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
    var avail = _.filter(this.slaves, function (slave, name) {
      return slave.ready;
    });

    var server = this.master;
    if (avail.length) {
      server = avail[_.random(0, avail.length - 1)] || this.master;
    }
    server.get(sid, function(err, data){
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
        , sess = JSON.stringify(sess);

      ttl = ttl || ('number' == typeof maxAge
          ? maxAge / 1000 | 0
          : oneDay);

      debug('SETEX "%s" ttl:%s %s', sid, ttl, sess);
      this.master.setex(sid, ttl, sess, function(err){
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
    this.master.del(sid, fn);
  };

  return RedisStore;
};

function getSlaves () {
  var self = this;

  function setupSlave(slave) {
    var id = slave.host + ':' + slave.port;

    var client = new redis.createClient(slave.port, slave.host, self.options.options);
    client.id = id;
    client.on('error', function (error) {
      client.ready = false;

      clearInterval(client.interval);
    });
    client.on('connect', function () {
      updateSlaveStatus(client);

      client.interval = setInterval(updateSlaveStatus, 1000, client);
    });

    this.slaves[id] = client;
  }

  self.master.send_command('ROLE', [], function (err, role) {
    role = getRole(role);

    if (role.role === 'master') {
      role.slaves.forEach(setupSlave);
    }
  });
}

function getRole (response) {
  var role = {};
  switch (response[0]) {

    case 'master':
      role.role = 'master';
      role.offset = response[1];

      role.slaves = _.map(response[2],
        function (slave) {
          return {
            host: slave[0],
            port: slave[1],
            offset: slave[2]
          };
        });

    return role;

    case 'slave':
      role.role = 'slave';
      role.master = {host: response[1], port: response[2]};
      role.status = response[3];
      role.offset = response[4];
      role.ready  = (role.status === 'connected');
    return role;

    case 'setinel':
      role.role = 'sentinel';
      role.masters = response[1];
    return role;

    default:
    return null;
  }
}

function updateSlaveStatus(slave) {
  slave.send_command('ROLE', [], function (err, role) {
    if (err || !role) {
      slave.ready = false;
      return;
    }
    role = getRole(role);
    slave.ready = role.ready;
  });
}
