'use strict';

var background = {  // jshint ignore:line
  receive: (id, callback) => window.top.register(id + '@ex', callback),
  send: (id, data) => window.top.ipcRenderer.send(id + '@ex', {
    url: 'extract/index.html',
    data
  })
};

var manifest = { // jshint ignore:line
  iframe: 'webview'
};
