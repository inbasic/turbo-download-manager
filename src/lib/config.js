'use strict';

var app = app || require('./firefox/firefox');
var config = typeof exports === 'undefined' ? {} : exports;

config.urls = {
  bug: 'https://github.com/inbasic/turbo-download-manager/',
  faq: 'http://add0n.com/turbo-download-manager.html',
  helper: 'https://chrome.google.com/webstore/detail/turbo-download-manager-he/gnaepfhefefonbijmhcmnfjnchlcbnfc',
  sourceforge: 'https://sourceforge.net/projects/turbo-download-manager/files/?source=navbar'
};

config.mwget = {
  percent: {
    'rate-total': 1, // seconds
    'rate-individual': 1 // seconds
  }
};

config.wget = {
  'threads': 3, // int
  'timeout': 30, // seconds,
  'retries': 30, // int
  'update': 1, // second
  'pause': 500, // milliseconds; called after a failed chunk
  'short-pause': 10, // milliseconds; called after a successful chuck
  'write-size': 200 * 1024, // bytes
  'min-segment-size': 50 * 1024, // bytes
  'max-segment-size': 100 * 1024 * 1024, // bytes
  'max-size-md5': 500 * 1024 * 1024 // bytes
};

config.icon = {
  timeout: 5 // seconds
};

config.triggers = {
  pause: {
    get enabled () {
      return app.storage.read('triggers-pause-disabled') === 'false' ? false : true;
    },
    set enabled (val) {
      app.storage.write('triggers-pause-disabled', val);
    },
    get value () {
      return +app.storage.read('triggers-pause-value') || 3;
    },
    set value (val) {
      val = Math.max(val, 1);
      val = Math.min(val, 10);
      app.storage.write('triggers-pause-value', val);
    }
  },
  start: {
    get enabled () {
      return app.storage.read('triggers-start-disabled') === 'true' ? true : false;
    },
    set enabled (val) {
      app.storage.write('triggers-start-disabled', val);
    },
    get value () {
      return +app.storage.read('triggers-start-value') || 3;
    },
    set value (val) {
      val = Math.max(val, 1);
      val = Math.min(val, 10);
      app.storage.write('triggers-start-value', val);
    }
  },
  success: {
    get enabled () {
      return app.storage.read('triggers-success-disabled') === 'true' ? true : false;
    },
    set enabled (val) {
      app.storage.write('triggers-success-disabled', val);
    },
    get value () {
      return +app.storage.read('triggers-success-value') || 60;
    },
    set value (val) {
      val = Math.max(val, 10);
      app.storage.write('triggers-success-value', val);
    }
  },
  fail: {
    get enabled () {
      return app.storage.read('triggers-fail-disabled') === 'true' ? true : false;
    },
    set enabled (val) {
      app.storage.write('triggers-fail-disabled', val);
    },
    get value () {
      return +app.storage.read('triggers-fail-value') || 3 * 60;
    },
    set value (val) {
      val = Math.max(val, 10);
      app.storage.write('triggers-fail-value', val);
    }
  },
  'play-single': {
    get enabled () {
      return app.storage.read('triggers-play-single-disabled') === 'true' ? true : false;
    },
    set enabled (val) {
      app.storage.write('triggers-play-single-disabled', val);
    }
  },
  'play-combined': {
    get enabled () {
      return app.storage.read('triggers-play-combined-disabled') === 'false' ? false : true;
    },
    set enabled (val) {
      app.storage.write('triggers-play-combined-disabled', val);
    }
  },
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
