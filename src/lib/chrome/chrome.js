/* globals CryptoJS, utils */
'use strict';

var app = new utils.EventEmitter();

app.globals = {
  browser: chrome.tabs ? 'opera' : 'chrome',
  extension: !!chrome.tabs
};

app.once('load', function () {
  var script = document.createElement('script');
  document.body.appendChild(script);
  script.src = 'lib/common.js';
});

app.Promise = Promise;
app.XMLHttpRequest = window.XMLHttpRequest;
app.fetch = (url, props) => fetch(url, props);
app.EventEmitter = utils.EventEmitter;
app.timer = window;
app.URL = window.URL;

app.canvas = () => document.createElement('canvas');

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

app.getURL = (path) => chrome.runtime.getURL('/data/' + path);

app.tab = {
  open: function (url, inBackground, inCurrent) {
    if (!chrome.tabs) {
      chrome.browser.openTab({url});
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

app.menu = function (title, ...items) {
  if (!chrome.contextMenus) {
    return;
  }
  items.forEach(function (arr) {
    chrome.contextMenus.create({
      'title': arr[0],
      'contexts': ['link', 'image', 'video', 'audio'],
      'onclick': (obj) => arr[1]({
        url: obj.srcUrl || obj.linkUrl,
        referrer: obj.pageUrl
      })
    });
  });
};

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
  return v2 ? v2[0].replace('OPR/', 'OPR ') : v1[0].replace('Chrome/', 'Chrome ');
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

if (app.globals.extension) {
  app.File = function (obj) { // {name, path, mime, length}
    var cache = {};
    var toBlob = (function () {
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
    })();

    return {
      open: function () {
        return Promise.resolve();
      },
      write: function (offset, content) {
        cache[offset] = cache[offset] || [];
        content.forEach(view => cache[offset].push(view.buffer));
        return Promise.resolve(true);
      },
      md5: function () {
        if (obj.length > 50 * 1024 * 1024) {
          return new Promise.resolve('MD5 calculation is skipped');
        }
        return toBlob()
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
        return toBlob()
        .then(function (blob) {
          let link = document.createElement('a');
          link.download = obj.name;
          link.href = URL.createObjectURL(blob);
          link.dispatchEvent(new MouseEvent('click'));
          return blob.size;
        });
      },
      remove: function () {
        cache = {};
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
                        Promise.all(cache.map(o => tmp.write(o.offset, o.arr))).then(function () {
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
      write: function (offset, arr) {
        let d = Promise.defer();
        if (!fileEntry) {
          cache.push({offset, arr});
          d.resolve();
        }
        else {
          fileEntry.createWriter(function (fileWriter) {
            let blob = new Blob(arr, {type: 'application/octet-stream'});
            arr = [];
            fileWriter.onerror = (e) => d.reject(e);
            fileWriter.onwrite = function (e) {
              length += blob.size; //length += e.loaded; bug #17
              d.resolve();
              if (postponed && length === obj.length) {
                postponed.resolve(tmp.md5());
              }
              blob = '';
            };
            fileWriter.seek(offset);
            fileWriter.write(blob);
          }, (e) => d.reject(e));
        }
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

        function copy (folder, index) {
          let name = obj.name;
          if (index) {
            name = name.replace(/((\.[^\.]{1,3}){0,1}\.[^\.]+)$/, '-' + index + '$1');
          }
          folder.getFile(name, {create: true, exclusive: true}, function () {
            fileEntry.moveTo(folder, name, () => d.resolve, (e) => d.reject(e));
            d.resolve();
          }, function () {
            copy(folder, (index || 0) + 1);
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

        chrome.storage.local.get(null, function (storage) {
          if (storage.folder && storage['add-directory']) {
            try {
              chrome.fileSystem.restoreEntry(storage.folder, function (folder) {
                if (folder) {
                  copy(folder);
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
}

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

// native downloader
app.download = function (obj) {
  if (chrome.downloads) {
    chrome.downloads.download({
      url: obj.url,
      filename: obj.name
    });
  }
  else {
    var a = document.createElement('a');
    a.href = obj.url;
    a.download = obj.name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
  }
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
