'use strict';

var app = app || require('./firefox/firefox');
var config = typeof exports === 'undefined' ? {} : exports;

config.defaults = {};

config.define = (function () {
  let cache = {};
  let types = {};

  return function (pref, value, setter) {
    let root = pref.split('.');
    let name = root.pop();
    types[pref] = typeof value;

    let d = root.reduce((p, c) => {
      if (p[c]) {
        return p[c];
      }
      p[c] = {};
      return p[c];
    }, config.defaults);
    d[name] = value;

    let obj = root.reduce((p, c) => {
      if (p[c]) {
        return p[c];
      }
      p[c] = {};
      return p[c];
    }, config);

    Object.defineProperty(obj, name, {
      get: function () {
        let value = cache[pref];
        if (value === undefined) {
          value = app.storage.read('pref.' + pref);
          if (value !== undefined) {
            if (types[pref] === 'number') {
              value = +value;
            }
            if (types[pref] === 'boolean') {
              value = value === 'false' ? false : true;
            }
          }
        }
        if (value === undefined) {
          try {
            value = pref.split('.').reduce((p, c) => p[c], config.defaults);
          }
          catch (e) {}
        }
        cache[pref] = value;
        return value;
      },
      set: function (value) {
        value = (setter || function (v) {
          return v;
        })(value);
        let type = typeof value;
        if (type !== types[pref]) {
          throw Error(`type does not match; ${type} !== ${types[pref]}`);
        }
        app.storage.write('pref.' + pref, value);
        cache[pref] = value;
      }
    });
  };
})();
config.defineInt = function (name, value, min, max) {
  function setter (value) {
    let tmp = Math.max(+value, min || 1);
    if (max) {
      tmp = Math.min(tmp, max);
    }
    return isNaN(tmp) ? value : tmp;
  }

  config.define(name, value, setter);
};
config.get = function (name) {
  return name.split('.').reduce((p, c) => p[c], config);
};

/* config.urls */
config.urls = {
  bug: 'https://github.com/inbasic/turbo-download-manager/',
  faq: 'http://add0n.com/turbo-download-manager.html',
  helper: 'https://chrome.google.com/webstore/detail/turbo-download-manager-he/gnaepfhefefonbijmhcmnfjnchlcbnfc',
  sourceforge: 'https://sourceforge.net/projects/turbo-download-manager/files/?source=navbar'
};

/* config.mwget */
config.defineInt('mwget.percent.rate-total', 1); //seconds
config.defineInt('mwget.percent.rate-individual', 1); //seconds

/* config.wget */
config.defineInt('wget.threads', 3); //int
config.defineInt('wget.timeout', 30, 10); // seconds
config.defineInt('wget.retries', 30); //int
config.defineInt('wget.update', 1); // second
config.defineInt('wget.pause', 500, 100); // milliseconds; called after a failed chunk
config.defineInt('wget.short-pause', 100); // milliseconds; called after a successful chuck
config.defineInt('wget.write-size', 200 * 1024, 1024); // bytes
config.defineInt('wget.min-segment-size', 50 * 1024, 1024); // bytes
config.defineInt('wget.max-segment-size', 100 * 1024 * 1024); // bytes
config.defineInt('wget.max-size-md5', 500 * 1024 * 1024, 500 * 1024 * 1024); // bytes
config.define('wget.directory', '');
config.define('wget.notice-download', true);

/* config.icon */
config.defineInt('icon.timeout', 5); // seconds

/* config.triggers */
config.define('triggers.pause.enabled', true);
config.defineInt('triggers.pause.value', 3, 1, 10); // int
config.define('triggers.start.enabled', false);
config.defineInt('triggers.start.value', 3, 1, 10); // int
config.define('triggers.success.enabled', false);
config.defineInt('triggers.success.value', 60, 10); // seconds
config.define('triggers.fail.enabled', false);
config.defineInt('triggers.fail.value', 3 * 60, 10); // seconds
config.define('triggers.play-single.enabled', false);
config.define('triggers.play-combined.enabled', true);

/* config.welcome */
config.define('welcome.version', '');
config.define('welcome.show', true);
config.welcome.timeout = 3;
