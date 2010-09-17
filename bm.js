
var redis = require('./lib/redis')
  , times = 100000;

var n = times
  , pending = n
  , client = redis.createClient()
  , start = new Date;

while (n--) {
  client.set('foo:' + n, 'bar', function(){
    --pending || report();
  });
}

function report() {
  console.log('\x1b[33m%d\x1b[0m sets in \x1b[32m%d\x1b[0m milliseconds', times, new Date - start);
}