/* globals chrome */
'use strict';

var background = { // jshint ignore:line
  send: (id, data) => chrome.runtime.sendMessage({
    method: id + '@lg',
    data
  }),
  receive: (id, callback) => chrome.runtime.onMessage.addListener(function (request, sender) {
    if (request.method === id + '@lg' && (!sender.url || sender.url.indexOf('background') !== -1)) {
      callback(request.data);
    }
  })
};
