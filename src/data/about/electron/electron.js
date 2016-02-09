'use strict';
var ipcRenderer = window.top.ipcRenderer;

var background = {  // jshint ignore:line
  receive: (id, callback) => ipcRenderer.on(id + '@ab', function (event, arg) {
    if (arg && arg.url === 'background.html') {
      callback(arg.data);
    }
  }),
  send: (id, data) => ipcRenderer.send(id + '@ab', {
    url: 'about/index.html',
    data
  })
};
