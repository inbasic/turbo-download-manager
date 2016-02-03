'use strict';
// electron
var electron = require('electron');
var BrowserWindow = electron.BrowserWindow;
var ipcMain = require('electron').ipcMain;
var dialog = require('electron').dialog;
var clipboard = require('electron').clipboard;
var shell = require('electron').shell;
// node
var path = require('path');
var fs = require('fs');
// libs
var Storage = require('node-storage');
var md5 = require('md5');
var request = require('request');

if (typeof require !== 'undefined') {
  var utils = require('../utils');
}

var self = require('../../package.json');

var XMLHttpRequest = function () {
  let method = 'GET', uri, headers = {}, readyState = 2;
  let onload = function () {};
  let onreadystatechange = function () {};
  let onerror = function () {};
  let onprogress = function () {};
  let req, response;

  return {
    get responseURL() {
      return req.uri.href;
    },
    get readyState () {
      return readyState;
    },
    open: (m, u) => {
      method = m || method;
      uri = u;
    },
    set onload (c) {onload = c;},
    set onerror (c) {onerror = c;},
    set onprogress (c) {onprogress = c;},
    set onreadystatechange (c) {onreadystatechange = c;},
    setRequestHeader: (id, val) => headers[id] = val,
    getResponseHeader: (id) => response.headers[id.toLowerCase()] || null,
    getAllResponseHeaders: () => response.headers,
    send: function () {
      req = request({uri, method, headers});
      req.on('data', (chunk) => onprogress(chunk));
      req.on('response', function (r) {
        response = r;
        readyState = 3;
        onreadystatechange();
      });
      req.on('end', function () {
        readyState = 4;
        onreadystatechange();
        onload();
      });
      req.on('error', onerror);
      req.end();
    },
    abort: () => req.abort()
  };
};

var mainWindow;

(function (e) {
  exports.on = e.on.bind(e);
  exports.once = e.once.bind(e);
  exports.emit = e.emit.bind(e);
  exports.removeListener = e.removeListener.bind(e);
})(new utils.EventEmitter());

exports.globals = {
  browser: 'electron',
};

exports.Promise = Promise;
exports.XMLHttpRequest = XMLHttpRequest;

exports.fetch = function (uri, props) {
  let d = Promise.defer(), buffers = [], done = false;
  let ppp, sent = false;

  function result() {
    return {
      value: buffers.shift(),
      get done() { return done && buffers.length === 0; }
    };
  }
  let req = request({
    uri,
    method: 'GET',
    headers: props.headers
  });
  req.on('error', (e) => d.reject(e));
  req.on('data', function (chunk) {
    buffers.push(chunk);
    if (!sent) {
      sent = true;
      d.resolve({
        ok: true,
        body: {
          getReader: function () {
            return {
              read: function () {
                let d = Promise.defer();
                if (buffers.length) {
                  ppp = null;
                  d.resolve(result());
                } else {
                  ppp = d.resolve;
                }
                return d.promise;
              },
              cancel: () => req.abort()
            };
          }
        }
      });
    }
    if (ppp) {
      ppp(result());
    }
  });
  req.on('end', () => done = true);
  req.end();

  return d.promise;
};

exports.EventEmitter = utils.EventEmitter;
exports.timer = {setTimeout, clearTimeout, setInterval, clearInterval};
exports.URL = require('url').parse;

exports.storage = (function () {
  let store = new Storage(path.resolve(process.env.HOME || process.env.USERPROFILE, '.tdm', 'storage'));
  let callbacks = {};
  return {
    read: (id) => store.get(id),
    write: (id, data) => {
      if (store.get(id) !== data) {
        store.put(id, data);
        (callbacks[id] || []).forEach(c => c());
      }
    },
    on: function (id, callback) {
      callbacks[id] = callbacks[id] || [];
      callbacks[id].push(callback);
    }
  };
})();

exports.canvas = () => null;

exports.button = {
  onCommand: function () {},
},

exports.getURL = (p) => 'file://' + path.resolve('data/', p);

exports.mimes = require('../../data/assets/mime.json');

exports.tab = {
  open: shell.openExternal,
  list: () => Promise.resolve([]),
  reload: function () {},
  activate: function () {}
};

exports.menu = function () {};

exports.notification = function (message) {
  mainWindow.webContents.send('_notification', message);
};

exports.version = function () {
  return self.version;
};

exports.OS = {
  clipboard: {
    get: function () {
      return Promise.resolve(clipboard.readText());
    }
  }
};

// manager
exports.manager = {
  send: (id, data) => mainWindow.webContents.send(id + '@ui', {
    url: 'background.html',
    data
  }),
  receive: (id, callback) => ipcMain.on(id + '@ui', function (event, arg) {
    if (arg &&  arg.url === 'manager/index.html') {
      callback(arg.data);
    }
  })
};

// add
exports.add = {
  send: (id, data) => mainWindow.webContents.send(id + '@ad', {
    url: 'background.html',
    data
  }),
  receive: (id, callback) => ipcMain.on(id + '@ad', function (event, arg) {
    if (arg &&  arg.url === 'add/index.html') {
      callback(arg.data);
    }
  })
};

// info
exports.info = {
  send: (id, data) => mainWindow.webContents.send(id + '@if', {
    url: 'background.html',
    data
  }),
  receive: (id, callback) => ipcMain.on(id + '@if', function (event, arg) {
    if (arg &&  arg.url === 'info/index.html') {
      callback(arg.data);
    }
  })
};

// modify
exports.modify = {
  send: (id, data) => mainWindow.webContents.send(id + '@md', {
    url: 'background.html',
    data
  }),
  receive: (id, callback) => ipcMain.on(id + '@md', function (event, arg) {
    if (arg &&  arg.url === 'modify/index.html') {
      callback(arg.data);
    }
  })
};

exports.File = function (obj) { // {name, path, mime, length}
  let file, filePath;
  let cache = [];
  let tmp = {
    open: function () {
      let p = obj.path ? path.resolve(obj.path, obj.name) : path.resolve(process.env.HOME || process.env.USERPROFILE, 'Downloads', obj.name);

      function check (callback, index) {
        let tp = p;
        if (index) {
          tp = tp.replace(/((\.[^\.]{1,3}){0,1}\.[^\.]+)$/, '-' + index + '$1');
        }
        fs.exists(tp, function (exists) {
          if (exists) {
            check(callback, (index || 0) + 1);
          }
          else {
            callback(tp);
          }
        });
      }
      return new Promise(function (resolve, reject) {
        check(function (p) {
          filePath = p;
          fs.open(p, 'w', function (err, fd) {
            if (err) {
              reject(err);
            }
            else {
              file = fd;
              return Promise.all(cache.map(o => tmp.write(o.offset, o.arr))).then(function () {
                cache = [];
                resolve();
              }, (e) => reject(e));
            }
          });
        });
      });
    },
    write: function (offset, arr) {
      if (!file) {
        cache.push({offset, arr});
        return Promise.resolve();
      }
      function write (offset, buffer) {
        return new Promise(function (resolve, reject) {
          fs.write(file, buffer, 0, buffer.length, offset, function (err, written, buffer) {
            if (err) {
              reject(err);
            }
            if (written !== buffer.length) {
              reject(new Error('written length does not match to the actual buffer size'));
            }
            resolve();
          });
        });
      }
      let m = [];
      let c = offset;
      for (let i = 0; i < arr.length; i++) {
        m.push(write(c, arr[i]));
        c += arr[i].length;
      }
      return Promise.all(m);
    },
    md5: function () {
      return new Promise(function (resolve, reject) {
        fs.readFile(filePath, function (err, buf) {
          if (err) {
            reject(err);
          }
          else {
            resolve(md5(buf));
          }
        });
      });
    },
    flush: function () {
      return Promise.resolve();
    },
    remove: function () {

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

exports.disk = {
  browse: function () {
    return new Promise(function (resolve, reject) {
      let dirs = dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      if (dirs && dirs.length) {
        exports.storage.write('')
        resolve(dirs[0]);
      }
      else {
        reject();
      }
    });
  }
};

// native downloader
exports.download = function (obj) {
  shell.openExternal(obj.url);
};

exports.startup = function () {};

exports.developer = {
  console: () => mainWindow.webContents.openDevTools()
};

/* internals */
function createWindow () {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600
  });
  mainWindow.loadURL('file://' + __dirname + '/../../data/manager/index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

electron.app.on('ready', createWindow);

electron.app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    electron.app.quit();
  }
});

electron.app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
