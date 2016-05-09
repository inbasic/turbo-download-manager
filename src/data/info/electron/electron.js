'use strict';

var background = {  // jshint ignore:line
  receive: (id, callback) => window.top.register(id + '@if', callback),
  send: (id, data) => window.top.ipcRenderer.send(id + '@if', {
    url: 'info/index.html',
    data
  })
};

var manifest = { // jshint ignore:line
  support: true
};
