/*

© 2010 by Fictorial LLC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/

// To add support for new commands, edit the array called "commands" at the
// bottom of this file.

// Set this to true to aid in debugging wire protocol input/output,
// parsing methods, etc.

exports.debugMode = false;

var net = require("net"),
    sys = require("sys"),
    Buffer = require('buffer').Buffer,
    events = require('events'),

    CRLF = "\r\n",
    CRLF_LEN = 2,

    PLUS      = exports.PLUS      = 0x2B, // +
    MINUS     = exports.MINUS     = 0x2D, // -
    DOLLAR    = exports.DOLLAR    = 0x24, // $
    STAR      = exports.STAR      = 0x2A, // *
    COLON     = exports.COLON     = 0x3A, // :
    CR        = exports.CR        = 0x0D, // \r
    LF        = exports.LF        = 0x0A, // \n
                                
    NONE      = exports.NONE      = "NONE",
    BULK      = exports.BULK      = "BULK",     
    MULTIBULK = exports.MULTIBULK = "MULTIBULK",
    INLINE    = exports.INLINE    = "INLINE",   
    INTEGER   = exports.INTEGER   = "INTEGER",  
    ERROR     = exports.ERROR     = "ERROR";    

exports.DEFAULT_HOST = '127.0.0.1';
exports.DEFAULT_PORT = 6379;

exports.COMMAND_ORPHANED_ERROR = "connection lost before reply received";
exports.NO_CONNECTION_ERROR = "failed to establish a connection to Redis";

function debugFilter(buffer, len) {
    // Redis is binary-safe but assume for debug display that 
    // the encoding of textual data is UTF-8.

    var filtered = buffer.utf8Slice(0, len || buffer.length);

    filtered = filtered.replace(/\r\n/g, '<CRLF>');
    filtered = filtered.replace(/\r/g, '<CR>');
    filtered = filtered.replace(/\n/g, '<LF>');

    return filtered;
}

// A fully interruptable, binary-safe Redis reply parser.
// 'callback' is called with each reply parsed in 'feed'.
// 'thisArg' is the "thisArg" for the callback "call".

function ReplyParser(callback, thisArg) {
    this.onReply = callback;
    this.thisArg = thisArg;
    this.clearState();
    this.clearMultiBulkState();
}

exports.ReplyParser = ReplyParser;

ReplyParser.prototype.clearState = function () {
    this.type = NONE;
    this.bulkLengthExpected = null;
    this.valueBufferLen = 0;
    this.skip = 0;
    this.valueBuffer = new Buffer(4096);
};

ReplyParser.prototype.clearMultiBulkState = function () {
    this.multibulkReplies = null; 
    this.multibulkRepliesExpected = null;
};

ReplyParser.prototype.feed = function (inbound) {
    for (var i=0; i < inbound.length; ++i) {
        if (this.skip > 0) {
            this.skip--;
            continue;
        }

        var typeBefore = this.type;

        if (this.type === NONE) {
            switch (inbound[i]) {
                case DOLLAR: this.type = BULK;      break;
                case STAR:   this.type = MULTIBULK; break;
                case COLON:  this.type = INTEGER;   break;
                case PLUS:   this.type = INLINE;    break;
                case MINUS:  this.type = ERROR;     break;
            }
        }

        // Just a state transition on '*', '+', etc.?  

        if (typeBefore != this.type)
            continue;

        // If the reply is a part of a multi-bulk reply.  Save it.  If we have
        // received all the expected replies of a multi-bulk reply, then
        // callback.  If the reply is not part of a multi-bulk. Call back
        // immediately.

        var self = this;

        var maybeCallbackWithReply = function (reply) {
            if (self.multibulkReplies != null) {
                self.multibulkReplies.push(reply);
                if (--self.multibulkRepliesExpected == 0) {
                    self.onReply.call(self.thisArg, { 
                        type:  MULTIBULK, 
                        value: self.multibulkReplies 
                    });
                    self.clearMultiBulkState();
                }
            } else {
                self.onReply.call(self.thisArg, reply);
            }
            self.clearState();
            self.skip = 1; // Skip LF
        };

        switch (inbound[i]) {
        case CR:
            switch (this.type) {
                case INLINE:
                case ERROR:
                    // CR denotes end of the inline/error value.  
                    // +OK\r\n
                    //    ^

                    var inlineBuf = new Buffer(this.valueBufferLen);
                    this.valueBuffer.copy(inlineBuf, 0, 0, this.valueBufferLen);
                    maybeCallbackWithReply({ type:this.type, value:inlineBuf });
                    break;

                case INTEGER:
                    // CR denotes the end of the integer value.  
                    // :42\r\n
                    //    ^

                    var n = parseInt(this.valueBuffer.asciiSlice(0, this.valueBufferLen), 10);
                    maybeCallbackWithReply({ type:INTEGER, value:n });
                    break;

                case BULK:
                    if (this.bulkLengthExpected == null) {
                        // CR denotes end of first line of a bulk reply,
                        // which is the length of the bulk reply value.
                        // $5\r\nhello\r\n
                        //   ^

                        var bulkLengthExpected = 
                            parseInt(this.valueBuffer.asciiSlice(0, this.valueBufferLen), 10);

                        if (bulkLengthExpected <= 0) {
                            maybeCallbackWithReply({ type:BULK, value:null });
                        } else {
                            this.clearState();

                            this.bulkLengthExpected = bulkLengthExpected;
                            this.type = BULK;
                            this.skip = 1;  // skip LF
                        }
                    } else if (this.valueBufferLen == this.bulkLengthExpected) {
                        // CR denotes end of the bulk reply value.
                        // $5\r\nhello\r\n
                        //            ^

                        var bulkBuf = new Buffer(this.valueBufferLen);
                        this.valueBuffer.copy(bulkBuf, 0, 0, this.valueBufferLen);
                        maybeCallbackWithReply({ type:BULK, value:bulkBuf });
                    } else {
                        // CR is just an embedded CR and has nothing to do
                        // with the reply specification.
                        // $11\r\nhello\rworld\r\n
                        //             ^
                        
                        this.valueBuffer[this.valueBufferLen++] = inbound[i];
                    }
                    break;

                case MULTIBULK:
                    // Parse the count which is the number of expected replies
                    // in the multi-bulk reply.
                    // *2\r\n$5\r\nhello\r\n$5\r\nworld\r\n
                    //   ^

                    var multibulkRepliesExpected = 
                        parseInt(this.valueBuffer.asciiSlice(0, this.valueBufferLen), 10);

                    if (multibulkRepliesExpected <= 0) {
                        maybeCallbackWithReply({ type:MULTIBULK, value:null });
                    } else {
                        this.clearState();
                        this.skip = 1;    // skip LF
                        this.multibulkReplies = [];
                        this.multibulkRepliesExpected = multibulkRepliesExpected;
                    }
                    break;
            }
            break;

        default:
            this.valueBuffer[this.valueBufferLen++] = inbound[i];
            break;
        }

        // If the current value buffer is too big, create a new buffer, copy in
        // the old buffer, and replace the old buffer with the new buffer.
 
        if (this.valueBufferLen === this.valueBuffer.length) {
            var newBuffer = new Buffer(this.valueBuffer.length * 2);
            this.valueBuffer.copy(newBuffer, 0, 0);
            this.valueBuffer = newBuffer;
        }
    }
};

/**
 * Emits:
 *
 * - 'connected' when connected (or on a reconnection, reconnected).
 * - 'reconnecting' when about to retry to connect to Redis.
 * - 'reconnected' when connected after a reconnection was established.
 * - 'noconnection' when a connection (or reconnection) cannot be established.
 * - 'drained' when no submitted commands are expecting a reply from Redis.
 *
 * Options: 
 *
 * - maxReconnectionAttempts (default: 10)
 */

function Client(stream, options) {
    events.EventEmitter.call(this);

    this.stream = stream;
    this.originalCommands = [];
    this.queuedOriginalCommands = [];
    this.queuedRequestBuffers = [];
    this.channelCallbacks = {};
    this.requestBuffer = new Buffer(512);
    this.replyParser = new ReplyParser(this.onReply_, this);
    this.reconnectionTimer = null;
    this.maxReconnectionAttempts = 10;
    this.reconnectionAttempts = 0;
    this.reconnectionDelay = 500;    // doubles, so starts at 1s delay
    this.connectionsMade = 0;

    if (options !== undefined) 
        this.maxReconnectionAttempts = Math.abs(options.maxReconnectionAttempts || 10);

    var client = this;

    stream.addListener("connect", function () {
        if (exports.debugMode)
            sys.debug("[CONNECT]");

        stream.setNoDelay();
        stream.setTimeout(0);

        client.reconnectionAttempts = 0;
        client.reconnectionDelay = 500;
        if (client.reconnectionTimer) {
            clearTimeout(client.reconnectionTimer);
            client.reconnectionTimer = null;
        }

        var eventName = client.connectionsMade == 0 
                      ? 'connected' 
                      : 'reconnected';

        client.connectionsMade++;
        client.expectingClose = false;

        // If this a reconnection and there were commands submitted, then they
        // are gone!  We cannot say with any confidence which were processed by
        // Redis; perhaps some were processed but we never got the reply, or
        // perhaps all were processed but Redis is configured with less than
        // 100% durable writes, etc.  
        //
        // We punt to the user by calling their callback with an I/O error.
        // However, we provide enough information to allow the user to retry
        // the interrupted operation.  We are certainly not retrying anything
        // for them as it is too dangerous and application-specific.

        if (client.connectionsMade > 1 && client.originalCommands.length > 0) {
            if (exports.debug) {
                sys.debug("[RECONNECTION] some commands orphaned (" + 
                    client.originalCommands.length + "). notifying...");
            }

            client.callbackOrphanedCommandsWithError();
        }
        
        client.originalCommands = [];
        client.flushQueuedCommands();

        client.emit(eventName, client);
    });

    stream.addListener('error', function (e) {
        if (exports.debugMode)
            sys.debug("[ERROR] Connection to redis encountered an error: " + e);
    });

    stream.addListener("data", function (buffer) {
        if (exports.debugMode)
            sys.debug("[RECV] " + debugFilter(buffer));

        client.replyParser.feed(buffer);
    });

    stream.addListener("error", function (e) {
	if (exports.debugMode)
	  sys.debug('[ERROR] ' + e);
	client.replyParser.clearState();
	client.maybeReconnect();
	throw e;
    });

    stream.addListener("end", function () {
        if (exports.debugMode && client.originalCommands.length > 0) {
            sys.debug("Connection to redis closed with " + 
                      client.originalCommands.length + 
                      " commands pending replies that will never arrive!");
        }

        stream.end();
    });

    stream.addListener("close", function (hadError) {
        if (exports.debugMode)
            sys.debug("[NO CONNECTION]");

        client.maybeReconnect();
    });
}

sys.inherits(Client, events.EventEmitter);

exports.Client = Client;

exports.createClient = function (port, host, options) {
    var port = port || exports.DEFAULT_PORT;
    var host = host || exports.DEFAULT_HOST;

    var client = new Client(net.createConnection(port, host), options);

    client.port = port;
    client.host = host;

    return client;
};

Client.prototype.close = function () {
    this.expectingClose = true;
    this.stream.end();
};

Client.prototype.onReply_ = function (reply) {
    this.flushQueuedCommands();

    if (this.handlePublishedMessage_(reply)) 
        return;

    var originalCommand = this.originalCommands.shift();
    var callback = originalCommand[originalCommand.length - 1];

    // Callbacks expect (err, reply) as args.

    if (typeof callback == "function") {
        if (reply.type == ERROR) {
            callback(reply.value.utf8Slice(0, reply.value.length), null);
        } else {
            callback(null, maybeConvertReplyValue(originalCommand[0], reply));
        }
    }

    if (this.originalCommands.length == 0)
      this.emit('drained', this);
};

Client.prototype.handlePublishedMessage_ = function (reply) {
    // We're looking for a multibulk resembling 
    // ["message", "channelName", messageBuffer]; or
    // ["pmessage", "matchingPattern", "channelName", messageBuffer]
    // The latter is sent when the client subscribed to a channel by a pattern;
    // the former when subscribed to a channel by name.
    // If the client subscribes by name -and- by pattern and there's some
    // overlap, the client -will- receive multiple p/message notifications.

    if (reply.type != MULTIBULK || !(reply.value instanceof Array))
        return false;

    var isMessage = (reply.value.length == 3 &&
                     reply.value[0].value.length == 7 &&
                     reply.value[0].value.asciiSlice(0, 7) == 'message');

    var isPMessage = (reply.value.length == 4 &&
                      reply.value[0].value.length == 8 &&
                      reply.value[0].value.asciiSlice(0, 8) == 'pmessage');

    if (!isMessage && !isPMessage)
        return false;

    // This is tricky. We are returning true even though there 
    // might not be any callback called! This may happen when a
    // caller subscribes then unsubscribes while a published
    // message is in transit to us. When the message arrives, no
    // one is there to consume it. In essence, as long as the 
    // reply type is a published message (see above), then we've
    // "handled" the reply.
        
    if (Object.getOwnPropertyNames(this.channelCallbacks).length == 0) 
        return true;

    var channelName, channelPattern, channelCallback, payload;

    if (isMessage) {
        channelName = reply.value[1].value;
        channelCallback = this.channelCallbacks[channelName];
        payload = reply.value[2].value;
    } else if (isPMessage) {
        channelPattern = reply.value[1].value;
        channelName = reply.value[2].value;
        channelCallback = this.channelCallbacks[channelPattern];
        payload = reply.value[3].value;
    } else {
        return false;
    }

    if (typeof channelCallback == "function") {
        channelCallback(channelName, payload, channelPattern);
        return true;
    }

    return false;
}

function maybeAsNumber(str) {
    var value = parseInt(str, 10);

    if (isNaN(value)) 
        value = parseFloat(str);

    if (isNaN(value)) 
        return str;

    return value;
}

function maybeConvertReplyValue(commandName, reply) {
    if (reply.value === null)
        return null;

    // Redis' INFO command returns a BULK reply of the form:
    // "redis_version:1.3.8
    // arch_bits:64
    // multiplexing_api:kqueue
    // process_id:11604
    // ..."
    // 
    // We convert that to a JS object like:
    // { redis_version: '1.3.8'
    // , arch_bits: '64'
    // , multiplexing_api: 'kqueue'
    // , process_id: '11604'
    // , ... }

    if (commandName === 'info' && reply.type === BULK) {
        var info = {};
        reply.value.asciiSlice(0, reply.value.length).split(/\r\n/g)
            .forEach(function (line) {
                var parts = line.split(':');
                if (parts.length === 2)
                    info[parts[0]] = parts[1];
            });
        return info;
    }

    // HGETALL returns a MULTIBULK where each consecutive reply-pair
    // is a key and value for the Redis HASH.  We convert this into
    // a JS object.

    if (commandName === 'hgetall' && 
        reply.type === MULTIBULK &&
        reply.value.length % 2 === 0) {

        var hash = {};
        for (var i=0; i<reply.value.length; i += 2) 
            hash[reply.value[i].value] = reply.value[i + 1].value;
        return hash;
    }

    // Redis returns "+OK\r\n" to signify success.
    // We convert this into a JS boolean with value true.
    
    if (reply.type === INLINE && reply.value.asciiSlice(0,2) === 'OK')
        return true;

    // ZSCORE returns a string representation of a floating point number.
    // We convert this into a JS number.

    if (commandName === "zscore")
        return maybeAsNumber(reply.value);

    // Multibulk replies are returned from our reply parser as an
    // array like: [ {type:BULK, value:"foo"}, {type:BULK, value:"bar"} ]
    // But, end-users want the value and don't care about the
    // Redis protocol reply types.  We here extract the value from each
    // object in the multi-bulk array.

    if (reply.type === MULTIBULK)
        return reply.value.map(function (element) { return element.value; });

    // Otherwise, we have no conversions to offer.

    return reply.value;
}

exports.maybeConvertReplyValue_ = maybeConvertReplyValue;

var commands = [ 
    "append",
    "auth",
    "bgsave",
    "blpop",
    "brpop",
    "dbsize",
    "decr",
    "decrby",
    "del",
    "exists",
    "expire",
    "expireat",
    "flushall",
    "flushdb",
    "get",
    "getset",
    "hdel",
    "hexists",
    "hget",
    "hgetall",
    "hincrby",
    "hkeys",
    "hlen",
    "hmget",
    "hmset",
    "hset",
    "hvals",
    "incr",
    "incrby",
    "info",
    "keys",
    "lastsave",
    "len",
    "lindex",
    "llen",
    "lpop",
    "lpush",
    "lrange",
    "lrem",
    "lset",
    "ltrim",
    "mget",
    "move",
    "mset",
    "msetnx",
    "psubscribe",
    "publish",
    "punsubscribe",
    "randomkey",
    "rename",
    "renamenx",
    "rpop",
    "rpoplpush",
    "rpush",
    "sadd",
    "save",
    "scard",
    "sdiff",
    "sdiffstore",
    "select",
    "set",
    "setex",
    "setnx",
    "shutdown",
    "sinter",
    "sinterstore",
    "sismember",
    "smembers",
    "smove",
    "sort",
    "spop",
    "srandmember",
    "srem",
    "subscribe",
    "sunion",
    "sunionstore",
    "ttl",
    "type",
    "unsubscribe",
    "zadd",
    "zcard",
    "zcount",
    "zincrby",
    "zinter",
    "zrange",
    "zrangebyscore",
    "zrank",
    "zrem",
    "zrembyrank",
    "zremrangebyrank",
    "zremrangebyscore",
    "zrevrange",
    "zrevrank",
    "zscore",
    "zunion",
];

// For internal use but maybe useful in rare cases or when the client command
// set is not 100% up to date with Redis' latest commands.
// client.sendCommand('GET', 'foo', function (err, value) {...});
//
// arguments[0]      = commandName
// arguments[1..N-2] = Redis command arguments
// arguments[N-1]    = callback function

Client.prototype.sendCommand = function () {
    var originalCommand = Array.prototype.slice.call(arguments);

    // If this client has given up trying to connect/reconnect to Redis,
    // just call the errback (if any). Regardless, don't enqueue the command.

    if (this.noConnection) {
        if (arguments.length > 0 && typeof arguments[arguments.length - 1] == 'function')
            arguments[arguments.length - 1](this.makeErrorForCommand(originalCommand, exports.NO_CONNECTION_ERROR));
        return;
    }

    this.flushQueuedCommands();

    var commandName = arguments[0].toLowerCase();

    // Invariant: number of queued callbacks == number of commands sent to
    // Redis whose replies have not yet been received and processed.  Thus,
    // if no callback was given, we create a dummy callback.

    var argCount = arguments.length;
    if (typeof arguments[argCount - 1] == 'function')
        --argCount;

    // All requests are formatted as multi-bulk.
    // The first line of a multi-bulk request is "*<number of parts to follow>\r\n".
    // Next is: "$<length of the command name>\r\n<command name>\r\n".

    // Write the request as we go into a request Buffer.  Recall that buffers
    // are fixed length.  We thus guess at how much space is needed.  If we
    // need to grow beyond this, we create a new buffer, copy the old one, and
    // continue.  Once we're ready to write the buffer, we use a 0-copy slice
    // to send just that which we've written to the buffer.
    //
    // We reuse the buffer after each request. When the buffer "grows" to
    // accomodate a request, it stays that size until it needs to grown again,
    // which may of course be never.

    var offset = this.requestBuffer.utf8Write('*' + argCount.toString() + CRLF +
                                              '$' + commandName.length + CRLF +
                                              commandName + CRLF, 0);

    var self = this;

    function ensureSpaceFor(atLeast) {
      var currentLength = self.requestBuffer.length;

      if (offset + atLeast > currentLength) {
        // If we know how much space we need, use that + 10%.
        // Else double the size of the buffer.

        var bufferLength = Math.max(currentLength * 2, atLeast * 1.1);
        var newBuffer = new Buffer(Math.round(bufferLength));
        self.requestBuffer.copy(newBuffer, 0, 0, offset); // target, targetStart, srcStart, srcEnd
        self.requestBuffer = newBuffer;
      }
    }

    // Serialize the arguments into the request buffer
    // If the request is a Buffer, just copy.  Else if
    // the arg has a .toString() method, call it and write
    // it to the request buffer as UTF8.

    var extrasLength = 5;   // '$', '\r\n', '\r\n'

    for (var i=1; i < argCount; ++i) {
        var arg = arguments[i];
        if (arg instanceof Buffer) {
            ensureSpaceFor(arg.length + arg.length.toString().length + extrasLength);
            offset += this.requestBuffer.asciiWrite('$' + arg.length + CRLF, offset);
            offset += arg.copy(this.requestBuffer, offset, 0);  // target, targetStart, srcStart
            offset += this.requestBuffer.asciiWrite(CRLF, offset);
        } else if (arg.toString) {
            var asString = arg.toString();
            var serialized = '$' + Buffer.byteLength(asString, "binary") + CRLF + asString + CRLF;
            ensureSpaceFor(Buffer.byteLength(serialized, "binary"));
            offset += this.requestBuffer.binaryWrite(serialized, offset);
        }
    }

    // If the stream is writable, write the command.  Else enqueue the command
    // for when we first establish a connection or reconnect.

    if (this.stream.writable) {
        this.originalCommands.push(originalCommand);
        var outBuffer = new Buffer(offset);
        this.requestBuffer.copy(outBuffer, 0, 0, offset);
        this.stream.write(outBuffer, 'binary');

        if (exports.debugMode) 
            sys.debug("[SEND] " + debugFilter(this.requestBuffer, offset) + 
                " originalCommands = " + this.originalCommands.length);
    } else {
        var toEnqueue = new Buffer(offset);
        this.requestBuffer.copy(toEnqueue, 0, 0, offset);  // dst, dstStart, srcStart, srcEnd
        this.queuedRequestBuffers.push(toEnqueue);
        this.queuedOriginalCommands.push(originalCommand);

        if (exports.debugMode) {
            sys.debug("[ENQUEUE] Not connected. Request queued. There are " + 
                this.queuedRequestBuffers.length + " requests queued.");
        }
    }
};

commands.forEach(function (commandName) {
    Client.prototype[commandName] = function () {
        var args = Array.prototype.slice.call(arguments);
        // [[1,2,3],function(){}] => [1,2,3,function(){}]
        if (args.length > 0 && Array.isArray(args[0])) 
          args = args.shift().concat(args);
        args.unshift(commandName);
        this.sendCommand.apply(this, args);
    };
});

// Send any commands that were queued while we were not connected.

Client.prototype.flushQueuedCommands = function () {
    if (exports.debugMode && this.queuedRequestBuffers.length > 0) 
        sys.debug("[FLUSH QUEUE] " + this.queuedRequestBuffers.length + 
                  " queued request buffers.");

    for (var i=0; i<this.queuedRequestBuffers.length && this.stream.writable; ++i) {
        var buffer = this.queuedRequestBuffers.shift();
        this.stream.write(buffer, 'binary');
        this.originalCommands.push(this.queuedOriginalCommands.shift());

        if (exports.debugMode) 
            sys.debug("[DEQUEUE/SEND] " + debugFilter(buffer) + 
                      ". queued buffers remaining = " + 
                      this.queuedRequestBuffers.length);
    }
};

Client.prototype.makeErrorForCommand = function (command, errorMessage) {
    var err = new Error(errorMessage);
    err.originalCommand = command;
    return err;
};

Client.prototype.callbackCommandWithError = function (command, errorMessage) {
    var callback = command[command.length - 1];
    if (typeof callback == "function") 
        callback(this.makeErrorForCommand(command, errorMessage));
};

Client.prototype.callbackOrphanedCommandsWithError = function () {
    for (var i=0, n=this.originalCommands.length; i<n; ++i) 
        this.callbackCommandWithError(this.originalCommands[i], exports.COMMAND_ORPHANED_ERROR);
    this.originalCommands = [];
};

Client.prototype.callbackQueuedCommandsWithError = function () {
    for (var i=0, n=this.queuedOriginalCommands.length; i<n; ++i) 
        this.callbackCommandWithError(this.queuedOriginalCommands[i], exports.NO_CONNECTION_ERROR);
    this.queuedOriginalCommands = [];
    this.queuedRequestBuffers = [];
};

Client.prototype.giveupConnectionAttempts = function () {
    this.callbackOrphanedCommandsWithError();
    this.callbackQueuedCommandsWithError();
    this.noConnection = true;
    this.emit('noconnection', this);
};

Client.prototype.maybeReconnect = function () {
    if (this.stream.writable && this.stream.readable)
        return;

    if (this.expectingClose)
        return;

    // Do not reconnect on first connection failure.
    // Else try to reconnect if we're asked to. 

    if (this.connectionsMade == 0) {
        this.giveupConnectionAttempts();
    } else if (this.maxReconnectionAttempts > 0) {
        if (this.reconnectionAttempts++ >= this.maxReconnectionAttempts) {
            this.giveupConnectionAttempts();
        } else {
            this.reconnectionDelay *= 2;

            if (exports.debugMode) {
                sys.debug("[RECONNECTING " + this.reconnectionAttempts + "/" + 
                    this.maxReconnectionAttempts + "]");

                sys.debug("[WAIT " + this.reconnectionDelay + " ms]");
            }

            var self = this;

            this.reconnectionTimer = setTimeout(function () {
                self.emit('reconnecting', self);
                self.stream.connect(self.port, self.host);
            }, this.reconnectionDelay);
        }
    }
};

// Wraps 'subscribe' and 'psubscribe' methods to manage a single
// callback function per subscribed channel name/pattern.
//
// 'nameOrPattern' is a channel name like "hello" or a pattern like 
// "h*llo", "h?llo", or "h[ae]llo".
//
// 'callback' is a function that is called back with 2 args: 
// channel name/pattern and message payload.
//
// Note: You are not permitted to do anything but subscribe to 
// additional channels or unsubscribe from subscribed channels 
// when there are >= 1 subscriptions active.  Should you need to
// issue other commands, use a second client instance.

Client.prototype.subscribeTo = function (nameOrPattern, callback) {
    if (typeof this.channelCallbacks[nameOrPattern] === 'function')
        return;

    if (typeof(callback) !== 'function')
        throw new Error("requires a callback function");

    this.channelCallbacks[nameOrPattern] = callback;

    var method = nameOrPattern.match(/[\*\?\[]/) 
               ? "psubscribe" 
               : "subscribe";

    this[method](nameOrPattern);
};

Client.prototype.unsubscribeFrom = function (nameOrPattern) {
    if (typeof this.channelCallbacks[nameOrPattern] === 'undefined') 
        return;

    delete this.channelCallbacks[nameOrPattern];

    var method = nameOrPattern.match(/[\*\?\[]/) 
               ? "punsubscribe" 
               : "unsubscribe";

    this[method](nameOrPattern);
};

// Multi-bulk replies return an array of other replies.  Perhaps all you care
// about is the representation of such buffers as UTF-8 encoded strings? Use
// this to convert each such Buffer to a (UTF-8 encoded) String in-place.

exports.convertMultiBulkBuffersToUTF8Strings = function (o) {
    if (o instanceof Array) {
        for (var i=0; i<o.length; ++i) 
            if (o[i] instanceof Buffer) 
                o[i] = o[i].utf8Slice(0, o[i].length);
    } else if (o instanceof Object) {
        var props = Object.getOwnPropertyNames(o);
        for (var i=0; i<props.length; ++i) 
            if (o[props[i]] instanceof Buffer) 
                o[props[i]] = o[props[i]].utf8Slice(0, o[props[i]].length);
    }
};

