/* globals CryptoJS, app */
'use strict';

app.globals = {
  browser: navigator.userAgent.indexOf('OPR') === -1 ? 'chrome' : 'opera',
  extension: !!chrome.tabs
};

app.once('load', function () {
  var script = document.createElement('script');
  document.body.appendChild(script);
  script.src = 'lib/common.js';
});

app.Promise = Promise;
app.XMLHttpRequest = window.XMLHttpRequest;
app.EventEmitter = EventEmitter;
app.timer = window;
app.URL = window.URL;

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

app.canvas = (function (canvas) {
  return function () {
    return canvas;
  };
})(document.createElement('canvas'));

app.button = (function () {
  var onCommand;
  if (chrome.browserAction) {
    chrome.browserAction.onClicked.addListener(function () {
      if (onCommand) {
        onCommand();
      }
    });
  }
  return {
    onCommand: function (c) {
      onCommand = c;
    },
    set icon (path) { // jshint ignore: line
      if (chrome.browserAction) {
        chrome.browserAction.setIcon({path});
      }
      else {
        chrome.runtime.sendMessage(app.runtime.id, {cmd: 'setIcon',path});
      }
    },
    set label (title) { // jshint ignore: line
      if (chrome.browserAction) {
        chrome.browserAction.setTitle({title});
      }
      else {
        chrome.runtime.sendMessage(app.runtime.id, {cmd: 'setTitle', title});
      }
    },
    set badge (val) { // jshint ignore: line
      if (chrome.browserAction) {
        chrome.browserAction.setBadgeText({
          text: (val ? val : '') + ''
        });
      }
      else {
        chrome.runtime.sendMessage(app.runtime.id, {
          cmd: 'setBadgeText',
          text: (val ? val : '') + ''
        });
      }
    }
  };
})();

app.getURL = function (path) {
  return chrome.runtime.getURL('/data/' + path);
};

app.tab = {
  open: function (url, inBackground, inCurrent) {
    if (!chrome.tabs) {
      if (app.runtime.isInstalled) {
        chrome.runtime.sendMessage(app.runtime.id, {cmd: 'open-link', url, inBackground, inCurrent});
      }
      else {
        window.open(url);
      }
    }
    else {
      if (inCurrent) {
        chrome.tabs.update(null, {url});
      }
      else {
        chrome.tabs.create({url, active: typeof inBackground === 'undefined' ? true : !inBackground});
      }
    }
  },
  list: function () {
    if (chrome.tabs) {
      return new Promise(resolve => chrome.tabs.query({}, tabs => resolve(tabs)));
    }
    else {
      return Promise.resolve([]);
    }
  },
  reload: function (tab) {
    return new Promise(function (resolve) {
      chrome.tabs.reload(tab.id, {}, () => resolve(tab));
    });
  },
  activate: function (tab) {
    return new Promise(function (resolve) {
      chrome.tabs.update(tab.id, {
        active: true,
        selected: true
      }, () => resolve(tab));
    });
  }
};

app.menu = function (title, callback) {
  if (!chrome.contextMenus) {
    return;
  }
  chrome.contextMenus.create({
    'title': title,
    'contexts': ['link', 'image', 'video', 'audio'],
    'onclick': function (obj) {
      callback({
        url: obj.linkUrl || obj.srcUrl,
        referrer: obj.pageUrl
      });
    }
  });
};

app.notification = function (text) {
  chrome.notifications.create(null, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('./') + 'data/icons/48.png',
    title: 'Turbo Download Manager',
    message: text
  }, function () {});
};

app.version = function () {
  return chrome[chrome.runtime && chrome.runtime.getManifest ? 'runtime' : 'extension'].getManifest().version;
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
    send: function (id, data) {
      id += '@ui';
      chrome.runtime.sendMessage({method: id, data: data});
    },
    receive: function (id, callback) {
      id += '@ui';
      chrome.runtime.onMessage.addListener(function (message, sender) {
        if (id === message.method && sender.url !== document.location.href) {
          callback.call(sender.tab, message.data);
        }
      });
    }
  };
})();

// add
app.add = (function () {
  return {
    send: function (id, data) {
      id += '@ad';
      chrome.runtime.sendMessage({method: id, data: data});
    },
    receive: function (id, callback) {
      id += '@ad';
      chrome.runtime.onMessage.addListener(function (message, sender) {
        if (id === message.method && sender.url !== document.location.href) {
          callback.call(sender.tab, message.data);
        }
      });
    }
  };
})();

// info
app.info = (function () {
  return {
    send: function (id, data) {
      id += '@if';
      chrome.runtime.sendMessage({method: id, data: data});
    },
    receive: function (id, callback) {
      id += '@if';
      chrome.runtime.onMessage.addListener(function (message, sender) {
        if (id === message.method && sender.url !== document.location.href) {
          callback.call(sender.tab, message.data);
        }
      });
    }
  };
})();

if (app.globals.extension) {
  app.File = function (obj) { // {name, path, mime, length}
    var cache = {};
    return {
      open: function () {
        return Promise.resolve();
      },
      write: function (offset, content) {
        let view = new Uint8Array(content.length);
        for (let i = 0; i < content.length; i++) {
          view[i] = content.charCodeAt(i);
        }
        cache[offset] = cache[offset] || [];
        cache[offset].push(view.buffer);
        return Promise.resolve(true);
      },
      toBlob: (function () {
        let blob;
        function b () {
          let arr = [], tmp = [];
          for (let i in cache) {
            tmp.push(i);
          }
          tmp.sort(function (a, b) {
            return a - b;
          });
          tmp.forEach(function (i) {
            arr = arr.concat(cache[i + '']);
          });
          let _blob = new Blob(arr, {
            type: obj.mime
          });
          arr = [];
          cache = {};
          blob = _blob;
          return Promise.resolve(_blob);
        }
        return function () {
          if (blob) {
            return Promise.resolve(blob);
          }
          else {
            return b();
          }
        };
      })(),
      md5: function () {
        return this.toBlob()
        .then(function (blob) {
          return new Promise(function (resolve) {
            var tmp = new window.FileReader();
            tmp.readAsBinaryString(blob);
            tmp.onloadend = function () {
              resolve(CryptoJS.MD5(CryptoJS.enc.Latin1.parse(tmp.result)).toString());
            };
          });
        });
      },
      flush: function () {
        return this.toBlob()
        .then(function (blob) {
          window.saveAs(blob, obj.name);
          return blob.size;
        });
      },
      remove: function () {
        cache = {};
      },
      launch: function () {},
      reveal: function () {}
    };
  };
}
else {
  app.File = function (obj) { // {name, path, mime, length}
    window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
    let fileEntry, cache = [], postponed, length = 0;

    let tmp = {
      open: function () {
        let d = Promise.defer();
        navigator.webkitTemporaryStorage.requestQuota(obj.length, function (grantedBytes) {
          if (grantedBytes === obj.length) {
            window.requestFileSystem(
              window.TEMPORARY, obj.length, function (fs) {
                fs.root.getFile(
                  Math.floor(Math.random() * 16777215).toString(16),  // a unique name
                  {create: true, exclusive: false},
                  function (fe) {
                    fe.createWriter(function (fileWriter) {
                      fileWriter.onwrite = function () {
                        fileEntry = fe;
                        Promise.all(cache.map(o => tmp.write(o.offset, o.content))).then(function () {
                          cache = [];
                        }, (e) => d.reject(e));
                        d.resolve();
                      };
                      fileWriter.onerror = (e) => d.reject(e);
                      fileWriter.truncate(obj.length);
                    });
                  },
                  (e) => d.reject(e)
                );
              },
              (e) => d.reject(e)
            );
          }
          else {
            d.reject(new Error('cannot allocate space'));
          }
        });
        return d.promise;
      },
      write: function (offset, content) {
        let d = Promise.defer();
        if (!fileEntry) {
          cache.push({offset, content});
          d.resolve();
        }
        else {
          fileEntry.createWriter(function (fileWriter) {
            let view = new Uint8Array(content.length);
            for (let i = 0; i < content.length; i++) {
              view[i] = content.charCodeAt(i);
            }
            fileWriter.onerror = (e) => d.reject(e);
            fileWriter.onwrite = function (e) {
              length += e.loaded;
              d.resolve();
              if (postponed && length === obj.length) {
                postponed.resolve(tmp.md5());
              }
            };
            fileWriter.seek(offset);
            let blob = new Blob([view], {type: 'application/octet-stream'});
            fileWriter.write(blob);
          }, (e) => d.reject(e));
        }
        return d.promise;
      },
      md5: function () {
        let d = Promise.defer();
        if (fileEntry && length === obj.length) {
          fileEntry.file(function (file) {
            let reader = new FileReader();
            reader.onloadend = function () {
              d.resolve(CryptoJS.MD5(CryptoJS.enc.Latin1.parse(this.result)).toString());
            };
            reader.readAsBinaryString(file);
          }, (e) => d.reject(e));
        }
        else {
          postponed = d;
        }
        return d.promise;
      },
      flush: function () {
        let d = Promise.defer();
        fileEntry.file(function (file) {
          let link = document.createElement('a');
          link.download = obj.name;
          link.href = URL.createObjectURL(file);
          link.dispatchEvent(new MouseEvent('click'));
          window.setTimeout(function () {
            d.resolve();
          }, 5000);
        }, (e) => d.reject(e));
        return d.promise;
      },
      remove: function () {},
      launch: function () {},
      reveal: function () {}
    };
    return tmp;
  };
}
// webapp
app.runtime = (function () {
  if (chrome.app.runtime) {
    chrome.app.runtime.onLaunched.addListener(() => app.runtime.launch());
  }
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
