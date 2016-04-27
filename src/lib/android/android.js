/* globals utils, cordova */
'use strict';

var listeners = {
  background: [],
  pagemod: []
};
var pointers = {};

chrome.runtime.sendMessage = function (obj) {
  listeners.pagemod.forEach(function (c) {
    c(obj, {url: 'background.html'});
  });
};
chrome.runtime.onMessage = {
  addListener: function (c) {
    listeners.background.push(c);
  }
};
chrome.runtime.onMessageExternal = {
  addListener: function () {}
};

Promise.defer = Promise.defer || function () {
  let deferred = {};
  let promise = new Promise(function (resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject  = reject;
  });
  deferred.promise = promise;
  return deferred;
};

var app = new utils.EventEmitter();

app.globals = {
  browser: 'android',
  referrer: false
};

app.Promise = Promise;
app.XMLHttpRequest = window.XMLHttpRequest;
app.EventEmitter = utils.EventEmitter;
app.timer = window;
app.URL = window.URL;
app.fetch = function (url, props) {
  return fetch(url, props);
};

app.storage = (function () {
  var objs = {};
  chrome.storage.local.get(null, function (o) {
    objs = o;
    app.emit('load');
  });
  return {
    read: function (id) {
      return (objs[id] || !isNaN(objs[id])) ? objs[id] + '' : objs[id];
    },
    write: function (id, data) {
      objs[id] = data;
      var tmp = {};
      tmp[id] = data;
      chrome.storage.local.set(tmp, function () {});
    },
    on: function (name, callback) {
      chrome.storage.onChanged.addListener(function (obj) {
        if (name in obj) {
          callback();
        }
      });
    }
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

app.canvas = () => null;

app.button = {
  onCommand: function () {},
  set icon (path) {}, // jshint ignore: line
  set label (title) {}, // jshint ignore: line
  set badge (val) {} // jshint ignore: line
};

app.getURL = function (path) {
  return chrome.runtime.getURL('/data/' + path);
};

app.tab = {
  open: function (url) {
    window.open(url, '_system');
  },
  list: function () {
    return Promise.resolve([]);
  },
  reload: function () {
    return Promise.resolve();
  },
  activate: function () {
    return Promise.resolve();
  }
};

app.menu = function () {};

app.notification = (text) => window.plugins.toast.showLongCenter(text);

app.version = () => chrome[chrome.runtime && chrome.runtime.getManifest ? 'runtime' : 'extension'].getManifest().version;
app.platform = function () {
  let v1 = /Chrome\/[\d\.]*/.exec(navigator.userAgent);
  let v2 = /OPR\/[\d\.]*/.exec(navigator.userAgent);
  return (v2 ? v2[0].replace('OPR/', 'OPR ') : v1[0].replace('Chrome/', 'Chrome ') + ` & Cordova ${cordova.version}`);
};

app.OS = {
  clipboard: {
    get: function () {
      let d = Promise.defer();
      cordova.plugins.clipboard.paste((s) => d.resolve(s), () => d.resolve(''));
      return d.promise;
    }
  }
};

// manager
app.manager = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({method: id + '@ui', data}),
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
    send: (id, data) => chrome.runtime.sendMessage({method: id + '@ad', data}),
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
    send: (id, data) => chrome.runtime.sendMessage({method: id + '@if', data}),
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
    send: (id, data) => chrome.runtime.sendMessage({method: id + '@md', data}),
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
    send: (id, data) => chrome.runtime.sendMessage({method: id + '@tr', data}),
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
    send: (id, data) => chrome.runtime.sendMessage({method: id + '@ab', data}),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@ab' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

app.File = function (obj) { // {name, path, mime, length}
  window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
  let fileEntry, postponed, length = 0;

  let tmp = {
    open: function () {
      let d = Promise.defer();

      function allocate (fileEntry, start, length, success, fail) {
        fileEntry.createWriter(function (fileWriter) {
          fileWriter.onwrite = function () {
            fileEntry.file(function (file) {
              if (file.size === length + start) {
                success();
              }
              else {
                fail('Cannot allocate');
              }
            }, (e) => fail(e));
          };
          fileWriter.onerror = (e) => fail(e);
          let b = new pointers.manager.Blob([new Uint8Array(length)], {type: 'application/octet-stream'});
          fileWriter.seek(start);
          fileWriter.write(b);
        }, (e) => fail(e));
      }

      window.resolveLocalFileSystemURL(cordova.file.externalRootDirectory + 'Download', function (download) {
        download.getFile(
          Math.floor(Math.random() * 16777215).toString(16),  // a unique name
          {create: true, exclusive: false},
          function (fe) {
            fileEntry = fe;

            let start = 0;
            let size = 5 * 1024 * 1024;
            // Since there is no truncate function for fileWriter, we are allocating space with 5Mbyte write requests
            function doOne () {
              let a = Math.min(obj.length - start, size);
              if (a) {
                allocate(fe, start, a, function () {
                  start += a;
                  doOne();
                }, (e) => d.reject(e));
              }
              else {
                d.resolve();
              }
            }
            doOne();
          },
          (e) => d.reject(e)
        );
      }, (e) => d.reject(e));

      return d.promise;
    },
    write: function (offset, arr) {
      let d = Promise.defer();
      fileEntry.createWriter(function (fileWriter) {
        let blob = new pointers.manager.Blob(arr, {type: 'application/octet-stream'});
        arr = [];
        fileWriter.onerror = (e) => d.reject(e);
        fileWriter.onwrite = function (e) {
          length += blob.size; // length += e.loaded
          d.resolve();
          if (postponed && length === obj.length) {
            postponed.resolve();
          }
          blob = '';
        };
        fileWriter.seek(offset);
        let reader = new FileReader();
        reader.onloadend = function () {
          fileWriter.writeBinaryArray(reader.result);
        };
        reader.readAsBinaryString(blob);
      }, (e) => d.reject(e));
      return d.promise;
    },
    md5: function () {
      let d = Promise.defer();
      window.md5chksum.file(fileEntry, d.resolve, d.reject);
      return d.promise;
    },
    flush: function () {
      let d = Promise.defer();
      function copy (file, index) {
        let name = obj.name;
        if (index) {
          name = name.replace(/((\.[^\.]{1,3}){0,1}\.[^\.]+)$/, '-' + index + '$1');
        }
        window.resolveLocalFileSystemURL(cordova.file.externalRootDirectory + 'Download/' + name,
          () => copy(file, (index || 0) + 1),
          function () {
            fileEntry.getParent(function (dir) {
              fileEntry.moveTo(dir, name, () => d.resolve(name), e => d.reject(e))
            }, e => d.reject(e));
          }
        );
      }
      fileEntry.file(file => copy(file), (e) => d.reject(e));
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
  return tmp;
};

// webapp
chrome.app.runtime.onLaunched.addListener(function () {
  chrome.app.window.create('data/manager/index.html', {
    id: 'tdm-manager',
  });
});

// native downloader
app.download = function (obj) {
  window.open(obj.url, '_system');
  return Promise.resolve();
};

/*(function () {
  var admobid = {};
  if (/(android)/i.test(navigator.userAgent)) {
    admobid = {
      banner: 'ca-app-pub-8474379789882900/2597644121'
    };
  }
  if ('AdMob' in window) {
    AdMob.createBanner({
      adId: admobid.banner,
      position: AdMob.AD_POSITION.TOP_CENTER,
      autoShow: true,
      success: function () {},
      error: function () {
        console.error('failed to create banner');
      }
    });
  }
})();*/

app.startup = function () {};

app.play = (src) => {
  let audio = new Audio(chrome.runtime.getURL('/data/' + src));
  audio.play();
};

app.sandbox = function (url, options) {
  let d = Promise.defer(), id;
  let webview = cordova.InAppBrowser.open(url, '_blank', 'hidden=true');

  function destroy (url) {
    window.clearTimeout(id);
    d[url ? 'resolve' : 'reject'](url);
    webview.close();
  }

  id = window.setTimeout(destroy, options['no-response'], null);
  webview.addEventListener('loadstop', function (e) {
    if (e.url !== url) {
      destroy(e.url);
    }
  });
  return d.promise;
};
