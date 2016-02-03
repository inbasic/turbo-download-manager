'use strict';
var ipcRenderer = window.top.ipcRenderer;

var background = {
  receive: function (id, callback) {
    id += '@ad';
    ipcRenderer.on(id, function (event, arg) {
      if (arg && arg.url === 'background.html') {
        callback(arg.data);
      }
    });
  },
  send: function (id, data) {
    id += '@ad';
    ipcRenderer.send(id, {
      url: 'add/index.html',
      data
    });
  }
};

var manifest = {
  folder: false,
  support: true
};
