'use strict';

var EventEmitter = (function () {
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
    var args = Array.prototype.slice.call(arguments);
    var tobeSent = args.splice(1);
    if (this.listeners[name]) {
      this.listeners[name].forEach(f => f.apply(this, tobeSent));
    }
    if (this.onces[name]) {
      this.onces[name].forEach(f => f.apply(this, tobeSent));
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

var app = new EventEmitter();
var utils = {};
var icon = {};
var wget = {};
var mwget = {};
var config = {};
