
/**
 * Module dependencies.
 */

var sys = require('sys'),
    http = require('http'),
    connect = require('connect'),
    RedisStore = require('./index');
    
http.IncomingMessage.prototype.flash = function(type, msg){
    var msgs = this.session.flash = this.session.flash || {};
    if (type && msg) {
        (msgs[type] = msgs[type] || []).push(msg);
    } else if (type) {
        var arr = msgs[type];
        delete msgs[type];
        return arr || [];
    } else {
        this.session.flash = {};
        return msgs;
    }
};

// Expire after two minutes
var redisStore = new RedisStore({ maxAge: 60000 * 2 });

connect.createServer(
    // session requires cookieDecoder
    connect.cookieDecoder(),
    
    // Pass custom session store
    connect.session({ store: redisStore }),
    
    // Ignore favicon
    function(req, res, next){
        if (req.url === '/favicon.ico') {
            res.writeHead(404, {});
            res.end();
        } else {
            next();
        }
    },
    
    // Increment views
    function(req, res){
        req.session.count = req.session.count || 0
        ++req.session.count;
        
        // Display online count
        req.sessionStore.length(function(err, len){
            if (req.session.count < 10) {
                var msgs = req.flash('info').join('\n');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write(msgs);
                res.write('<p>online : ' + len + '</p>');
                res.end('<p>views: ' + req.session.count + '</p>');
            } else {
                // regenerate session after 10 views
                req.session.regenerate(function(){
                    req.flash('info', 'sess key is now <strong>' + req.sessionHash + '</strong>');
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('regenerated session');
                });
            }
        });
    }
).listen(3000);

sys.puts('Connect server started on port 3000');