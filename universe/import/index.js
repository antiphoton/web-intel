'use strict';
var fs = require('fs');
var path = require('path');
var symbolIndent = Symbol('indent');
var symbolParent =  Symbol('parent');
var symbolArray = Symbol('array');
var createNewObj = function(indent, parent) {
    var obj = {};
    obj[symbolIndent] = indent;
    obj[symbolParent] = parent;
    obj[symbolArray] = [];
    return obj;
};
var parseFile = function(filename) {
    var data = fs.readFileSync(filename, 'utf8');
    var lines = data.split('\n');
    var root = createNewObj(-1, null);
    var currentIndent;
    var currentObj = root;
    var n=lines.length;
    var line;
    var key,value;
    var childObj;
    var i;
    for (i = 0; i < n; i++) {
        line=lines[i];
        /^( *)([\S\s]*)$/.test(line);
        currentIndent = RegExp.$1.length;
        line = RegExp.$2;
        if (/^- /.test(line)) {
            currentIndent++;
        }
        while (currentIndent <= currentObj[symbolIndent]) {
            currentObj = currentObj[symbolParent];
        }
        if (/^- (-?[\d\.]+(e[+-]?\d+)?)$/.test(line)) {
            value = RegExp.$1;
            currentObj[symbolArray].push(value);
        }
        else if (/^(\w+): ([\S\s]+)$/.test(line)) {
            key = RegExp.$1;
            value = RegExp.$2;
            currentObj[key] = value;
        }
        else if (/^(\w+):$/.test(line)) {
            key = RegExp.$1;
            childObj = createNewObj(currentIndent, currentObj);
            currentObj[key] = childObj;
            currentObj = childObj;
        }
    }
    return root;
};
var systemLib = {}, stargateLib = {};
var parseSystem = function(systemName, filename) {
    var data = parseFile(filename);
    var neighbours = [];
    var stargates = data['stargates']
    var stargateId, stargateInfo;
    var destination, typeId;
    var systemObj = {};
    systemObj.center = data['center'][symbolArray].map(parseFloat);
    if (stargates === '{}') {
    }
    else {
        for (stargateId in stargates) {
            stargateInfo = stargates[stargateId];
            destination = stargateInfo['destination'];
            neighbours.push(destination);
            stargateLib[stargateId] = systemName;
        }
    }
    systemObj.neighbours = neighbours;
    return systemObj;
};
var readAll = function(rootDir) {
    var universes = fs.readdirSync(rootDir);
    universes.forEach(universeName => {
        var universeFolder = path.join(rootDir, universeName);
        var regions = fs.readdirSync(universeFolder);
        regions.forEach(regionName => {
            var regionFolder = path.join(universeFolder, regionName);
            var constellations = fs.readdirSync(regionFolder);
            constellations.forEach(constellationName => {
                var constellationFolder;
                var systems;
                if (constellationName === 'region.staticdata') {
                }
                else {
                    constellationFolder = path.join(regionFolder, constellationName);
                    systems = fs.readdirSync(constellationFolder);
                    systems.forEach(systemName => {
                        var systemObj;
                        if (systemName === 'constellation.staticdata') {
                        }
                        else {
                            systemObj = parseSystem(systemName, path.join(constellationFolder,systemName,'solarsystem.staticdata'));
                            systemObj.constellation = constellationName;
                            systemObj.region = regionName;
                            systemObj.fullName = universeName + ' > ' + regionName + ' > ' + constellationName + ' > ' + systemName;
                            systemLib[systemName] = systemObj;
                        }
                    });
                }
            });
        });
    });
};
var infoList, stargateList1,stargateList2,stargateList3;
var analyzeNeighbour = function() {
    var systemName1, systemId1;
    var systemName2, systemId2;
    var children,nChild,iChild;
    var systemObj1, systemObj2;
    var region1, region2, constellation1, constellation2;
    var pair;
    infoList = [];
    stargateList1 = [];
    stargateList2 = [];
    stargateList3 = [];
    var idLib = {};
    for (systemName1 in systemLib) {
        idLib[systemName1] = infoList.length;
        systemObj1 = systemLib[systemName1];
        infoList.push({
            name: systemName1,
            fullName: systemObj1.fullName,
            center: systemObj1.center
        });
    }
    for (systemId1 = 0; systemId1 < infoList.length; systemId1++) {
        systemName1 = infoList[systemId1].name;
        systemObj1 = systemLib[systemName1];
        region1 = systemObj1.region;
        constellation1 = systemObj1.constellation;
        children = systemObj1.neighbours;
        nChild = children.length;
        for (iChild = 0; iChild < nChild; iChild++) {
            systemName2 = stargateLib[children[iChild]];
            systemObj2 = systemLib[systemName2];
            if (!systemObj2) {
                continue;
            }
            systemId2 = idLib[systemName2];
            if (systemId1 > systemId2) {
                continue;
            }
            pair = [systemId1, systemId2];
            region2 = systemObj2.region;
            constellation2 = systemObj2.constellation;
            if (region1 !== region2) {
                stargateList3.push(pair);
            }
            else if (constellation1 !== constellation2) {
                stargateList2.push(pair);
            }
            else {
                stargateList1.push(pair);
            }
        }
    }
};
var print = function() {
    var output = {};
    output.node = infoList.map(info => {
        return [info.fullName, info.center];
    });
    output.systemGate = stargateList1;
    output.constellationGate = stargateList2;
    output.regionGate = stargateList3;
    fs.writeFileSync('data.txt',JSON.stringify(output,null,' '));
};
readAll(path.join(__dirname, 'fsd', 'universe'));
analyzeNeighbour();
print();

