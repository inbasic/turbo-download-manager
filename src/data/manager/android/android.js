/* globals chrome */
'use strict';

var sendMessage = function (obj, url) {
  chrome.runtime.getBackgroundPage(function (b) {
    b.listeners.background.forEach(function (c) {
      c(obj, {url: url || 'manager.html'});
    });
  });
};
var addListener = function (c) {
  chrome.runtime.getBackgroundPage(function (b) {
    b.listeners.pagemod.push(c);
  });
};

chrome.runtime.getBackgroundPage(function (b) {
  b.listeners.pagemod.push(function (request) {
    if (request.method && request.method.indexOf('@ui') === -1) {
      [].forEach.call(document.querySelectorAll('iframe'), function (iframe) {
        iframe.contentWindow.postMessage(request, '*');
      });
    }
  });
});
window.addEventListener('message', function (e) {
  if (e.source === e.target) {
    return;
  }
  sendMessage(e.data, 'unknown.html');
});

var background = { // jshint ignore:line
  send: (id, data) => sendMessage({
    method: id + '@ui',
    data
  }),
  receive: (id, callback) => addListener(function (request, sender) {
    if (request.method === id + '@ui' && (!sender.url || sender.url.indexOf('background') !== -1)) {
      callback(request.data);
    }
  })
};
// access manager window from background
chrome.runtime.getBackgroundPage(function (b) {
  b.pointers.manager = window;
});
