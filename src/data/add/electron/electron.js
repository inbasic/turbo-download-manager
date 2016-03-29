'use strict';
var ipcRenderer = window.top.ipcRenderer;

var background = { // jshint ignore:line
  receive: (id, callback) => ipcRenderer.on(id + '@ad', function (event, arg) {
    if (arg && arg.url === 'background.html') {
      callback(arg.data);
    }
  }),
  send: (id, data) => ipcRenderer.send(id + '@ad', {
    url: 'add/index.html',
    data
  })
};

var manifest = { // jshint ignore:line
  folder: false,
  support: true,
  sandbox: true,
  referrer: true
};
