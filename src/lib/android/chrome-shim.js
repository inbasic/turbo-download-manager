'use strict';
var chrome = {};

chrome.storage = {
  local: {
    get: (pref, callback) => callback()
  }
};

var listeners = {
  background: [],
  pagemod: []
};

chrome.runtime = {
  getURL: (path) => '../..' + path,
  sendMessage: function (obj) {
    listeners.pagemod.forEach(function (c) {
      c(obj, {url: 'background.html'});
    });
  },
  onMessage: {
    addListener: function (c) {
      listeners.background.push(c);
    }
  },
  onMessageExternal: {
    addListener: function () {}
  }
};
