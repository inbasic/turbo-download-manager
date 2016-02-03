'use strict';

var ipcRenderer = require('electron').ipcRenderer;

var background = {
  receive: (id, callback) => ipcRenderer.on(id + '@ui', function (event, arg) {
    if (arg && arg.url === 'background.html') {
      callback(arg.data);
    }
  }),
  send: (id, data) => ipcRenderer.send(id + '@ui', {
    url: 'manager/index.html',
    data
  })
};
// internals
ipcRenderer.on('_notification', (event, body) => new Notification('Turbo Download Manager', {
  body,
  icon: '../icons/128.png'
}));
