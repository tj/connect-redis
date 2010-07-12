// Kiwi is a package manager for Node.js
// http://wiki.github.com/visionmedia/kiwi/getting-started
//
// $ kiwi install redis-client

var sys = require("sys"), 
    kiwi = require("kiwi"),
    client = kiwi.require("redis-client").createClient();

client.stream.addListener("connect", function () {
    client.info(function (err, info) {
        if (err) throw new Error(err);
        sys.puts("Redis Version is: " + info.redis_version);
        client.close();
    });
});
