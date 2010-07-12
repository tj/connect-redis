var sys = require("sys");
var client = require("../lib/redis-client").createClient();
client.info(function (err, info) {
    if (err) throw new Error(err);
    sys.puts("Redis Version is: " + info.redis_version);
    client.close();
});
