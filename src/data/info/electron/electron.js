'use strict';
var ipcRenderer = window.top.ipcRenderer;

var background = {  // jshint ignore:line
  receive: (id, callback) => window.top.register(id + '@if', callback),
  send: (id, data) => ipcRenderer.send(id + '@if', {
    url: 'info/index.html',
    data
  })
};

var manifest = { // jshint ignore:line
  support: true
};
