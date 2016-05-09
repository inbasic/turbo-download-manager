'use strict';

var background = {  // jshint ignore:line
  receive: (id, callback) => window.top.register(id + '@md', callback),
  send: (id, data) => window.top.ipcRenderer.send(id + '@md', {
    url: 'modify/index.html',
    data
  })
};
