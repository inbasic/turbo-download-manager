'use strict';

var background = {  // jshint ignore:line
  receive: (id, callback) => window.top.register(id + '@cf', callback),
  send: (id, data) => window.top.ipcRenderer.send(id + '@cf', {
    url: 'config/index.html',
    data
  })
};
