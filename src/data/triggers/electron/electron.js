'use strict';

var background = { // jshint ignore:line
  send: (id, data) => window.top.listeners.background.forEach(function (c) {
    c({method: id + '@tr', data}, {url: 'triggers.html'});
  }),
  receive: (id, callback) => window.top.listeners.pagemod.push(function (request, sender) {
    if (request.method === id + '@tr' && sender.url.indexOf('background') !== -1) {
      callback(request.data);
    }
  })
};
