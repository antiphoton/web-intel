var fs = require('fs');
var path = require('path');
var getArg = require(path.join(__dirname, '..', '..', 'lib', 'argv', 'index.js'))(__dirname);

var universeIn = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'import', 'data.txt')));
var symbolCore = Symbol('core');
var symbolBorder = Symbol('border');
var dictSimplify;
var universeOut;
var box;
var markNodes = (function() {
    var spaceFilter = getArg('space');
    var regionFilter = getArg('region');
    var constellationFilter = getArg('constellation');
    var systemFilter = getArg('system');
    var cutoff = getArg('cutoff');
    var neighbour;
    var distance;
    var findCore = function() {
        var a = universeIn.node;
        var n = a.length;
        distance = new Uint16Array(n);
        var i;
        var fullname;
        var spaceName, regionName, constellationName, systemName;
        for (i = 0; i < n; i++) {
            fullname = a[i][0];
            /^(\S+) > (\S+) > (\S+) > (\S+)/.test(fullname);
            spaceName = RegExp.$1;
            regionName = RegExp.$2;
            constellationName = RegExp.$3;
            systemName = RegExp.$4;
            if (spaceName == spaceFilter
                || regionName == regionFilter
                || constellationName == constellationFilter
                || systemName == systemFilter) {
                distance[i] = 0;
                a[i][symbolCore] = true;
            }
            else {
                distance[i] = 65535;
            }
        }
    };
    var buildNeighbour = function() {
        var a = universeIn.node;
        var n = a.length;
        var i;
        neighbour = [];
        for (i = 0; i < n; i++) {
            neighbour.push([]);
        }
        var pushPairList = function(pairList) {
            var m = pairList.length;
            var v1, v2;
            var i;
            for (i = 0; i < m; i++) {
                v1 = pairList[i][0];
                v2 = pairList[i][1];
                neighbour[v1].push(v2);
                neighbour[v2].push(v1);
            }
        };
        pushPairList(universeIn.systemGate);
        pushPairList(universeIn.constellationGate);
        pushPairList(universeIn.regionGate);
    };
    var expandCore = function() {
        if (cutoff === 0) {
            return ;
        }
        var q = [], offset = 0;
        var a = universeIn.node;
        var n = a.length;
        var i;
        var inQueue = new Uint8Array(n);
        var v, dV, t;
        for (i = 0; i < n; i++) {
            if (distance[i] === 0) {
                q.push(i);
                inQueue[i] = 1;
            }
            else {
                inQueue[i] = 0;
            }
        }
        while (q.length > offset) {
            v = q[offset];
            offset++;
            dV = distance[v];
            if (dV > cutoff) {
                continue;
            }
            if (dV > 0) {
                a[v][symbolBorder] = true;
            }
            for (i = 0; i < neighbour[v].length; i++) {
                t = neighbour[v][i];
                if (distance[t] > dV + 1) {
                    distance[t] = dV + 1;
                    if (inQueue[t] === 0) {
                        inQueue[t] = 1;
                        q.push(t);
                    }
                }
            }
            inQueue[v] = false;
        }
    };
    return function() {
        findCore();
        buildNeighbour();
        expandCore();
    };
})();
var buildDict = function() {
    var a = universeIn.node;
    var n = a.length;
    dictSimplify = new Int16Array(n);
    var m = 0;
    var i;
    for (i = 0; i < n; i++) {
        if (a[i][symbolCore] || a[i][symbolBorder]) {
            dictSimplify[i] = m;
            m++;
        }
        else {
            dictSimplify[i] = -1;
        }
    }
};
var filter = function() {
    universeOut = {};
    universeOut.node = [];
    var a = universeIn.node;
    var n = a.length;
    var i;
    for (i = 0; i < n; i++) {
        if (dictSimplify[i]>=0) {
            universeOut.node.push(a[i]);
        }
    }
    universeOut.edge = [];
    var analyzeEdge = function(pairList, pairType) {
        var m = pairList.length;
        var v1, v2;
        var i;
        for (i = 0; i < m; i++) {
            v1 = pairList[i][0];
            v2 = pairList[i][1];
            if (dictSimplify[v1] < 0 || dictSimplify[v2] < 0) {
                continue;
            }
            universeOut.edge.push([pairType, v1, v2]);
        }
    };
    analyzeEdge(universeIn.systemGate, 0);
    analyzeEdge(universeIn.constellationGate, 1);
    analyzeEdge(universeIn.regionGate, 2);
};
var calcBox = function() {
    box = {};
    var abstractLayout = getArg('abstract');
    var scaling = getArg('scaling');
    var margin = getArg('margin');
    margin /= scaling;
    var a = universeIn.node;
    var n = a.length;
    var node;
    var xlo, xhi, ylo, yhi, zlo, zhi;
    var x, y, z;
    var i;
    for (i = 0; i < n; i++) {
        if (dictSimplify[i] < 0) {
            continue;
        }
        node = universeIn.node[i];
        node[1] = node[1].map(x => {
            return x / scaling;
        });
        if (abstractLayout) {
            node[1][2] = 0;
        }
        x = node[1][0];
        y = node[1][1];
        z = node[1][2];
        if (!(xlo < x)) {
            xlo = x;
        }
        if (!(xhi > x)) {
            xhi = x;
        }
        if (!(ylo < y)) {
            ylo = y;
        }
        if (!(yhi > y)) {
            yhi = y;
        }
        if (!(zlo < z)) {
            zlo = z;
        }
        if (!(zhi > z)) {
            zhi = z;
        }
    }
    for (i = 0; i < n; i++) {
        if (dictSimplify[i] < 0) {
            continue;
        }
        node = universeIn.node[i];
        node[1][0] += margin - xlo;
        node[1][1] += margin - ylo;
        node[1][2] += margin - zlo;
    }
    box.x = xhi - xlo + margin * 2;
    box.y = yhi - ylo + margin * 2;
    box.z = zhi - zlo + margin * 2;
};
var writeJson = function() {
    fs.writeFileSync('data.txt', JSON.stringify(universeOut, null, ' '));
};
var writeSnapshot = function() {
    var lines = [];
    var a = universeIn.node;
    var n = a.length;
    var i;
    var name, center;
    lines.push(n);
    lines.push('');
    for (i = 0; i < n; i++) {
        if (dictSimplify[i] < 0) {
            continue;
        }
        name = a[i][0];
        center = a[i][1];
        /^(\S+) > (\S+) > (\S+) > (\S+)/.test(name);
        lines.push('H  ' + center[0] + ' ' + center[1] + ' ' + center[2]);
    }
    lines.push('');
    fs.writeFileSync('snapshot.txt', lines.join('\n'));
};
var writePhysics = function() {
    var lines = [];
    lines.push(new Date());
    var a = universeOut.node;
    var b = universeOut.edge;
    var n = a.length;
    var m = b.length;
    var i;
    var name, center;
    lines.push(n + ' atoms');
    lines.push(m + ' bonds');
    lines.push('1 atom types');
    lines.push('3 bond types');
    lines.push([0, box.x, 'xlo', 'xhi'].join(' '));
    lines.push([0, box.y, 'ylo', 'yhi'].join(' '));
    lines.push([0, box.z, 'zlo', 'zhi'].join(' '));
    lines.push('');
    lines.push('Atoms');
    lines.push('');
    for (i = 0; i < n; i++) {
        name = a[i][0];
        center = a[i][1];
        lines.push([i + 1, 1, center[0], center[1], center[2]].join(' '));
    }
    lines.push('');
    lines.push('Bonds');
    lines.push('');
    for (i = 0; i < m; i++) {
        lines.push([i+1, b[i][0]+1, b[i][1], b[i][2]].join(' '));
    }
    lines.push('');
    fs.writeFileSync('physics.txt', lines.join('\n'));
};
var write = function() {
    writeJson();
    writeSnapshot();
    writePhysics();
};
markNodes();
buildDict();
filter();
calcBox();
write();

