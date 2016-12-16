(function() {
    var socket=io.connect(window.location.origin);
    socket.on('chat',function(data) {
        var lines=data.split('\n');
    });
    socket.on('disconnect',function() {
        console.log('disconnect');
    });
})();

