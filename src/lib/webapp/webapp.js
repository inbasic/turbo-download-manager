/* global app, CryptoJS */
'use strict';

app.globals = {
  browser: 'firefox'
};

app.XMLHttpRequest = window.XMLHttpRequest;
app.EventEmitter = EventEmitter;

app.Promise = Promise;
if (!Promise.defer) {
  Object.defineProperty(Promise, 'defer', {
    configurable: true,
    writable: true,
    value: function () {
      var rtn = {};
      rtn.promise = new Promise(function (a, b) {
        rtn.resolve = a;
        rtn.reject = b;
      });
      return rtn;
    }
  });
}

app.manager = {
  send: function (id, msg) {
    id += '@ui';
    window.frames[0].postMessage({id, msg}, '*');
  },
  receive: function (id, callback) {
    id += '@ui';
    window.addEventListener('message', function (e) {
      if (e.data && e.data.id === id) {
        callback(e.data.msg);
      }
    });
  }
};

app.add = {
  send: function (id, msg) {
    id += '@ad';
    window.frames[0].frames[0].postMessage({id, msg}, '*');
  },
  receive: function (id, callback) {
    id += '@ad';
    window.addEventListener('message', function (e) {
      if (e.data && e.data.id === id) {
        callback(e.data.msg);
      }
    });
  }
};

app.info = {
  send: function (id, msg) {
    id += '@if';
    window.frames[0].frames[0].postMessage({id, msg}, '*');
  },
  receive: function (id, callback) {
    id += '@if';
    window.addEventListener('message', function (e) {
      if (e.data && e.data.id === id) {
        callback(e.data.msg);
      }
    });
  }
};

app.canvas = function () {
  return document.querySelector('canvas');
};

app.storage = (function () {
  let listen = {};
  return {
    read: function (id) {
      return localStorage[id];
    },
    write: function (id, data) {
      localStorage[id] = data;
      if (listen[id]) {
        listen[id]();
      }
    },
    on: function(name, callback) {
      listen[name] = callback;
    }
  }
})();

app.version = function () {
  return 0;
}

app.timer = window;

app.button = {
  onCommand: function () {}
};

app.tab = {
  open: function (url) {
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.parentNode.removeChild(a);
  },
  list: function () {},
  reload: function () {},
  activate: function () {}
};

app.menu = function () {};

app.notification = function (msg) {
  new Notification('Turbo Download Manager', {
    body: msg,
    icon: '../../data/icons/512.png'
  });
};

app.getURL = function (path) {
  return '../../data/' + path;
};

app.File = function (obj) { // {name, path, mime}
  var cache = {};
  return {
    open: function () {
      return 'not implemented';
    },
    write: function (offset, content) {
      var a = content;
      var view = new Uint8Array(a.length);
      for (var i = 0; i < a.length; i++) {
        view[i] = a.charCodeAt(i);
      }
      cache[offset] = cache[offset] || [];
      cache[offset].push(view.buffer);
      return Promise.resolve(true);
    },
    toBlob: (function () {
      var blob;
      function b () {
        var arr = [], tmp = [];
        for (var i in cache) {
          tmp.push(i);
        }
        tmp.sort(function (a, b) {
          return a - b;
        });
        tmp.forEach(function (i) {
          arr = arr.concat(cache[i + '']);
        });
        var _blob = new Blob(arr, {
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
    launch: function () {
      app.notification('Not available in this browser');
    },
    reveal: function () {
      app.notification('Not available in this browser');
    }
  };
};

app.disk = {
  browse: function () {}
};

app.emit('load');
