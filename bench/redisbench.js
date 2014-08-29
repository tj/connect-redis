var Promise = require('bluebird');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);

var count = 100000;
var i = 0;
var tasks = [];

console.time('bench '+count)

var store = Promise.promisifyAll(new RedisStore({
  host: 'localhost',
  port: 6379,
}));

for (; i < count; i++) {
  tasks.push(store.setAsync('testsession'+i, {cookie: {maxAge:2000}, name: 'sample name'}));
}

Promise.all(tasks).then(function() {
  console.timeEnd('bench '+count);
  process.exit(0);
})
