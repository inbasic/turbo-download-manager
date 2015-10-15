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
      if (request.method === id && !sender.url) {
        callback(request.data);
      }
    });
  }
};
var manifest = {
  url: chrome.extension.getURL('./')
};
