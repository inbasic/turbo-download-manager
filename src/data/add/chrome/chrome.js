/* globals chrome */
'use strict';

var background = {
  send: function (id, data) {
    id += '@ad';
    chrome.runtime.sendMessage({method: id, data: data});
  },
  receive: function (id, callback) {
    id += '@ad';
    chrome.runtime.onMessage.addListener(function (request, sender) {
      if (request.method === id && (!sender.url || sender.url.indexOf('background') !== -1)) {
        callback(request.data);
      }
    });
  }
};
var manifest = {
  folder: chrome.tabs ? false : true, // only supported for apps
  support: chrome.tabs ? false : true
};
