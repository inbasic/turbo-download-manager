'use strict';
// electron
var electron = require('electron');
var Menu = require('menu');
var BrowserWindow = electron.BrowserWindow;
var ipcMain = require('electron').ipcMain;
var dialog = require('electron').dialog;
var clipboard = require('electron').clipboard;
var shell = require('electron').shell;
// node
var path = require('path');
var fs = require('fs');
var crypt = require('crypto');
var os = require('os');
// community libs
var Storage = require('node-storage');
var request = require('request');
var semver = require('semver');
var diskspace = require('diskspace');
var optimist = require('optimist');
// internals
var utils = require('../utils');
var self = require('../../package.json');
var userAgant =  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.94 Safari/537.36';

var XMLHttpRequest = function () { // jshint ignore:line
  let method = 'GET', uri, readyState = 2;
  let headers = {
    'User-Agent': userAgant
  };
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
    get response () {
      return response;
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
  referrer: true
};

exports.Promise = Promise;
exports.XMLHttpRequest = XMLHttpRequest;

exports.fetch = function (uri, props) {
  let d = Promise.defer();
  let ppp, buffers = [];
  let status;
  let loaded = 0, total = 0;

  if (props.referrer) {
    props.headers.referer = props.referrer;
  }
  let req = request({
    uri,
    method: 'GET',
    headers: props.headers
  });

  function send () {
    if (ppp && buffers.length) {
      ppp(buffers.shift());
      ppp = null;
    }
  }

  let resolve = (function () {
    let resolved = false;
    return function () {
      if (!resolved) {
        d.resolve({
          ok: status >= 200 && status < 300,
          get status () {
            return status;
          },
          body: {
            getReader: function () {
              return {
                read: function () {
                  let d = Promise.defer();
                  ppp = d.resolve;
                  send();
                  return d.promise;
                },
                cancel: () => req.abort()
              };
            }
          }
        });
      }
      resolved = true;
      send();
    };
  })();

  req.on('error', (e) => d.reject(e));
  req.on('response', function (response) {
    status = response.statusCode;
    total = +response.headers['content-length'];
  });
  req.on('data', function (chunk) {
    if (chunk.byteLength) {
      loaded += chunk.byteLength;
      buffers.push({
        value: chunk,
        done: loaded === total
      });
    }
    resolve();
  });
  req.on('end', () => resolve());
  req.end();

  return d.promise;
};

exports.EventEmitter = utils.EventEmitter;
exports.timer = {setTimeout, clearTimeout, setInterval, clearInterval};
exports.URL = require('url').parse;

exports.storage = (function () {
  let dir = path.resolve(process.env.HOME || process.env.USERPROFILE, '.tdm');
  if (!fs.existsSync(dir)) {  // node-storage is not creating the directory if it does not exist
    fs.mkdirSync(dir);
  }
  let store = new Storage(path.resolve(process.env.HOME || process.env.USERPROFILE, '.tdm', 'storage'));
  let callbacks = {};
  return {
    read: (id) => {
      let val = store.get(id);
      return (val || !isNaN(val)) ? val + '' : val;
    },
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

exports.notification = (message) => mainWindow.webContents.send('_notification', message);

exports.version = () => self.version;
exports.platform = () => `io.js ${process.version} & Electron ${process.versions['electron']} on ${process.platform}`;

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

// triggers
exports.triggers = {
  send: (id, data) => mainWindow.webContents.send(id + '@tr', {
    url: 'background.html',
    data
  }),
  receive: (id, callback) => ipcMain.on(id + '@tr', function (event, arg) {
    if (arg &&  arg.url === 'triggers/index.html') {
      callback(arg.data);
    }
  })
};

// about
exports.about = {
  send: (id, data) => mainWindow.webContents.send(id + '@ab', {
    url: 'background.html',
    data
  }),
  receive: (id, callback) => ipcMain.on(id + '@ab', function (event, arg) {
    if (arg &&  arg.url === 'about/index.html') {
      callback(arg.data);
    }
  })
};

exports.fileSystem = {
  file: {
    exists: function (root, name) {
      return new Promise((resolve) => fs.exists(path.join(root, name), resolve));
    },
    create: function (root, name) {
      return new Promise(function (resolve) {
        // 'wx+' - Open file for reading and writing. It fails if path exists.
        let url = path.join(root, name);
        fs.open(url, 'wx+', function (err, fd) {
          if (err) {
            throw err;
          }
          resolve({fd, name, root, path: url});
        });
      });
    },
    truncate: () => Promise.resolve(),
    write: function (file, offset, arr) {
      function write (offset, buffer) {
        return new Promise(function (resolve, reject) {
          fs.write(file.fd, buffer, 0, buffer.length, offset, function (err, written, buffer) {
            if (err) {
              throw err;
            }
            if (written !== buffer.length) {
              return reject(new Error('written length does not match to the actual buffer size'));
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
    md5: function (file) {
      return new Promise(function (resolve) {
        fs.readFile(file.fd, function (err, buf) {
          if (err) {
            throw err;
          }
          let hash = crypt.createHash('md5');
          hash.update(buf);
          resolve(hash.digest('hex'));
        });
      });
    },
    rename: function (file, root, name) {
      return new Promise(function (resolve) {
        let url = path.join(root, name);
        fs.rename(file.path, url, (err) => {
          if (err) {
            throw err;
          }
          fs.open(path.join(root, name), 'r+', function (err, fd) {
            if (err) {
              throw err;
            }
            resolve({fd, name, root, path: url});
            fs.close(file.fd);
          });
        });
      });
    },
    remove: function (file) {
      return new Promise(function (resolve) {
        fs.unlink(file.path, function (err) {
          if (err) {
            throw err;
          }
          resolve();
        });
      });
    },
    launch: function (file) {
      return new Promise(function () {
        return shell.openItem(file.path);
      });
    },
    reveal: function (file) {
      return new Promise(function () {
        return shell.showItemInFolder(file.path);
      });
    },
    close: function (file) {
      return new Promise(function (resolve) {
        fs.close(file.fd, function (err) {
          if (err) {
            throw err;
          }
        });
        resolve();
      });
    }
  },
  root: {
    internal: () => new Promise.reject(),
    external: function (bytes, url) {
      return new Promise(function (resolve, reject) {
        let root = url ? url : path.resolve(process.env.HOME || process.env.USERPROFILE, 'Downloads');
        diskspace.check(path.parse(root).root, function (err, total, free) {
          if (err) {
            throw err;
          }
          if (free < bytes) {
            return reject(new Error(`cannot allocate space; available: ${free}, required: ${bytes}`));
          }
          resolve(root);
        });
      });
    }
  }
};

exports.disk = {
  browse: function () {
    return new Promise(function (resolve, reject) {
      let dirs = dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      if (dirs && dirs.length) {
        exports.storage.write('');
        resolve(dirs[0]);
      }
      else {
        reject();
      }
    });
  }
};

// native downloader
exports.download = (obj) => shell.openExternal(obj.url);

exports.startup = function (c) {
  let callback = c || function () {};
  electron.app.on('ready', () => callback());
};

exports.arguments = function (c) {
  let callback = c || function () {};
  exports.on('ready', () => callback(optimist.parse(process.argv)));
  exports.on('command-line', (argv) => callback(argv));
};

exports.developer = {
  console: () => mainWindow.webContents.openDevTools()
};

exports.play = (src) => mainWindow.webContents.send('_sound', src);

exports.sandbox = (function () {
  let cache = {};
  ipcMain.on('_sandbox', function (event, arg) {
    if (cache[arg.id]) {
      let url = arg.url;
      cache[arg.id][url ? 'resolve' : 'reject'](url);
    }
  });

  return function (url, options) {
    let d = Promise.defer();
    let id = Math.random();
    cache[id] = d;
    mainWindow.webContents.send('_sandbox', {url, id, options});
    setTimeout(d.reject, options['no-response'], null);
    return d.promise;
  };
})();

/* internals */
function createWindow () {
  // single instance
  let iShouldQuit = electron.app.makeSingleInstance(function (commandLine) {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
      exports.emit('command-line', optimist.parse(commandLine));
    }
    return true;
  }) && !optimist.parse(process.argv).forced;

  if (iShouldQuit) {
    electron.app.quit();
  }
  else {
    mainWindow = new BrowserWindow({
      width: 800,
      height: 700
    });
    mainWindow.loadURL('file://' + __dirname + '/../../data/manager/index.html');

    mainWindow.on('closed', function () {
      mainWindow = null;
    });
    exports.emit('ready');
  }
}

electron.app.on('ready', createWindow);

function createMenu () {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Turbo Download Manager',
      submenu: [
        {label: 'About Application', click: exports.emit.bind(exports, 'open', 'about')},
        {label: 'Check for Updates...', click: exports.emit.bind(exports, 'open', 'sourceforge')},
        {type: 'separator'},
        {label: 'Adjust Triggers', click: exports.emit.bind(exports, 'open', 'triggers')},
        {type: 'separator'},
        {label: 'Quit', accelerator: 'Command+Q', click: function () {
          electron.app.quit();
        }}
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:'},
        {label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:'},
        {type: 'separator'},
        {label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:'},
        {label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:'},
        {label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:'},
        {label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:'}
      ]
    },
    {
      label: 'Help',
      submenu: [
        {label: 'Open FAQs Page', click: exports.emit.bind(exports, 'open', 'faq')},
        {label: 'Open Bug Reporter', click: exports.emit.bind(exports, 'open', 'bug')}
      ]
    }
  ]));
}

electron.app.on('ready', createMenu);

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
/* update checker */
exports.on('ready', function () {
  request({
    uri: 'https://api.github.com/repos/inbasic/turbo-download-manager/releases',
    method: 'GET',
    headers: {
      'User-Agent': userAgant
    }
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      try {
        let json = JSON.parse(body);
        let versions = json.map(o => o.tag_name);
        versions = versions
          .filter(v => semver.compare(v, self.version) > 0)
          .filter(v => v.indexOf('alpha') === -1 && v.indexOf('beta') === -1);
        if (versions.length) {
          let version = versions.shift();
          let url = `https://github.com/inbasic/turbo-download-manager/releases/download/${version}/tdm-${process.platform}-${os.arch()}.7z`;
          mainWindow.webContents.send('_update', {
            title: `New version of "Turbo Download Manager" is available (${version}). Would you like to update?`,
            url,
            referrer: 'https://github.com/inbasic/turbo-download-manager/releases/'
          });
        }
      }
      catch (e) {
        console.error(e);
      }
    }
  });
});
