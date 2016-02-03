'use strict';
var ipcRenderer = window.top.ipcRenderer;

var background = {
  receive: function (id, callback) {
    id += '@md';
    ipcRenderer.on(id, function (event, arg) {
      if (arg && arg.url === 'background.html') {
        callback(arg.data);
      }
    });
  },
  send: function (id, data) {
    id += '@md';
    ipcRenderer.send(id, {
      url: 'modify/index.html',
      data
    });
  }
};

background.receive('hi', function (e) {
  console.error(121212, e);
});
background.send('hi', 'hi from if.html');

console.error(2);
