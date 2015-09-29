/* globals chrome */
'use strict';

var background = {
  send: function (id, data) {
    chrome.runtime.sendMessage({method: id, data: data});
  },
  receive: function (id, callback) {
    chrome.runtime.onMessage.addListener(function (request) {
      if (request.method === id) {
        callback(request.data);
      }
    });
  }
};
var manifest = {
  url: chrome.extension.getURL('./')
};
