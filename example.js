
/**
 * Module dependencies.
 */

var sys = require('sys'),
    connect = require('connect'),
    RedisStore = require('./index');

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
        res.writeHead(200, { 'Content-Type': 'text/html' });
        
        // Display online count
        req.sessionStore.length(function(err, len){
            if (req.session.count < 10) {
                res.write('<p>online : ' + len + '</p>');
                res.end('<p>views for <strong>' + req.sessionHash + '</strong>: ' + req.session.count + '</p>');
            } else {
                // regenerate session after 10 views
                req.session.regenerate(function(){
                    res.end('regenerated session');
                });
            }
        });
    }
).listen(3000);

sys.puts('Connect server started on port 3000');