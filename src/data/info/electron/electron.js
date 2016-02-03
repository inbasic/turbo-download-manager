'use strict';
var ipcRenderer = window.top.ipcRenderer;

var background = {
  receive: function (id, callback) {
    id += '@if';
    ipcRenderer.on(id, function (event, arg) {
      if (arg && arg.url === 'background.html') {
        callback(arg.data);
      }
    });
  },
  send: function (id, data) {
    id += '@if';
    ipcRenderer.send(id, {
      url: 'info/index.html',
      data
    });
  }
};
