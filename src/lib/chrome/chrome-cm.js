/* globals CryptoJS, utils */
'use strict';

var app = new utils.EventEmitter();

app.globals = {
  browser: 'chrome',
  extension: false
};

if (!Promise.defer) {
  Promise.defer = function () {
    let deferred = {};
    let promise = new Promise(function (resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject  = reject;
    });
    deferred.promise = promise;
    return deferred;
  };
}
app.Promise = Promise;
app.XMLHttpRequest = window.XMLHttpRequest;
app.fetch = (url, props) => fetch(url, props);
app.EventEmitter = utils.EventEmitter;
app.timer = window;
app.URL = window.URL;

app.canvas = () => null;

app.storage = (function () {
  let objs = {};
  chrome.storage.local.get(null, function (o) {
    objs = o;
    app.emit('load');
  });
  return {
    read: (id) => (objs[id] || !isNaN(objs[id])) ? objs[id] + '' : objs[id],
    write: function (id, data) {
      objs[id] = data;
      var tmp = {};
      tmp[id] = data;
      chrome.storage.local.set(tmp, function () {});
    },
    on: (name, callback) => chrome.storage.onChanged.addListener(function (obj) {
      if (name in obj) {
        callback();
      }
    })
  };
})();

app.button = {
  onCommand: function () {},
  icon: null,
  label: null,
  badge: null
};

app.tab = {
  open: function () {},
  list: () => Promise.resolve([]),
  reload: () => Promise.resolve(),
  activate: () => Promise.resolve()
};

app.menu = function () {};

(function (cache) {
  let req = new XMLHttpRequest();
  req.open('GET', '../../data/assets/mime.json');
  req.responseType = 'json';
  req.onloadend = function () {
    cache = req.response || cache;
  };
  req.send();
  Object.defineProperty(app, 'mimes', {
    get: function () {
      return cache;
    }
  });
})({});

app.getURL = (path) => chrome.runtime.getURL('/data/' + path);

app.version = () => chrome[chrome.runtime && chrome.runtime.getManifest ? 'runtime' : 'extension'].getManifest().version;

app.platform = function () {
  let v1 = /Chrome\/[\d\.]*/.exec(navigator.userAgent);
  let v2 = /OPR\/[\d\.]*/.exec(navigator.userAgent);
  let version = v2 ? v2[0].replace('OPR/', 'OPR ') : v1[0].replace('Chrome/', 'Chrome ');
  return `${version} on ${navigator.platform}`;
};

// manager
app.manager = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({
      method: id + '@ui',
      data
    }),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@ui' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

// add
app.add = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({
      method: id + '@ad',
      data
    }),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@ad' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

// info
app.info = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({
      method: id + '@if',
      data
    }),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@if' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

// modify
app.modify = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({
      method: id + '@md',
      data
    }),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@md' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

// triggers
app.triggers = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({
      method: id + '@tr',
      data
    }),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@tr' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

// about
app.about = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({
      method: id + '@ab',
      data
    }),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@ab' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

app.disk = {
  browse: function () {
    return new Promise(function (resolve, reject) {
      let wins = chrome.app.window.getAll();
      if (wins && wins.length) {
        let win = wins[0].contentWindow;
        win.chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function (folder) {
          chrome.storage.local.set({
            folder: chrome.fileSystem.retainEntry(folder)
          });
          resolve(folder.name);
        });
      }
      else {
        reject();
      }
    });

  }
};
/* app.play */
app.play = (src) => {
  let audio = new Audio(chrome.runtime.getURL('/data/' + src));
  audio.play();
};
