'use strict';
var ipcRenderer = window.top.ipcRenderer;

var background = {  // jshint ignore:line
  receive: (id, callback) => ipcRenderer.on(id + '@if', function (event, arg) {
    if (arg && arg.url === 'background.html') {
      callback(arg.data);
    }
  }),
  send: (id, data) => ipcRenderer.send(id + '@if', {
    url: 'info/index.html',
    data
  })
};

var manifest = { // jshint ignore:line
  support: true
};
