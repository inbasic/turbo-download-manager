'use strict';

var app = app || require('./firefox/firefox');
var config = config || require('./config');
var icon = typeof exports === 'undefined' ? {} : exports;

(function () {
  var canvas = app.canvas();

  function draw19 (value, mag, type) {
    var ctx = canvas.getContext('2d');

    canvas.width = 38 * mag;
    canvas.height = 38 * mag;
    ctx.clearRect (0, 0, 38 * mag, 38 * mag);
    ctx.beginPath();
    ctx.arc(19 * mag, 19 * mag, 17 * mag, 0, 2 * Math.PI);
    ctx.strokeStyle = '#a2a2a2';
    ctx.lineWidth = 4 * mag;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(19 * mag, 19 * mag, 17 * mag, 0, 2 * (value / 100) * Math.PI);
    ctx.strokeStyle = '#2883fc';
    ctx.lineWidth = 4 * mag;
    ctx.stroke();

    if (type === 'error') {
      ctx.beginPath();
      ctx.moveTo(28 * mag, 26 * mag);
      ctx.lineTo(19 * mag, 8 * mag);
      ctx.lineTo(10 * mag, 26 * mag);
      ctx.closePath();
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#595959';
      ctx.lineWidth = 2 * mag;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(19 * mag, 21 * mag);
      ctx.lineTo(19 * mag, 14 * mag);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(19 * mag, 23 * mag, 1 * mag, 0, 2 * Math.PI);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    else if (type === 'done') {
      ctx.beginPath();
      ctx.moveTo(19 * mag, 28 * mag);
      ctx.lineTo(12 * mag, 22 * mag);
      ctx.lineTo(15 * mag, 18 * mag);
      ctx.lineTo(18 * mag, 22 * mag);
      ctx.lineTo(25 * mag, 10 * mag);
      ctx.lineTo(28 * mag, 12 * mag);
      ctx.closePath();
      ctx.fillStyle = '#595959';
      ctx.fill();
    }
    else {
      ctx.beginPath();
      ctx.moveTo(16 * mag, 10 * mag);
      ctx.lineTo(22 * mag, 10 * mag);
      ctx.lineTo(22 * mag, 22 * mag);
      ctx.lineTo(26 * mag, 22 * mag);
      ctx.lineTo(19 * mag, 30 * mag);
      ctx.lineTo(12 * mag, 22 * mag);
      ctx.lineTo(16 * mag, 22 * mag);
      ctx.lineTo(16 * mag, 10 * mag);
      ctx.fillStyle = '#595959';
      ctx.fill();
    }

    return canvas.toDataURL('image/png');
  }

  function draw18 (value, mag, type) {
    var ctx = canvas.getContext('2d');

    canvas.width = 36 * mag;
    canvas.height = 36 * mag;
    ctx.clearRect (0, 0, 36 * mag, 36 * mag);
    ctx.beginPath();
    ctx.arc(18 * mag, 18 * mag, 16 * mag, 0, 2 * Math.PI);
    ctx.strokeStyle = '#a2a2a2';
    ctx.lineWidth = 4 * mag;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(18 * mag, 18 * mag, 16 * mag, 0, 2 * (value / 100) * Math.PI);
    ctx.strokeStyle = '#2883fc';
    ctx.lineWidth = 4 * mag;
    ctx.stroke();

    if (type === 'error') {
      ctx.beginPath();
      ctx.moveTo(27 * mag, 26 * mag);
      ctx.lineTo(18 * mag, 7 * mag);
      ctx.lineTo(9 * mag, 26 * mag);
      ctx.closePath();
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#595959';
      ctx.lineWidth = 2 * mag;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(18 * mag, 21 * mag);
      ctx.lineTo(18 * mag, 14 * mag);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(18 * mag, 23 * mag, 1 * mag, 0, 2 * Math.PI);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    else if (type === 'done') {
      ctx.beginPath();
      ctx.moveTo(18 * mag, 28 * mag);
      ctx.lineTo(9 * mag, 22 * mag);
      ctx.lineTo(14 * mag, 18 * mag);
      ctx.lineTo(17 * mag, 22 * mag);
      ctx.lineTo(25 * mag, 10 * mag);
      ctx.lineTo(28 * mag, 12 * mag);
      ctx.closePath();
      ctx.fillStyle = '#595959';
      ctx.fill();
    }
    else {
      ctx.beginPath();
      ctx.moveTo(14 * mag, 10 * mag);
      ctx.lineTo(22 * mag, 10 * mag);
      ctx.lineTo(22 * mag, 20 * mag);
      ctx.lineTo(26 * mag, 20 * mag);
      ctx.lineTo(18 * mag, 28 * mag);
      ctx.lineTo(10 * mag, 20 * mag);
      ctx.lineTo(14 * mag, 20 * mag);
      ctx.lineTo(14 * mag, 10 * mag);
      ctx.fillStyle = '#595959';
      ctx.fill();
    }

    return canvas.toDataURL('image/png');
  }
  icon.register = () => canvas = app.canvas();
  icon.percent = (function () {
    var oValue, oType, id;
    return function (type, value, reset) {
      if (!canvas) {
        return;
      }
      if (type !== 'done' && type !== 'error') {
        type = 'normal';
      }
      value = value === null ? oValue : value;
      value = value === 100 ? 0 : value;
      if (type !== 'normal') {
        app.timer.clearTimeout(id);
        id = app.timer.setTimeout(icon.percent, config.icon.timeout * 1000, null, 'normal', true);
        oType = type;
      }
      if (reset) {
        id = null;
      }
      if (type === 'normal' && id) {
        type = oType;
      }
      oValue = value;

      app.button.icon = app.globals.browser === 'firefox' ?
        {
          18: draw18(value, 0.5, type),
          36: draw18(value, 1, type),
          72: draw18(value, 2, type)
        } :
        {
          19: draw19(value, 0.5, type),
          38: draw19(value, 1, type)
        };
    };
  })();
})();
