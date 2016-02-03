/* globals self */
'use strict';

var background = { // jshint ignore:line
  send: self.port.emit,
  receive: self.port.on
};

var manifest = { // jshint ignore:line
  folder: false,
  support: true
};
