'use strict';

var ipcRenderer = require('electron').ipcRenderer;

var background = {  // jshint ignore:line
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
ipcRenderer.on('_sound', (event, src) => {
  let audio = new Audio('../' + src);
  audio.play();
});
