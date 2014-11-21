var P = require('bluebird');
var session = require('express-session');
var RedisStore = require('../')(session);

var count = 100000;
var i = 0;
var tasks = [];

console.time('bench ' + count);

var store = P.promisifyAll(new RedisStore({
  host: 'localhost',
  port: 6379
}));

for (; i < count; i++) {
  tasks.push(store.setAsync('testsession' + i, { cookie: { maxAge: 2000 }, name: 'sample name' }));
}

P.all(tasks).then(function () {
  console.timeEnd('bench ' + count);
  process.exit(0);
});
