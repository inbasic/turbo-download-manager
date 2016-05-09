'use strict';
var ipcRenderer = window.top.ipcRenderer;

var background = {  // jshint ignore:line
  receive: (id, callback) => window.top.register(id + '@tr', callback),
  send: (id, data) => ipcRenderer.send(id + '@tr', {
    url: 'triggers/index.html',
    data
  })
};
