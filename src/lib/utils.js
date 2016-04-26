'use strict';

if (typeof require !== 'undefined') {
  var app = require('./firefox/firefox');
  var utils = exports;
}
else {
  var utils = {};
}

(function () {
  // debounce
  utils.debounce = function (original, limit) {
    let id, wait = false;
    function rtn () {
      if (!wait) {
        app.timer.clearTimeout(id);
        wait = true;
        original.apply(this, arguments);
        id = app.timer.setTimeout(function () {
          wait = false;
        }, limit);
      }
    }
    rtn.now = function () {
      wait = false;
      rtn.apply(this, arguments);
    };
    return rtn;
  };
  // validate
  utils.validate = function (url) {
    try {
      let test = new app.URL(url);
      return !!test.host;
    }
    catch (e) {
      return false;
    }
  };
})();

utils.assign = function (obj, name, event, value) {
  let tmp = value;
  Object.defineProperty(obj, name, {
    get: function () {
      return tmp;
    },
    set: function (val) {
      if (val !== tmp) {
        tmp = val;
        event.emit(name, tmp);
      }
    }
  });
  return utils;
};

utils.EventEmitter = (function () {
  let EventEmitter = function () {
    this.listeners = {};
    this.onces = {};
  };
  EventEmitter.prototype.on = function (name, callback) {
    this.listeners[name] = this.listeners[name] || [];
    this.listeners[name].push(callback);
  };
  EventEmitter.prototype.once = function (name, callback) {
    this.onces[name] = this.onces[name] || [];
    this.onces[name].push(callback);
  };
  EventEmitter.prototype.emit = function (name) {
    let args = Array.prototype.slice.call(arguments);
    let tobeSent = args.splice(1);
    if (this.listeners[name]) {
      this.listeners[name].forEach(function (f) {
        try {
          f.apply(this, tobeSent);
        }
        catch (e) {
          console.error(e, new Error().stack);
        }
      });
    }
    if (this.onces[name]) {
      this.onces[name].forEach(function (f) {
        try {
          f.apply(this, tobeSent);
        }
        catch (e) {
          console.error(e);
        }
      });
      this.onces[name] = [];
    }
  };
  EventEmitter.prototype.removeListener = function (name, callback) {
    if (this.listeners[name]) {
      var index = this.listeners[name].indexOf(callback);
      if (index !== -1) {
        this.listeners[name].splice(index, 1);
      }
    }
  };
  EventEmitter.prototype.removeAllListeners = function () {
    this.listeners = {};
    this.onces = {};
  };
  return EventEmitter;
})();
