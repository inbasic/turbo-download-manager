'use strict';
var ipcRenderer = window.top.ipcRenderer;

var background = {  // jshint ignore:line
  receive: (id, callback) => window.top.register(id + '@ab', callback),
  send: (id, data) => ipcRenderer.send(id + '@ab', {
    url: 'about/index.html',
    data
  })
};
