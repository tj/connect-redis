#!/usr/bin/env node

// This is a test of robustly handling reconnection to Redis when Redis is
// brought down temporarily and then restarted.  The client will queue commands
// and retry to connect with exponential backoff.

// Load up a test Redis instance.  Then in another terminal run
// test/test_shutdown_reconnect.js. This will issue 50000 INCR commands to
// a random key. Let it run all the way through the first time and make sure
// the output says "final value = 50000". Now, run it again, and this time,
// kill Redis quickly after starting test_shutdown_reconnect.js.  You should
// see the client tell you it is queueing commands.  Then, restart Redis.
// Watch as the client reconnects and submits the queued commands.  Don't wait
// too long; the delay grows exponentially after each failed reconnection
// attempt.  You will likely see that some commands are "orphaned" (submitted
// to Redis but Redis goes down before a reply will ever be sent).

// Any command submitted to the client by an app while not connected to Redis
// is *queued*.  When the connection is established, the commands are sent.

// Any command submitted to the client by an app while connected to Redis is
// sent to Redis.  If the connection to Redis goes down before a reply to such
// commands are received, the command is orphaned.  The client will callback
// the associated callback function with an error indicating that the command
// was orphaned and will provide the callback with enough information to
// resubmit the command if so desired.

// If we may submit requests to Redis, and then kill Redis, replies for
// submitted commands will never come.  Fine, replay the commands that didn't
// get a reply, right?  No. Redis might have started processing some of the
// commands...  See http://gist.github.com/372038 for example.  OK, so what
// does the client do?  
//
// The client calls the callback of each originally submitted command's
// callback with an `err` arg equal to `COMMAND_ORPHANED_ERROR` and
// a `.originalCommand` equal to `[ commandName, arg0, arg1, ..., argN, callback ]`
// so that the *application* can figure out how it wants to proceed (retry?).

// Any redis command that *requires* that a previous command be executed before
// itself is executed *must* use the MULTI/EXEC macro facility.  But, ...
//
//  [TODO] MULTI/EXEC is unsupported in the client at the moment. What if a MULTI
//         is orphaned but the EXEC is queued?  Eek.

var 
  sys = require('sys'),
  redis = require('../lib/redis-client');

// sys.debug() is synchronous; you can probably kill Redis will waiting for the
// output to scroll by.

redis.debugMode = false;        

client = redis.createClient();

var 
  remainingCallbacks = 0, 
  orphanedCommands = 0;

// We do not have to, but let the client stream establish 
// a connection to Redis before sending commands.

var randomKey = (Math.random() * Math.random()).toString();

var i = 0;

function submitCommands() {
  if (50000 - i > 0)
    sys.debug("submitting " + (50000-i) + " commands.");

  for (; i<50000; ++i) {
    client.incr(randomKey, function (err, newValue) {
      if (err && err.message == redis.COMMAND_ORPHANED_ERROR) 
        ++orphanedCommands;
      --remainingCallbacks;
    });
    ++remainingCallbacks;
  }
}

submitCommands();

client.addListener("noconnection", function () {
  sys.puts("no connection to redis!");
});

client.addListener("reconnected", function () {
  sys.puts("reconnected to redis!");
  submitCommands();
});

setInterval(function () {
  // If there was no initial connection or the client gave up retrying, quit.

  if (client.noConnection) 
    process.exit(1);

  sys.puts("waiting for " + remainingCallbacks + " callbacks.");

  if (remainingCallbacks == 0) {
    sys.puts(orphanedCommands + " commands were orphaned.");

    client.get(randomKey, function (err, value) {
      if (err) throw err;

      sys.puts("final value = " + value);

      if (orphanedCommands > 0 && 50000 - value != orphanedCommands) {
        sys.puts("See, some of the orphaned commands *WERE* processed by Redis!");
        sys.puts("    " + value + " + " + orphanedCommands + " != 50000\n");
        sys.puts("The orphaned callbacks would be called back, and the app would ");
        sys.puts("fetch the final value (" + value + "), and act appropriately to recover.");
      }

      // Clean up

      client.del(randomKey, function () { 
        process.exit(0);
      });
    });
  }
}, 1000);

