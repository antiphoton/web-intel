'use strict';
(function () {
    var SOLAR_SYSTEM_RADIUS = 0.2;
    var STARGATE_WIDTH = 0.1;
    var svgWindow;
    var svgUniverse;
    var symbolName = Symbol('name');
    var solarSystems = [];
    var stargates = [];
    var edges = new Uint16Array(1);
    var trajectory = [new Float32Array(1)];
    var nFrame = 0, nAtom = 0;
    var box = {};
    var createSolarSystems = function (names) {
        var n;
        var i;
        var circle;
        solarSystems = [];
        n = names.length;
        for (i = 0; i < n; i++) {
            circle = svgUniverse['circle'](SOLAR_SYSTEM_RADIUS * 2);
            circle['node'][symbolName] = names[i];
            solarSystems.push(circle);
        }
    };
    var createStargates = function () {
        var n = edges.length / 3;
        var i;
        var line;
        var colors = ['black', 'blue', 'purple'];
        for (i = 0; i < n; i++) {
            line = svgUniverse['line'](0, 0, 1, 1);
            line['stroke']({
                'width': STARGATE_WIDTH,
                'color': colors[edges[i * 3]]
            });
            stargates.push(line);
        }
    };
    var addMouseListeners = function (wrapper) {
        var currentZoom = parseFloat(localStorage.getItem('scale') || 1);
        var zoomMultiplier = 1.1;
        var currentTranslateX = parseFloat(localStorage.getItem('x') || 0);
        var currentTranslateY = parseFloat(localStorage.getItem('y') || 0);
        var updateTransform = function() {
            localStorage.setItem('scale', currentZoom);
            localStorage.setItem('x', currentTranslateX);
            localStorage.setItem('y', currentTranslateY);
            svgUniverse['transform']({
                'scale': currentZoom
            });
            svgUniverse['transform']({
                'x': currentTranslateX,
                'y': currentTranslateY
            });
        };
        updateTransform();
        wrapper['on']('wheel', function (event) {
            var delta = event['originalEvent']['deltaY'];
            var x = (event['offsetX'] - currentTranslateX) / currentZoom;
            var y = (event['offsetY'] - currentTranslateY) / currentZoom;
            if (delta > 0) {
                currentZoom *= zoomMultiplier;
            }
            if (delta < 0) {
                currentZoom /= zoomMultiplier;
            }
            currentTranslateX = event['offsetX'] - currentZoom * x;
            currentTranslateY = event['offsetY'] - currentZoom * y;
            updateTransform();
        });
        var dragging = false, dragX, dragY;
        var checkDrag = function (event) {
            if (!dragging) {
                return ;
            }
            var currentMouseX = event['offsetX'];
            var currentMouseY = event['offsetY'];
            if (dragX === undefined) {
                dragX = currentMouseX;
                dragY = currentMouseY;
                return ;
            }
            var dX, dY;
            dX = currentMouseX - dragX;
            dY = currentMouseY - dragY;
            dragX = currentMouseX;
            dragY = currentMouseY;
            currentTranslateX += dX;
            currentTranslateY += dY;
            updateTransform();
        };
        wrapper['on']('mousedown', function (event) {
            dragging = true;
            checkDrag(event);
        });
        wrapper['on']('mousemove', function (event) {
            checkDrag(event);
        });
        wrapper['on']('mouseup', function (event) {
            checkDrag(event);
            dragging = false;
            dragX = undefined;
        });
        var divLabel = $('<div/>')['appendTo']($('body'));
        divLabel['addClass']('solarSystemLabel');
        var divRegion = $('<div/>')['addClass']('regionName')['appendTo'](divLabel);
        var divConstellation = $('<div/>')['addClass']('constellationName')['appendTo'](divLabel);
        var divSystem = $('<div/>')['addClass']('systemName')['appendTo'](divLabel);
        wrapper['on']('mousemove', 'circle', function(event) {
            var fullName = event['target'][symbolName];
            divRegion['html'](fullName[1]);
            divConstellation['html'](fullName[2]);
            divSystem['html'](fullName[3]);
            divLabel['css']({
                'top': event['pageY'],
                'left': event['pageX']
            });
        });
        wrapper['on']('mouseover', 'circle', function(event) {
            divLabel['show']();
        });
        wrapper['on']('mouseout', 'circle', function(event) {
            divLabel['hide']();
        });
    };
    var seekFrame = function(iFrame) {
        var snapshot = trajectory[iFrame];
        var i;
        for (i = 0; i < nAtom; i++) {
            solarSystems[i]['transform']({
                'x': snapshot[i * 2 + 0] - SOLAR_SYSTEM_RADIUS,
                'y': snapshot[i * 2 + 1] - SOLAR_SYSTEM_RADIUS
            });
        }
        var v1, v2;
        var n = stargates.length;
        for (i = 0; i < n; i++) {
            v1 = edges[i * 3 + 1];
            v2 = edges[i * 3 + 2];
            stargates[i]['plot'](
                snapshot[v1 * 2 + 0],
                snapshot[v1 * 2 + 1],
                snapshot[v2 * 2 + 0],
                snapshot[v2 * 2 + 1]
            );
        }
    };
    var createFrameController = function() {
        var div = $('<input/>')['appendTo']($('body'));
        div['attr']('type', 'range');
        div['attr']('min', 0);
        div['attr']('max', nFrame - 1);
        div['attr']('value', nFrame - 1);
        div['on']('change input', function (event) {
            var iFrame = parseInt(div['val']());
            seekFrame(iFrame);
        });
    };
    (function () {
        var systemNames;
        var dataDidLoad = function() {
            var divAll = $('<div/>')['appendTo']($('body'));
            divAll['attr']('id', 'svgWindow');
            svgWindow = SVG('svgWindow');
            svgUniverse = svgWindow['group']();
            createStargates();
            createSolarSystems(systemNames);
            addMouseListeners(divAll);
            createFrameController();
            seekFrame(nFrame - 1);
        };
        var n = 3;
        var check = function () {
            n--;
            if (n === 0) {
                dataDidLoad();
            }
        };
        $['get']('trajectory_data/name.txt', data => {
            systemNames = data.split('\n').map( x => {
                return x.split(' > ');
            });
            nAtom = systemNames.length;
            check();
        });
        $['get']('trajectory_data/graph.txt', data => {
            var lines = data.split('\n');
            var nLine = lines.length;
            var n;
            var m;
            var matches;
            var i;
            box = {};
            matches = lines[0].match(/^(-?[\d\.]+) (-?[\d\.]+)$/);
            box.xMin = parseFloat(matches[1]);
            box.xMax = parseFloat(matches[2]);
            matches = lines[1].match(/^(-?[\d\.]+) (-?[\d\.]+)$/);
            box.yMin = parseFloat(matches[1]);
            box.yMax = parseFloat(matches[2]);
            n = parseInt(lines[2]);
            m = parseInt(lines[3 + n]);
            edges = new Uint16Array(m * 3);
            for (i= 0; i< m; i++) {
                matches = lines[4 + n + i].match(/^(\d+) (\d+) (\d+)$/);
                edges[i * 3 + 0] = parseInt(matches[1]);
                edges[i * 3 + 1] = parseInt(matches[2]);
                edges[i * 3 + 2] = parseInt(matches[3]);
            }
            check();
        });
        $['get']('trajectory_data/data.txt', data => {
            var lines = data.split('\n');
            var nLine = lines.length;
            var iLine;
            var line;
            var matches;
            trajectory = [];
            var n, i;
            var snapshot;
            var id, x, y;
            for (iLine = 0; iLine < nLine; iLine++) {
                line = lines[iLine];
                matches = line.match(/^(\d+) (\d+)$/);
                if (!matches) {
                    break;
                }
                n = parseInt(matches[2]);
                snapshot = new Float32Array(n * 2);
                for (i = 0; i < n; i++) {
                    if (iLine + 1 + i >= nLine) {
                        break;
                    }
                    matches = lines[iLine + 1 + i].match(/^(-?[\d\.]+) (-?[\d\.]+)$/);
                    snapshot[i * 2 + 0] = parseFloat(matches[1]);
                    snapshot[i * 2 + 1] = parseFloat(matches[2]);
                }
                trajectory.push(snapshot);
                iLine += n;
            }
            nFrame = trajectory.length;
            check();
        });
    })();
})();

