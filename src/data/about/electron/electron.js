'use strict';

var background = {  // jshint ignore:line
  receive: (id, callback) => window.top.register(id + '@ab', callback),
  send: (id, data) => window.top.ipcRenderer.send(id + '@ab', {
    url: 'about/index.html',
    data
  })
};
