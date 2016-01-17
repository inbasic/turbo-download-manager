'use strict';

var listeners = [];

var addListener = function (c) {
  listeners.push(c);
};
var sendMessage = function (obj) {
  window.top.postMessage(obj, '*');
};
window.addEventListener('message', function (e) {
  if (e.source === e.target) {
    return;
  }
  listeners.forEach(function (c) {
    c(e.data, {url: 'background.html'});
  });
});

var background = {
  send: function send (id, data) {
    id += '@md';
    sendMessage({ method: id, data: data });
  },
  receive: function receive (id, callback) {
    id += '@md';
    addListener(function (request, sender) {
      if (request.method === id && (!sender.url || sender.url.indexOf('background') !== -1)) {
        callback(request.data);
      }
    });
  }
};

var manifest = {
  support: false
};
