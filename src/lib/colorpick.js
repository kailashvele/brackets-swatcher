/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, browser: true */
/*global $ */
define(function(require, exports, module) {

    var canvas;
    var ctx;

    var ColorPicker = {

        scale: 1,
        debug: true,

        coords: {

            start: {
                x: 0,
                y: 0
            },

            end: {
                x: 0,
                y: 0
            },

            x: 0,
            y: 0
        },

        image: false,

        config: {
            zoomStep: 0.3
        },

        init: function(image) {
            canvas = document.getElementById('swatcher-cp-canvas');
            ctx = canvas.getContext('2d');
            
            var c = document.getElementById('swatcher-cp-holder');
            canvas.width = c.clientWidth;
            canvas.height = 350;
            ColorPicker.image = image;

            ColorPicker.zoom('x');

        },

        crosshair: function(x, y) {
            ColorPicker.draw();

            ctx.beginPath();
            ctx.strokeStyle = "#2893ef";
            ctx.setLineDash([5,2]);
            
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);            
            ctx.stroke();
            ctx.closePath();
        },

        draw: function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.drawImage(
                ColorPicker.image,
                ColorPicker.coords.x,
                ColorPicker.coords.y,
                ColorPicker.image.width * ColorPicker.scale,
                ColorPicker.image.height * ColorPicker.scale
            );
        },

        rgbtohex: function(R, G, B) {

            function toHex(n) {
                n = parseInt(n, 10);
                if (isNaN(n)) return "00";
                n = Math.max(0, Math.min(n, 255));
                return "0123456789ABCDEF".charAt((n - n % 16) / 16) + "0123456789ABCDEF".charAt(n % 16);
            }

            return "#" + toHex(R) + toHex(G) + toHex(B);
        },

        pick: function(x, y) {
            var imgData = ctx.getImageData(x, y, 1, 1).data;
            ColorPicker.crosshair(x, y);
            return ColorPicker.rgbtohex(imgData[0], imgData[1], imgData[2]);
        },

        fitToScreen: function() {
            if (ColorPicker.image.width > canvas.width) {
                ColorPicker.scale = (canvas.width / (ColorPicker.image.width / 100)) / 100;
            } else if (ColorPicker.image.height > canvas.height) {
                ColorPicker.scale = (canvas.height / (ColorPicker.image.height / 100)) / 100;
            } else {
                ColorPicker.scale = 1;
            }
        },

        panStart: function(x, y) {
            ColorPicker.coords.start.x = x - ColorPicker.coords.end.x;
            ColorPicker.coords.start.y = y - ColorPicker.coords.end.y;
        },

        panEnd: function(x, y) {
            ColorPicker.coords.end.x = x - ColorPicker.coords.start.x;
            ColorPicker.coords.end.y = y - ColorPicker.coords.start.y;
        },

        pan: function(x, y) {
            ColorPicker.coords.x = x - ColorPicker.coords.start.x;
            ColorPicker.coords.y = y - ColorPicker.coords.start.y;

            ColorPicker.draw();
        },

        zoom: function(arg) {
            switch (arg) {
                case '+':
                    ColorPicker.scale = ColorPicker.scale + ColorPicker.config.zoomStep;
                    break;

                case '-':
                    ColorPicker.scale = ColorPicker.scale - ColorPicker.config.zoomStep;
                    break;

                case 'x':
                    ColorPicker.fitToScreen();
                    break;
            }

            var newX = (canvas.width - (ColorPicker.image.width * ColorPicker.scale)) / 2;
            var newY = (canvas.height - (ColorPicker.image.height * ColorPicker.scale)) / 2;

            ColorPicker.coords.start.x = 0;
            ColorPicker.coords.start.y = 0;

            ColorPicker.coords.end.x = newX;
            ColorPicker.coords.end.y = newY;

            ColorPicker.coords.x = newX;
            ColorPicker.coords.y = newY;

            ColorPicker.draw();
        }
    };
    
    return ColorPicker;
});
