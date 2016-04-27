/* globals CryptoJS, utils */
'use strict';

var app = new utils.EventEmitter();

app.globals = {
  browser: 'chrome',
  extension: false
};

app.once('load', function () {
  let script = document.createElement('script');
  document.body.appendChild(script);
  script.src = 'lib/common.js';
});

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

app.button = {
  onCommand: function () {},
  set icon (path) { // jshint ignore: line
    chrome.runtime.sendMessage(app.runtime.id, {cmd: 'setIcon', path});
  },
  set label (title) { // jshint ignore: line
    chrome.runtime.sendMessage(app.runtime.id, {cmd: 'setTitle', title});
  },
  set badge (val) { // jshint ignore: line
    chrome.runtime.sendMessage(app.runtime.id, {
      cmd: 'setBadgeText',
      text: (val ? val : '') + ''
    });
  }
};

app.getURL = (path) => chrome.runtime.getURL('/data/' + path);

app.tab = {
  open: (url) => chrome.browser.openTab({url}),
  list: () => Promise.resolve([]),
  reload: function () {},
  activate: function () {}
};

app.menu = function () {};

app.notification = (text) => chrome.notifications.create(null, {
  type: 'basic',
  iconUrl: 'data/icons/48.png',
  title: 'Turbo Download Manager',
  message: text
});

app.version = () => chrome[chrome.runtime && chrome.runtime.getManifest ? 'runtime' : 'extension'].getManifest().version;

app.platform = function () {
  let v1 = /Chrome\/[\d\.]*/.exec(navigator.userAgent);
  let v2 = /OPR\/[\d\.]*/.exec(navigator.userAgent);
  let version = v2 ? v2[0].replace('OPR/', 'OPR ') : v1[0].replace('Chrome/', 'Chrome ');
  return `${version} on ${navigator.platform}`;
};

app.OS = (function (clipboard) {
  document.body.appendChild(clipboard);
  return {
    clipboard: {
      get: function () {
        let result = '';
        clipboard.value = '';
        clipboard.select();
        if (document.execCommand('paste')) {
          result = clipboard.value;
        }
        return Promise.resolve(result);
      }
    }
  };
})(document.createElement('textarea'));

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

app.File = function (obj) { // {name, path, mime, length}
  window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
  let rootEntry, fileEntry, postponed, length = 0;
  let access = false;

  return {
    open: function () {
      let d = Promise.defer();

      function final () {
        rootEntry.getFile(
          Math.floor(Math.random() * 16777215).toString(16),  // a unique name
          {create: true, exclusive: false},
          function (fe) {
            fe.createWriter(function (fileWriter) {
              fileWriter.onwrite = function () {
                fileEntry = fe;
                d.resolve();
              };
              fileWriter.onerror = (e) => d.reject(e);
              fileWriter.truncate(obj.length);
            });
          },
          (e) => d.reject(e)
        );
      }

      function alternative () {
        navigator.webkitTemporaryStorage.requestQuota(obj.length, function (grantedBytes) {
          if (grantedBytes === obj.length) {
            window.requestFileSystem(
              window.TEMPORARY, obj.length, function (fs) {
                rootEntry = fs.root;
                final();
              },
              (e) => d.reject(e)
            );
          }
          else {
            d.reject(new Error('cannot allocate space'));
          }
        });
      }

      chrome.storage.local.get(null, function (storage) {
        if (storage.folder && storage['add-directory']) {
          try {
            chrome.fileSystem.restoreEntry(storage.folder, function (root) {
              if (root) {
                access = true;
                rootEntry = root;
                final();
              }
              else {
                alternative();
              }
            });
          }
          catch (e) {
            alternative();
          }
        }
        else {
          alternative();
        }
      });

      return d.promise;
    },
    write: function (offset, arr) {
      let d = Promise.defer();
      fileEntry.createWriter(function (fileWriter) {
        let blob = new Blob(arr, {type: 'application/octet-stream'});
        arr = [];
        fileWriter.onerror = (e) => d.reject(e);
        fileWriter.onwrite = function (e) {
          length += blob.size; //length += e.loaded; bug #17
          d.resolve();
          if (postponed && length === obj.length) {
            postponed.resolve();
          }
          blob = '';
        };
        fileWriter.seek(offset);
        fileWriter.write(blob);
      }, (e) => d.reject(e));
      return d.promise;
    },
    md5: function () {
      let d = Promise.defer();
      if (fileEntry && length === obj.length) {
        if (obj.length > 50 * 1024 * 1024) {
          d.resolve('MD5 calculation is skipped');
        }
        else {
          fileEntry.file(function (file) {
            let reader = new FileReader();
            reader.onloadend = function () {
              d.resolve(CryptoJS.MD5(CryptoJS.enc.Latin1.parse(this.result)).toString());
            };
            reader.readAsBinaryString(file);
          }, (e) => d.reject(e));
        }
      }
      else {
        postponed = d;
      }
      return d.promise;
    },
    flush: function () {
      let d = Promise.defer();

      function copy (index) {
        let name = obj.name;
        if (index) {
          name = name.replace(/((\.[^\.]{1,3}){0,1}\.[^\.]+)$/, '-' + index + '$1');
        }
        rootEntry.getFile(name, {create: true, exclusive: true}, function () {
          fileEntry.moveTo(rootEntry, name, () => d.resolve, (e) => d.reject(e));
          d.resolve(name);
        }, function () {
          copy((index || 0) + 1);
        });
      }

      function alternative () {
        fileEntry.file(function (file) {
          let link = document.createElement('a');
          link.download = obj.name;
          link.href = URL.createObjectURL(file);
          link.dispatchEvent(new MouseEvent('click'));
          window.setTimeout(function () {
            d.resolve();
            link = null;
          }, 5000);
        }, (e) => d.reject(e));
      }
      if (access) {
        copy();
      }
      else {
        alternative();
      }
      return d.promise;
    },
    remove: function () {
      let d = Promise.defer();
      if (fileEntry) {
        fileEntry.remove(() => d.resolve(), (e) => d.reject(e));
      }
      else {
        d.resolve();
      }
      return d.promise;
    },
    launch: function () {},
    reveal: function () {},
    rename: function (name) {
      if (name) {
        obj.name = name || obj.name;
        return Promise.resolve();
      }
      else {
        return Promise.reject();
      }
    }
  };
};

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

app.runtime = (function () {
  chrome.app.runtime.onLaunched.addListener(() => app.runtime.launch());
  let isInstalled = false;
  return {
    id: 'gnaepfhefefonbijmhcmnfjnchlcbnfc',
    get isInstalled () {
      return isInstalled;
    },
    set isInstalled (val) {
      isInstalled = val;
    },
    launch: function () {
      chrome.app.window.create('data/manager/index.html', {
        id: 'tdm-manager',
        bounds: {
          width: 800,
          height: 800
        }
      });
    }
  };
})();
chrome.runtime.sendMessage(app.runtime.id, app.version());

// communication
chrome.runtime.onMessageExternal.addListener(function (request, sender) {
  if (sender.id !== app.runtime.id) {
    return;
  }
  app.runtime.isInstalled = true;
  if (request.cmd === 'version') {
    chrome.runtime.sendMessage(app.runtime.id, app.version());
  }
  if (request.cmd === 'download') {
    app.emit('download', request);
  }
  if (request.cmd === 'open-manager') {
    app.runtime.launch();
  }
});
chrome.runtime.sendMessage(app.runtime.id, {cmd: 'version'});

// native downloader
app.download = function (obj) {
  let a = document.createElement('a');
  a.href = obj.url;
  a.download = obj.name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
};

app.startup = (function () {
  let loadReason, callback;
  function check () {
    if (loadReason === 'startup' || loadReason === 'install') {
      if (callback) {
        callback();
      }
    }
  }
  chrome.runtime.onInstalled.addListener(function (details) {
    loadReason = details.reason;
    check();
  });
  chrome.runtime.onStartup.addListener(function () {
    loadReason = 'startup';
    check();
  });
  return function (c) {
    callback = c;
    check();
  };
})();

app.play = (src) => {
  let audio = new Audio(chrome.runtime.getURL('/data/' + src));
  audio.play();
};

app.sandbox = function (url, options) {
  let d = Promise.defer();
  let webview = document.createElement('webview');
  document.body.appendChild(webview);

  function destroy () {
    if (webview) {
      webview.parentNode.removeChild(webview);
      webview = null;
    }
  }

  let id = window.setTimeout(d.reject, options['no-response'], null);
  webview.addEventListener('permissionrequest', function (e) {
    if (e.permission === 'download') {
      window.clearTimeout(id);
      destroy();
      d.resolve(e.request.url);
      e.request.deny();
    }
  });
  webview.src = url;

  return d.promise;
};
