'use strict';

var background = { // jshint ignore:line
  send: (id, data) => window.top.listeners.background.forEach(function (c) {
    c({method: id + '@md', data}, {url: 'modify.html'});
  }),
  receive: (id, callback) => window.top.listeners.pagemod.push(function (request, sender) {
    if (request.method === id + '@md' && sender.url.indexOf('background') !== -1) {
      callback(request.data);
    }
  })
};
