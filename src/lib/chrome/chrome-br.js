/* globals app */
'use strict';

app.once('load', function () {
  let script = document.createElement('script');
  document.body.appendChild(script);
  script.src = 'lib/common.js';
});
/* app.notification */
app.notification = (text) => chrome.notifications.create(null, {
  type: 'basic',
  iconUrl: 'data/icons/48.png',
  title: 'Turbo Download Manager',
  message: text
});
/* app.OS */
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
/* app.File */
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
/* app.startup */
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
