'use strict';

var background = { // jshint ignore:line
  send: (id, data) => window.top.listeners.background.forEach(function (c) {
    c({method: id + '@pr', data}, {url: 'preview.html'});
  }),
  receive: (id, callback) => window.top.listeners.pagemod.push(function (request, sender) {
    if (request.method === id + '@pr' && sender.url.indexOf('background') !== -1) {
      callback(request.data);
    }
  })
};
