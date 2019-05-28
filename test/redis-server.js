var P = require('bluebird');
var spawn = require('child_process').spawn;
var redisSrv;
var port = exports.port = 18543;

exports.connect = function () {
  redisSrv = spawn('redis-server', [
    '--port', port,
    '--loglevel', 'notice',
  ], { stdio: 'inherit' });

  redisSrv.on('error', function (error) {
    console.log('Error caught spawning the server: ', error);
  });

  return P.delay(1500);
};

exports.disconnect = function () {
  redisSrv.kill('SIGKILL');
  return P.resolve();
};
