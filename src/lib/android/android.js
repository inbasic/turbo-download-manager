/* globals app, utils, cordova */
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

/* app.globals */
app.globals.browser = 'android';
app.globals.referrer = false;
/* app.tab */
app.tab.open = (url) => window.open(url, '_system');
/* app.notification */
app.notification = (text) => window.plugins.toast.showLongCenter(text);
/* app.platform */
app.platform = function () {
  let v1 = /Chrome\/[\d\.]*/.exec(navigator.userAgent);
  return v1[0].replace('Chrome/', 'Chrome ') + ` & Cordova ${cordova.version}`;
};
/* app.OS */
app.OS = {
  clipboard: {
    get: function () {
      let d = Promise.defer();
      cordova.plugins.clipboard.paste((s) => d.resolve(s), () => d.resolve(''));
      return d.promise;
    }
  }
};
/* app.File */
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
              fileEntry.moveTo(dir, name, () => d.resolve(name), e => d.reject(e));
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
/* app.download */
app.download = function (obj) {
  window.open(obj.url, '_system');
  return Promise.resolve();
};
/* app.startup */
app.startup = function () {};
/* app.sandbox */
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
// internals
(function () {
  var admobid = {};
  if (/(android)/i.test(navigator.userAgent)) {
    admobid = {
      banner: 'ca-app-pub-8474379789882900/4565165323'
    };
  }
  if ('AdMob' in window) {
    window.AdMob.createBanner({
      adId: admobid.banner,
      position: window.AdMob.AD_POSITION.TOP_CENTER,
      autoShow: true,
      success:function () {},
      error: function () {}
    });
  }
})();
// runtime
chrome.app.runtime.onLaunched.addListener(function () {
  chrome.app.window.create('data/manager/index.html', {
    id: 'tdm-manager',
  });
});
