'use strict';

var background = { // jshint ignore:line
  send: (id, data) => window.top.listeners.background.forEach(function (c) {
    c({method: id + '@ui', data}, {url: 'manager.html'});
  }),
  receive: (id, callback) => window.top.listeners.pagemod.push(function (request, sender) {
    if (request.method === id + '@ui' && sender.url.indexOf('background') !== -1) {
      callback(request.data);
    }
  })
};

background.receive('electron:update', (obj) => {
  window.confirm(obj.title, () => background.send('cmd', Object.assign(obj, {
    cmd: 'download'
  })));
});

var manifest = { // jshint ignore:line
  developer: true,
  helper: false
};
