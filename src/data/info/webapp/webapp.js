'use strict';

var background = {
  send: function (id, msg) {
    id += '@if';
    window.top.postMessage({id, msg}, '*');
  },
  receive: function (id, callback) {
    id += '@if';
    window.addEventListener('message', function (e) {
      if (e.data && e.data.id === id) {
        callback(e.data.msg);
      }
    }, false);
  }
};

var manifest = { // jshint ignore:line
  support: false
};
