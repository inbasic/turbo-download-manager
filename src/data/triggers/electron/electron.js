'use strict';

var background = {  // jshint ignore:line
  receive: (id, callback) => window.top.register(id + '@tr', callback),
  send: (id, data) => window.top.ipcRenderer.send(id + '@tr', {
    url: 'triggers/index.html',
    data
  })
};
