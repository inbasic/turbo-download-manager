'use strict';

// Load Firefox based resources
var self          = require('sdk/self'),
    data          = self.data,
    sp            = require('sdk/simple-prefs'),
    prefs         = sp.prefs,
    pageMod       = require('sdk/page-mod'),
    notifications = require('sdk/notifications'),
    tabs          = require('sdk/tabs'),
    urls          = require('sdk/url'),
    timers        = require('sdk/timers'),
    platform      = require('sdk/system').platform,
    array         = require('sdk/util/array'),
    unload        = require('sdk/system/unload'),
    {all, defer, race, resolve}  = require('sdk/core/promise'),
    {on, off, once, emit} = require('sdk/event/core'),
    {Ci, Cc, Cu, components}  = require('chrome');

var {Services} = Cu.import('resource://gre/modules/Services.jsm');
var {NetUtil} = Cu.import('resource://gre/modules/NetUtil.jsm');
var {FileUtils} = Cu.import('resource://gre/modules/FileUtils.jsm');

var desktop = ['winnt', 'linux', 'darwin'].indexOf(platform) !== -1;
var xhr = {
  XMLHttpRequest: function () {
    return Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);
  }
};

exports.globals = {
  browser: 'firefox'
};

exports.Promise = {defer, all, race, resolve};
exports.XMLHttpRequest = xhr.XMLHttpRequest;
exports.URL = urls.URL;

exports.fetch = function (url, props) {
  let d = defer(), req = new xhr.XMLHttpRequest(), buffers = [], done = false;
  let ppp, sent = false;

  function result() {
    return {
      value: buffers.shift(),
      get done() { return done; }
    };
  }
  req.mozBackgroundRequest = true;  //No authentication
  req.open('GET', url);
  req.responseType = 'moz-chunked-arraybuffer';
  req.overrideMimeType('text/plain; charset=x-user-defined');
  req.channel
    .QueryInterface(Ci.nsIHttpChannelInternal)
    .forceAllowThirdPartyCookie = true;
  if (props.headers) {
    Object.keys(props.headers).forEach((k) => req.setRequestHeader(k, props.headers[k]));
  }

  req.onprogress = function() {
    buffers.push(req.response);
    if (!sent) {
      sent = true;
      d.resolve({
        ok: req.status >= 200 && req.status < 300,
        body: {
          getReader: function() {
            return {
              read: function() {
                let d = defer();
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
  };
  req.ontimeout = req.onerror = (e) => d.reject(e);
  req.onload = () => done = true;
  req.send();
  return d.promise;
};

exports.EventEmitter = (function () {
  let EventEmitter = function () {
    this.listeners = {};
    this.onces = {};
  };
  EventEmitter.prototype.on = function (name, callback) {
    this.listeners[name] = this.listeners[name] || [];
    this.listeners[name].push(callback);
  };
  EventEmitter.prototype.once = function (name, callback) {
    this.onces[name] = this.onces[name] || [];
    this.onces[name].push(callback);
  };
  EventEmitter.prototype.emit = function (name) {
    var args = Array.prototype.slice.call(arguments);
    var tobeSent = args.splice(1);
    if (this.listeners[name]) {
      this.listeners[name].forEach(f => f.apply(this, tobeSent));
    }
    if (this.onces[name]) {
      this.onces[name].forEach(f => f.apply(this, tobeSent));
      this.onces[name] = [];
    }
  };
  EventEmitter.prototype.removeListener = function (name, callback) {
    if (this.listeners[name]) {
      var index = this.listeners[name].indexOf(callback);
      if (index !== -1) {
        this.listeners[name].splice(index, 1);
      }
    }
  };
  EventEmitter.prototype.removeAllListeners = function () {
    this.listeners = {};
    this.onces = {};
  };
  return EventEmitter;
})();
// this needs to be fired after firefox.js is loaded on all modules
timers.setTimeout(() => exports.emit('load'), 3000);

// Event Emitter
exports.on = on.bind(null, exports);
exports.once = once.bind(null, exports);
exports.emit = emit.bind(null, exports);
exports.removeListener = function removeListener (type, listener) {
  off(exports, type, listener);
};

// canvas
exports.canvas = (function () {
  var hidden = Cc['@mozilla.org/appshell/appShellService;1']
    .getService(Ci.nsIAppShellService).hiddenDOMWindow;
  return function () {
    return hidden.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
  };
})();

//toolbar button
exports.button = (function () {
  let callback, id, button;
  function getNativeWindow() {
    let window = Services.wm.getMostRecentWindow('navigator:browser');
    return window.NativeWindow;
  }
  if (desktop) {
    button = require('sdk/ui/button/action').ActionButton({
      id: self.name,
      label: 'Turbo Download Manager',
      icon: {
        '18': './icons/18.png',
        '36': './icons/36.png'
      },
      onClick: function() {
        if (callback) {
          callback();
        }
      }
    });
  }
  else {
    button = {};
    id = getNativeWindow().menu.add('Turbo Download Manager', null, function () {
      if (callback) {
        callback();
      }
    });
    unload.when(() => getNativeWindow().menu.remove(id));
  }
  return {
    onCommand: function (c) {
      callback = c;
    },
    set icon (obj) { // jshint ignore: line
      button.icon = obj;
    },
    set label (val) { // jshint ignore: line
      button.label = val;
    },
    set badge (val) { // jshint ignore: line
      button.badge = val;
    }
  };
})();

exports.storage = {
  read: function (id) {
    return (prefs[id] || prefs[id] + '' === 'false' || !isNaN(prefs[id])) ? (prefs[id] + '') : null;
  },
  write: function (id, data) {
    data = data + '';
    if (data === 'true' || data === 'false') {
      prefs[id] = data === 'true' ? true : false;
    }
    else if (parseInt(data) + '' === data) {
      prefs[id] = parseInt(data);
    }
    else {
      prefs[id] = data + '';
    }
  },
  on: function (name, callback) {
    sp.on(name, callback);
  }
};

exports.getURL = function (path) {
  return data.url(path);
};

exports.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      tabs.activeTab.url = url;
    }
    else {
      tabs.open({
        url: url,
        inBackground: typeof inBackground === 'undefined' ? false : inBackground
      });
    }
  },
  list: function () {
    var temp = [];
    for (let tab of tabs) {
      try {
        if (tab && tab.url) {
          temp.push(tab);
        }
      }
      catch (e) {}
    }
    return resolve(temp);
  },
  reload: function (tab) {
    tab.reload();
    return resolve(tab);
  },
  activate: function (tab) {
    tab.activate();
    if ('window' in tab) {
      tab.window.activate();
    }
    return resolve(tab);
  }
};
unload.when(function () {
  exports.tab.list().then(function (tabs) {
    tabs.filter(t => t && t.url.indexOf(data.url('')) === 0).forEach(t => t.close());
  });
});

exports.menu = function (title, callback) {
  if (desktop) {
    let contextMenu = require('sdk/context-menu');
    contextMenu.Item({
      label: title,
      image: data.url('./icons/32.png'),
      context: contextMenu.SelectorContext('a[href], video, audio, img'),
      contentScriptFile: data.url('./firefox/menu.js'),
      onMessage: function (node) {
        callback(node);
      }
    });
  }
};

exports.version = function () {
  return self.version;
};

exports.timer = timers;

exports.notification = function (text) {
  notifications.notify({
    title: 'Turbo Download Manager',
    text: text,
    iconURL: data.url('icons/32.png')
  });
};

exports.File = function (obj) { // {name, path, mime}
  let file, flushed = false;
  let dnldMgr = Cc['@mozilla.org/download-manager;1'].getService(Ci.nsIDownloadManager);

  return {
    open: function () {
      return new Promise(function (resolve) {
        file = obj.path ? FileUtils.File(obj.path) : dnldMgr.userDownloadsDirectory;
        file.append(obj.name);
        file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
        resolve();
      });
    },
    write: function (offset, arr) {
      let d = defer();
      let ostream = Cc['@mozilla.org/network/file-output-stream;1']
        .createInstance(Ci.nsIFileOutputStream);
      ostream.init(file, 0x08| 0x02, 0, 0);  // 0x08: Create File, 0x02: Write only

      let seekstream = ostream.QueryInterface(Ci.nsISeekableStream);
      seekstream.seek(0x00, offset); // 0x00: Offset is relative to the start of the stream.

      let istream = Cc['@mozilla.org/io/arraybuffer-input-stream;1']
        .createInstance(Ci.nsIArrayBufferInputStream);

      let content = new Uint8Array(arr.reduce((p, c) => p + c.byteLength, 0));
      (function (offset) {
        arr.forEach(function (buffer) {
          content.set(new Uint8Array(buffer), offset);
          offset += buffer.byteLength;
        });
      })(0);

      istream.setData(content.buffer, 0, content.buffer.byteLength);

      let bstream = Cc['@mozilla.org/binaryinputstream;1']
        .createInstance(Ci.nsIBinaryInputStream);
      bstream.setInputStream(istream);

      NetUtil.asyncCopy(bstream, ostream,
        function(status) {
          if (!components.isSuccessCode(status)) {
            d.reject(Error('Segment write error.'));
          }
          d.resolve(true);
        }
      );
      return d.promise;
    },
    md5: function () {
      function toHexString(charCode) {
        return ('0' + charCode.toString(16)).slice(-2);
      }
      let istream = Cc['@mozilla.org/network/file-input-stream;1']
        .createInstance(Ci.nsIFileInputStream);
      istream.init(file, 0x01, 292/*0444*/, 0);
      let ch = Cc['@mozilla.org/security/hash;1']
        .createInstance(Ci.nsICryptoHash);
      ch.init(ch.MD5);
      const PR_UINT32_MAX = 0xffffffff;
      ch.updateFromStream(istream, PR_UINT32_MAX);
      let hash = ch.finish(false);
      let s = [toHexString(hash.charCodeAt(i)) for (i in hash)].join('');
      return resolve(s);
    },
    flush: function () {
      flushed = true;
      return resolve(file.fileSize);
    },
    remove: function (forced) {
      if (flushed && !forced) {
        return;
      }
      try {
        file.remove(true);
      }
      catch (e) {}
    },
    reveal: function () {
      try {
        file.reveal();
      }
      catch (e) {
        exports.notification(e.message);
      }
    },
    launch: function () {
      try {
        file.launch();
      }
      catch (e) {
        exports.notification(e.message);
      }
    }
  };
};

exports.disk = (function () {
  let filePicker = Cc['@mozilla.org/filepicker;1']
    .createInstance(Ci.nsIFilePicker);
  return {
    browse: function () {
      let d = defer();
      let window = Services.wm.getMostRecentWindow('navigator:browser');
      filePicker.init(window, 'Save in', Ci.nsIFilePicker.modeGetFolder);
      filePicker.appendFilters(Ci.nsIFilePicker.filterAll );
      let pickerStatus = filePicker.show();
      if (pickerStatus === Ci.nsIFilePicker.returnOK || pickerStatus === Ci.nsIFilePicker.returnReplace) {
        var path = filePicker.file.path;
        d.resolve(path);
      }
      else {
        d.reject();
      }
      return d.promise;
    }
  };
})();

exports.OS = (function () {
  let clipboard;
  if (desktop) {
    clipboard = require('sdk/clipboard');
  }
  return {
    clipboard: {
      get: function () {
        return Promise.resolve(clipboard ? clipboard.get() : '');
      }
    }
  };
})();

// Overlay Manager
(function () {
  var windows = [];
  function inject (window) {
    if (window.document.location.href !== 'chrome://mozapps/content/downloads/unknownContentType.xul') {
      return;
    }
    window.document.loadOverlay('chrome://itdmanager/content/overlay.xul', {
      observe: function () {}
    });
    windows.push(window);
  }
  var windowListener = {
    onOpenWindow: function(xulWindow) {
      var window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIDOMWindow);
      function onWindowLoad() {
        window.removeEventListener('load', onWindowLoad);
        inject(window);
      }
      window.addEventListener('load', onWindowLoad);
    },
    onCloseWindow: function(xulWindow) {
      var index = windows.indexOf(xulWindow);
      if (index !== -1) {
        windows.splice(index, 1);
      }
    },
    onWindowTitleChange: function() { }
  };
  Services.wm.addListener(windowListener);
  unload.when(function () {
    Services.wm.removeListener(windowListener);
    windows.forEach(function (window) {
      window.postMessage('detach', '*');
    });
  });
})();

// connect
(function () {
  var connect = {};
  Cu.import(data.url('firefox/shared/connect.jsm'), connect);
  connect.remote.download = function (obj) {
    exports.emit('download', obj);
  };
  Object.freeze(connect);
})();

// manager
exports.manager = (function () {
  var workers = [], content_script_arr = [];
  pageMod.PageMod({
    include: data.url('manager/index.html'),
    contentScriptFile: [data.url('./manager/firefox/firefox.js'), data.url('./manager/index.js')],
    contentScriptWhen: 'ready',
    attachTo: ['top', 'existing'],
    contentScriptOptions: {
      base: data.url('.')
    },
    onAttach: function(worker) {
      array.add(workers, worker);
      worker.on('pageshow', function() { array.add(workers, this); });
      worker.on('pagehide', function() { array.remove(workers, this); });
      worker.on('detach', function() { array.remove(workers, this); });
      content_script_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
  return {
    send: function (id, data) {
      workers.forEach(function (worker) {
        worker.port.emit(id, data);
      });
    },
    receive: function (id, callback) {
      content_script_arr.push([id, callback]);
      workers.forEach(function (worker) {
        worker.port.on(id, callback);
      });
    }
  };
})();

// manager
exports.add = (function () {
  var workers = [], content_script_arr = [];
  pageMod.PageMod({
    include: data.url('add/index.html'),
    contentScriptFile: [data.url('./add/firefox/firefox.js'), data.url('./add/index.js')],
    contentScriptWhen: 'ready',
    attachTo: ['top', 'frame', 'existing'],
    contentScriptOptions: {
      base: data.url('.')
    },
    onAttach: function(worker) {
      array.add(workers, worker);
      worker.on('pageshow', function() { array.add(workers, this); });
      worker.on('pagehide', function() { array.remove(workers, this); });
      worker.on('detach', function() { array.remove(workers, this); });
      content_script_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
  return {
    send: function (id, data) {
      workers.forEach(function (worker) {
        worker.port.emit(id, data);
      });
    },
    receive: function (id, callback) {
      content_script_arr.push([id, callback]);
      workers.forEach(function (worker) {
        worker.port.on(id, callback);
      });
    }
  };
})();

// info
exports.info = (function () {
  var workers = [], content_script_arr = [];
  pageMod.PageMod({
    include: data.url('info/index.html') + '*',
    contentScriptFile: [data.url('./info/firefox/firefox.js'), data.url('./info/index.js')],
    contentScriptWhen: 'ready',
    attachTo: ['top', 'frame', 'existing'],
    contentScriptOptions: {
      base: data.url('.')
    },
    onAttach: function(worker) {
      array.add(workers, worker);
      worker.on('pageshow', function() { array.add(workers, this); });
      worker.on('pagehide', function() { array.remove(workers, this); });
      worker.on('detach', function() { array.remove(workers, this); });
      content_script_arr.forEach(function (arr) {
        worker.port.on(arr[0], arr[1]);
      });
    }
  });
  return {
    send: function (id, data) {
      workers.forEach(function (worker) {
        worker.port.emit(id, data);
      });
    },
    receive: function (id, callback) {
      content_script_arr.push([id, callback]);
      workers.forEach(function (worker) {
        worker.port.on(id, callback);
      });
    }
  };
})();
