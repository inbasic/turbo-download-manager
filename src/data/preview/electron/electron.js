'use strict';

var background = {  // jshint ignore:line
  receive: (id, callback) => window.top.register(id + '@pr', callback),
  send: (id, data) => window.top.ipcRenderer.send(id + '@pr', {
    url: 'preview/index.html',
    data
  })
};
