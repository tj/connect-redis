var P = require('bluebird');
var spawn = require('child_process').spawn;
var redisSrv;
var port = exports.port = 8543;

exports.connect = function () {
  if (redisSrv) return P.resolve();

  return new P(function (res) {
    redisSrv = spawn('redis-server', ['--port', port, '--loglevel', 'verbose']);
    redisSrv.stdout.once('readable', res);
  });
};

exports.disconnect = function () {
  if (!redisSrv) return P.resolve();

  return new P(function (res) {
    redisSrv.kill();
    redisSrv.on('close', res);
  });
};
