/* globals app, cordova */
'use strict';

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
app.globals.folder = false;
app.globals.open = true;

/* app.tab */
app.tab.open = (url) => window.open(url, '_system');
/* app.notification */
app.notification = (text) => window.plugins.toast.showLongCenter(text);
/* app.platform */
app.platform = function () {
  let v1 = /Chrome\/[\d\.]*/.exec(navigator.userAgent);
  return v1[0].replace('Chrome/', 'Chrome ') + ` & Cordova ${cordova.version}`;
};
/* app.version */
app.version = () => cordova.getAppVersion.getVersionNumber();
/* app.storage */
app.storage = (function () {
  let callbacks = {};
  let storage = window.localStorage;

  return {
    read: function (id) {
      let tmp = storage.getItem(id);
      return tmp === null ? undefined : tmp;
    },
    write: function (id, data) {
      storage.setItem(id, data);
      if (id in callbacks) {
        callbacks[id].forEach(c => c());
      }
    },
    on: (name, callback) => {
      callbacks[name] = callbacks[name] || [];
      callbacks[name].push(callback);
    }
  };
})();
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
/* app.fileSystem */
app.fileSystem.root.external = function () {
  return new Promise(function (resolve, reject) {
    window.resolveLocalFileSystemURL(
      cordova.file.externalRootDirectory + 'Download',
      (root) => resolve(root),
      (e) => reject(e)
    );
  });
};
app.fileSystem.file.truncate = function (fileEntry, bytes) {
  function allocate (start, length, success, fail) {
    fileEntry.createWriter(function (fileWriter) {
      fileWriter.onwrite = function () {
        fileEntry.file(function (file) {
          if (file.size === length + start) {
            success();
          }
          else {
            fail(new Error('Cannot allocate'));
          }
        }, (e) => fail(e));
      };
      fileWriter.onerror = (e) => fail(e);
      let b = new Blob([new Uint8Array(length)], {type: 'application/octet-stream'});
      fileWriter.seek(start);
      fileWriter.write(b);
    }, (e) => fail(e));
  }
  let start = 0;
  let size = 5 * 1024 * 1024;
  // Since there is no truncate function for fileWriter, we are allocating space with 5Mbyte write requests
  return new Promise(function (resolve, reject) {
    function doOne () {
      let a = Math.min(bytes - start, size);
      if (a) {
        allocate(start, a, function () {
          start += a;
          doOne();
        }, (e) => reject(e));
      }
      else {
        resolve();
      }
    }
    doOne();
  });
};
app.fileSystem.file.write = function (fileEntry, offset, arr) {
  return new Promise(function (resolve, reject) {
    fileEntry.createWriter(function (fileWriter) {
      let blob = new Blob(arr, {type: 'application/octet-stream'});
      fileWriter.onerror = (e) => reject(e);
      fileWriter.onwrite = () => resolve();
      fileWriter.seek(offset);
      let reader = new FileReader();
      reader.onloadend = function () {
        fileWriter.writeBinaryArray(reader.result);
      };
      reader.readAsBinaryString(blob);
    }, (e) => reject(e));
  });
};
app.fileSystem.file.md5 = function (file) {
  return new Promise(function (resolve, reject) {
    window.md5chksum.file(file, resolve, reject);
  });
};
app.fileSystem.file.toURL = (file) => Promise.resolve(file.toURL());
app.fileSystem.file.launch = function (file) {
  let url = file.toURL();
  return new Promise(function (resolve, reject) {
    cordova.plugins.FileOpener.canOpenFile(url, function () {
      cordova.plugins.FileOpener.openFile(url, resolve, reject);
    }, reject);
  });
};

app.process = (path, file) => app.fileSystem.file.launch(file.file);

// internals
document.addEventListener('deviceready', function () {
  let admobid = {};
  if ('AdMob' in window && /(android)/i.test(navigator.userAgent) && false) {
    admobid = {
      banner: 'ca-app-pub-8474379789882900/4565165323'
    };
    window.AdMob.createBanner({
      adId: admobid.banner,
      position: window.AdMob.AD_POSITION.TOP_CENTER,
      autoShow: true,
      success:function () {},
      error: function () {}
    });
  }
}, false);
