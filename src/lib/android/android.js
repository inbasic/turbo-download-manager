/* globals utils, CryptoJS, FileTransfer, AdMob, cordova */
'use strict';

var listeners = {
  background: [],
  pagemod: []
};
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

if (!Object.assign) {
  Object.defineProperty(Object, 'assign', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function (target) {
      if (target === undefined || target === null) {
        throw new TypeError('Cannot convert first argument to object');
      }

      var to = Object(target);
      for (var i = 1; i < arguments.length; i++) {
        var nextSource = arguments[i];
        if (nextSource === undefined || nextSource === null) {
          continue;
        }
        nextSource = Object(nextSource);

        var keysArray = Object.keys(nextSource);
        for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
          var nextKey = keysArray[nextIndex];
          var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
          if (desc !== undefined && desc.enumerable) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
      return to;
    }
  });
}
if (!Array.from) {
  Array.from = (function () {
    var toStr = Object.prototype.toString;
    var isCallable = function (fn) {
      return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
    };
    var toInteger = function (value) {
      var number = Number(value);
      if (isNaN(number)) { return 0; }
      if (number === 0 || !isFinite(number)) { return number; }
      return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
    };
    var maxSafeInteger = Math.pow(2, 53) - 1;
    var toLength = function (value) {
      var len = toInteger(value);
      return Math.min(Math.max(len, 0), maxSafeInteger);
    };

    // The length property of the from method is 1.
    return function from (arrayLike/*, mapFn, thisArg */) {
      // 1. Let C be the this value.
      var C = this;

      // 2. Let items be ToObject(arrayLike).
      var items = Object(arrayLike);

      // 3. ReturnIfAbrupt(items).
      if (arrayLike === null) {
        throw new TypeError('Array.from requires an array-like object - not null or undefined');
      }

      // 4. If mapfn is undefined, then let mapping be false.
      var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
      var T;
      if (typeof mapFn !== 'undefined') {
        // 5. else
        // 5. a If IsCallable(mapfn) is false, throw a TypeError exception.
        if (!isCallable(mapFn)) {
          throw new TypeError('Array.from: when provided, the second argument must be a function');
        }

        // 5. b. If thisArg was supplied, let T be thisArg; else let T be undefined.
        if (arguments.length > 2) {
          T = arguments[2];
        }
      }

      // 10. Let lenValue be Get(items, "length").
      // 11. Let len be ToLength(lenValue).
      var len = toLength(items.length);

      // 13. If IsConstructor(C) is true, then
      // 13. a. Let A be the result of calling the [[Construct]] internal method of C with an argument list containing the single item len.
      // 14. a. Else, Let A be ArrayCreate(len).
      var A = isCallable(C) ? Object(new C(len)) : new Array(len);

      // 16. Let k be 0.
      var k = 0;
      // 17. Repeat, while k < len… (also steps a - h)
      var kValue;
      while (k < len) {
        kValue = items[k];
        if (mapFn) {
          A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
        } else {
          A[k] = kValue;
        }
        k += 1;
      }
      // 18. Let putStatus be Put(A, "length", len, true).
      A.length = len;
      // 20. Return A.
      return A;
    };
  }());
}

if (!Promise.defer) {
  Promise.defer = function () {
    var deferred = {};
    var promise = new Promise(function (resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject  = reject;
    });
    deferred.promise = promise;
    return deferred;
  };
}

var app = new utils.EventEmitter();

app.globals = {
  browser: 'android'
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

// modify
app.modify = (function () {
  return {
    send: function (id, data) {
      id += '@md';
      chrome.runtime.sendMessage({method: id, data: data});
    },
    receive: function (id, callback) {
      id += '@md';
      chrome.runtime.onMessage.addListener(function (message, sender) {
        if (id === message.method && sender.url !== document.location.href) {
          callback.call(sender.tab, message.data);
        }
      });
    }
  };
})();

// triggers
app.triggers = (function () {
  return {
    send: function (id, data) {
      id += '@tr';
      chrome.runtime.sendMessage({method: id, data: data});
    },
    receive: function (id, callback) {
      id += '@tr';
      chrome.runtime.onMessage.addListener(function (message, sender) {
        if (id === message.method && sender.url !== document.location.href) {
          callback.call(sender.tab, message.data);
        }
      });
    }
  };
})();

app.File = function (obj) { // {name, path, mime, length}
  window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;
  let fileEntry, cache = [], postponed, length = 0;

  let tmp = {
    open: function () {
      let d = Promise.defer();
      function truncate (fe) {
        return new Promise(function (resolve, reject) {
          fe.createWriter(function (fileWriter) {
            fileWriter.onwrite = function () {
              if (this.length === obj.length) {
                resolve();
              }
              else {
                reject(new Error('cannot truncate the file'));
              }
            };
            fileWriter.onerror = (e) => reject(e);
            fileWriter.seek(0);
            fileWriter.truncate(obj.length);
          }, (e) => reject(e));
        });
      }
      function fill (fe) {
        return new Promise(function (resolve, reject) {
          fe.createWriter(function (fileWriter) {
            fileWriter.onwrite = function () {
              if (this.length === obj.length) {
                resolve();
              }
              else {
                reject(new Error('cannot fill the file'));
              }
            };
            fileWriter.onerror = (e) => reject(e);
            fileWriter.seek(0);
            fileWriter.write(new Array(obj.length + 1).join('.'));
          }, (e) => reject(e));
        });
      }
      window.webkitStorageInfo.requestQuota(window.TEMPORARY, obj.length, function (grantedBytes) {
        if (grantedBytes === obj.length) {
          window.requestFileSystem(
            window.TEMPORARY, obj.length, function (fs) {
              fs.root.getFile(
                Math.floor(Math.random() * 16777215).toString(16),  // a unique name
                {create: true, exclusive: false},
                function (fe) {
                  truncate(fe).catch(() => fill(fe)).then(function () {
                    fileEntry = fe;
                    Promise.all(cache.map(o => tmp.write(o.offset, o.arr))).then(function () {
                      cache = [];
                    }, (e) => d.reject(e));
                    d.resolve();
                  }, (e) => d.reject(e));
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
      }, (e) => d.reject(e));
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
            length += blob.size; // length += e.loaded
            d.resolve();
            if (postponed && length === obj.length) {
              postponed.resolve(tmp.md5());
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
      function copy (file, index) {
        let name = obj.name;
        if (index) {
          name = name.replace(/((\.[^\.]{1,3}){0,1}\.[^\.]+)$/, '-' + index + '$1');
        }
        window.resolveLocalFileSystemURL('file:///storage/emulated/0/Download/' + name,
          () => copy(file, (index || 0) + 1),
          function () {
            let fileTransfer = new FileTransfer();
            fileTransfer.download(
                file.localURL,
                '/storage/emulated/0/Download/' + name,
                function () {
                  fileEntry.remove(function () {}, function () {});
                  d.resolve();
                },
                (e) => d.reject(e),
                false,
                {}
            );
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

(function () {
  var admobid = {};
  if (/(android)/i.test(navigator.userAgent)) {
    admobid = {
      banner: 'ca-app-pub-8474379789882900/2597644121'
    };
  }
  if (AdMob) {
    AdMob.createBanner({
      adId: admobid.banner,
      position: AdMob.AD_POSITION.BOTTOM_CENTER,
      autoShow: true,
      success: function () {},
      error: function () {
        console.error('failed to create banner');
      }
    });
  }
})();
app.startup = function () {};
