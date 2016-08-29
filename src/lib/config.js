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
      enumerable: true,
      get: function () {
        let value = cache[pref];
        if (value === undefined) {
          value = app.storage.read('pref.' + pref);
          if (value !== undefined) {
            if (types[pref] === 'number') {
              value = +value;
            }
            if (types[pref] === 'boolean') {
              value = value === 'false' || value === false ? false : true;
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
config.reset = function (pref) {
  let value = pref.split('.').reduce((p, c) => p[c], config.defaults);
  config.set(pref, value);
};
config.set = function (pref, value) {
  let root = pref.split('.');
  let name = root.pop();
  let obj = root.reduce((p, c) => {
    if (p[c]) {
      return p[c];
    }
    p[c] = {};
    return p[c];
  }, config);
  obj[name] = value;
};
config.list = function () {
  let list = [];
  function step (object, prefix) {
    Object.keys(object)
    .filter((key) => object[key] !== null)
    .forEach(function (key) {
      let pr = prefix ? prefix + '.' : '';
      if (typeof object[key] === 'object') {
        step(object[key], pr + key);
      }
      else {
        list.push({
          name: pr + key,
          value: object[key],
          type: typeof object[key],
          title: config.titles[pr + key] || '-'
        });
      }
    });
    return list;
  }
  return step(config);
};

/* config.titles */
config.titles = {
  'wget.threads': 'number of concurrent threads for each job',
  'wget.timeout': 'the number of seconds a request can take before automatically being terminated',
  'wget.retries': 'total number of acceptable retries before a job status changed to paused',
  'wget.update': 'the number of seconds for each job to report changes',
  'wget.write-size': 'minimum number of bytes for triggering a disk write request',
  'wget.min-segment-size': 'the minimum acceptable size in bytes during thread creation',
  'wget.max-segment-size': 'the maximum acceptable size in bytes during thread creation',
  'wget.max-size-md5': 'do not calculate MD5 hash if file size is greater than (in bytes)',
  'icon.timeout': 'the number of seconds for the badge icon to display error or success (firefox, chrome, opera only)',
  'welcome.show': 'display FAQs page on upgrades',
  'manager.launch-if-done': 'open downloaded file with an external application (instead of using preview window) (firefox, android, electron only)',
  'electron.exit-on-close': 'exit the downloader if close button is pressed (electron only)',
  'electron.user-agent': 'overwrite the default user-agent (electron only)',
  'electron.update': 'notify user about the new versions. Acceptable values: release or prerelease (electron only)',
  'preview.external.image.path': 'executable path for previewing image files (firefox, electron only)',
  'preview.external.video.path': 'executable path for previewing video files (firefox, electron only)',
  'preview.external.audio.path': 'executable path for previewing audio files (firefox, electron only)',
  'preview.external.image.args': 'pass these extra arguments to the executable (firefox, electron only)',
  'preview.external.video.args': 'pass these extra arguments to the executable (firefox, electron only)',
  'preview.external.audio.args': 'pass these extra arguments to the executable (firefox, electron only)',
  'network.proxy-server': 'socks5://host:port (electron, android only)'
};

/* config.urls */
config.urls = {
  bug: 'https://github.com/inbasic/turbo-download-manager/',
  faq: 'http://add0n.com/turbo-download-manager.html',
  helper: 'https://chrome.google.com/webstore/detail/turbo-download-manager-he/gnaepfhefefonbijmhcmnfjnchlcbnfc',
  sourceforge: 'https://sourceforge.net/projects/turbo-download-manager/files/?source=navbar',
  releases: 'https://github.com/inbasic/turbo-download-manager/releases/',
  api: {
    latest: 'https://api.github.com/repos/inbasic/turbo-download-manager/releases/latest',
    list: 'https://api.github.com/repos/inbasic/turbo-download-manager/releases'
  }
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
config.defineInt('wget.max-segment-size', 100 * 1024 * 1024, 100 * 1024); // bytes
config.defineInt('wget.max-size-md5', 500 * 1024 * 1024, 1, 500 * 1024 * 1024); // bytes
config.define('wget.directory', '');
config.define('wget.notice-download', true);
config.define('wget.pause-on-exists', true);

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

/* config.manager */
config.define('manager.launch-if-done', true);

/* config.electron */
config.define('electron.exit-on-close', true);
config.define('electron.user-agent', '');
config.define('electron.update', 'release', function (v) {
  if (v === 'release' || v === 'prerelease') {
    return v;
  }
  return 'release';
});

/* config.preview */
config.define('preview.external.image.path', '');
config.define('preview.external.image.args', '');
config.define('preview.external.audio.path', '');
config.define('preview.external.audio.args', '');
config.define('preview.external.video.path', '');
config.define('preview.external.video.args', '');

/* network */
config.define('network.proxy-server', '', function (proxy) { // example: socks5://127.0.0.1:9999; electron only; for changing socks proxy a restart is required
  if (proxy) {
    if (/.\:\d+$/.test(proxy)) {
      return proxy;
    }
    app.notification('Format: socks5://host:port');
  }
  return '';
});

/* config.session */
config.defineInt('session.init', 2, 1); // seconds
config.defineInt('session.id', 1, 1); // int
config.defineInt('session.expire.completed', 10, 1); // delete completed items older than n days old
config.defineInt('session.expire.failed', 10, 1); // delete failed items older than n days old
config.defineInt('session.version', 1, 1); // int
config.define('session.name', 'dexie');
