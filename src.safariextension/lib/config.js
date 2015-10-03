'use strict';

if (typeof require !== 'undefined') {
  var app = require('./firefox/firefox');
  var config = exports;
}

config.persist = (function () {
  let add;
  function updateAdd () {
    let json = app.storage.read('save-add-ui');
    if (json) {
      add = JSON.parse(json);
    }
  }
  app.once('load', function () {
    updateAdd();
    app.storage.on('save-add-ui', updateAdd);
  });

  return {
    get add () {
      return add;
    }
  };
})();

config.mwget = {
  percent: {
    'rate-total': 1, // seconds
    'rate-individual': 1 // seconds
  }
};

config.wget = {
  threads: 5,
  timeout: 30, // seconds,
  retrie: 100
};

config.icon = {
  timeout: 5 // seconds
};

config.welcome = {
  get version () {
    return app.storage.read('version');
  },
  set version (val) {
    app.storage.write('version', val);
  },
  timeout: 3,
  get show () {
    return app.storage.read('show') === 'false' ? false : true; // default is true
  },
  set show (val) {
    app.storage.write('show', val);
  }
};

// Complex get and set
config.get = function (name) {
  return name.split('.').reduce(function (p, c) {
    return p[c];
  }, config);
};
config.set = function (name, value) {
  function set(name, value, scope) {
    name = name.split('.');
    if (name.length > 1) {
      set.call((scope || this)[name.shift()], name.join('.'), value)
    }
    else {
      this[name[0]] = value;
    }
  }
  set(name, value, config);
};
