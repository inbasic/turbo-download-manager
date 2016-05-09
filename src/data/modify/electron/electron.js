'use strict';
var ipcRenderer = window.top.ipcRenderer;

var background = {  // jshint ignore:line
  receive: (id, callback) => window.top.register(id + '@md', callback),
  send: (id, data) => ipcRenderer.send(id + '@md', {
    url: 'modify/index.html',
    data
  })
};
