'use strict';

var ipcRenderer = require('electron').ipcRenderer;

var background = {
  receive: function (id, callback) {
    id += '@ui';
    ipcRenderer.on(id, function (event, arg) {
      if (arg && arg.url === 'background.html') {
        callback(arg.data);
      }
    });
  },
  send: function (id, data) {
    id += '@ui';
    ipcRenderer.send(id, {
      url: 'manager/index.html',
      data
    });
  }
};
// internals
ipcRenderer.on('_notification', function (event, arg) {
  new Notification('Turbo Download Manager', {
    body: arg,
    icon: '../icons/128.png'
  });
});
