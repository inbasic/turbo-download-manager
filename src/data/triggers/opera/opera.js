/* globals chrome */
'use strict';

var background = { // jshint ignore:line
  send: (id, data) => chrome.runtime.sendMessage({
    method: id + '@tr',
    data
  }),
  receive: (id, callback) => chrome.runtime.onMessage.addListener(function (request, sender) {
    if (request.method === id + '@tr' && (!sender.url || sender.url.indexOf('background') !== -1)) {
      callback(request.data);
    }
  })
};
