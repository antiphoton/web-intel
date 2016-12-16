var path = require('path');
var fileMonitor = require(path.join(__dirname, 'server', 'monitor.js'));
var routerManager = require(path.join(__dirname, 'server', 'router.js'));

var symbolSent = Symbol('sent');
var socketList = [];
routerManager.setConnectionListener(socket => {
    socket[symbolSent]=0;
    socketList.push(socket);
    fileMonitor.forceUpdate();
});
fileMonitor.setListener(data => {
    var total = data.length;
    socketList.forEach(function(socket) {
        var sent = socket[symbolSent];
        var msg = data.slice(sent);
        if (msg.length > 0) {
            socket.emit('chat', msg);
        }
        socket[symbolSent] = total;
    });
});

