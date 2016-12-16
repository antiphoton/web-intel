var fs = require('fs');
var path = require('path');
var getArg = require(path.join(__dirname, '..', 'lib', 'argv', 'index.js'))(path.join(__dirname, '..'));
var chatFileName = (function() {
    var chatDir = getArg('chatDir');
    var chatPrefix = getArg('chatPrefix');
    var chatFile = getArg('chatFile');
    var files;
    var list;
    if (chatFile.length === 0) {
        files = fs.readdirSync(chatDir);
        files = files.filter(file  => {
            return file.startsWith(chatPrefix);
        });
        list = files.map(file  => {
            var date = 0, time = 0;
            if (/(\d{8})_(\d{6})\.txt$/.test(file)) {
                date = parseInt(RegExp.$1);
                time = parseInt(RegExp.$2);
            }
            return [date, time, file];
        });
        list.sort((x1, x2)  => {
            if (x1[0] !== x2[0]) {
                return - x1[0] + x2[0];
            }
            return - x1[1] + x2[1];
        });
        chatFile = list[0][2];
    }
    return path.join(chatDir, chatFile);
})();
var onchangeListener;
var chatList = [];
var parseData = function(data) {
    var lines = data.split('\n');
    var n = lines.length;
    var i;
    if (!onchangeListener) {
        return ;
    }
    if (lines.length < chatList.length) {
        return ;
    }
    if (!forcePush) {
        if (lines.length === chatList.length) {
            return ;
        }
    }
    chatList = lines;
    forcePush = false;
    onchangeListener(data);
};
var readingFile = false;
var forcePush = true;
var requestParsing = function() {
    if (readingFile) {
        return ;
    }
    readingFile = true;
    fs.readFile(chatFileName, {encoding: 'ucs2'}, (err, data) => {
        if (err) {
            throw err;
            return ;
        }
        parseData(data);
        readingFile = false;
    });
};
fs.watch(chatFileName, (eventType, fileName) => {
    if (eventType !== 'change') {
        return ;
    }
    requestParsing();
});
requestParsing();
var forceUpdate = function() {
    forcePush = true;
    requestParsing();
};
var setListener = function(f) {
    onchangeListener = f;
    forceUpdate();
};
exports.setListener = setListener;
exports.forceUpdate = forceUpdate;

