var fs = require('fs');
var http = require('http');
var path = require('path');
var express = require('express');
var socketIo = require('socket.io');
var getArg = require(path.join(__dirname, '..', 'lib', 'argv', 'index.js'))(path.join(__dirname, '..'));
var app = express();
var sessionMiddleware = require('express-session')({
    secret: 'keyboard cat',
    resave: true,
    saveUninitialized: false
});
app.use(sessionMiddleware);
app.set('view engine', 'pug');
var clientPath=path.join(__dirname, '..', 'client');
app.use('/', express.static(clientPath));
app.get('/', (req, res, next) => {
    res.render(path.join(clientPath, 'index.pug'));
});
app.get('*.html', (req, res, next) => {
    var p = req['path'];
    next();
});
var server = http.Server(app);
var io = socketIo(server);
var connectionListener;
io.on('connection', socket => {
    if (connectionListener) {
        connectionListener(socket);
    }
    else {
        socket.disconnect();
    }
});
var port = getArg('portInternal');
server.listen(port, function() {
    fs.writeFile('pid',process.pid);
});
var setConnectionListener = function(f) {
    connectionListener = f;
};
exports.setConnectionListener=setConnectionListener;

