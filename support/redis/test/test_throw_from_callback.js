#!/usr/bin/env node

// Test that an exception thrown in a callback function is handled by the
// client.  The client can listen for "error" on the stream to redis, which
// seems to be emitted when there's an exception thrown from within a 'data'
// callback.

var sys = require('sys'),
    redis = require('../lib/redis-client');

redis.debugMode = true;
    
var client = redis.createClient();

client.addListener('connected', function () {
  sys.puts('connected');
});

var PASS = 0, FAIL = 1;

var exit_status = function(status){
    sys.puts(status === PASS ? 'PASS' : 'FAIL');
    process.exit(status);
};

setTimeout(function(){
    sys.puts("not called back after exception");
    exit_status(FAIL);
}, 5000);       // leave some time for reconnection attempts

process.addListener('uncaughtException', function(e){
    sys.puts("uncaught exception: " + e);

    client.get('1234', function(err, value) {
	sys.puts("called back after exception; err=" + err + ", value=" + value);
	exit_status(PASS);
    });
});

client.setnx('1234', 'abcd', function(e, resp){
    client.get('1234', function(e, resp){
	// Throw from within a callback.

        throw new Error('blah');
    })
});


