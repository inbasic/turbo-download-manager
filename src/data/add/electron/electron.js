'use strict';

var background = { // jshint ignore:line
  send: (id, data) => window.top.listeners.background.forEach(function (c) {
    c({method: id + '@ad', data}, {url: 'add.html'});
  }),
  receive: (id, callback) => window.top.listeners.pagemod.push(function (request, sender) {
    if (request.method === id + '@ad' && sender.url.indexOf('background') !== -1) {
      callback(request.data);
    }
  })
};

var manifest = { // jshint ignore:line
  folder: false,
  support: true,
  sandbox: true,
  referrer: false
};
