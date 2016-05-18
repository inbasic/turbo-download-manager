'use strict';

var background = { // jshint ignore:line
  send: (id, data) => window.top.listeners.background.forEach(function (c) {
    c({method: id + '@ab', data}, {url: 'about.html'});
  }),
  receive: (id, callback) => window.top.listeners.pagemod.push(function (request, sender) {
    if (request.method === id + '@ab' && sender.url.indexOf('background') !== -1) {
      callback(request.data);
    }
  })
};
