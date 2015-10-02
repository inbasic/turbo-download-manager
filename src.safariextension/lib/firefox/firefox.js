'use strict';

// Load Firefox based resources
var self          = require('sdk/self'),
    data          = self.data,
    sp            = require('sdk/simple-prefs'),
    prefs         = sp.prefs,
    pageMod       = require('sdk/page-mod'),
    notifications = require('sdk/notifications'),
    tabs          = require('sdk/tabs'),
    timers        = require('sdk/timers'),
    platform      = require('sdk/system').platform,
    array         = require('sdk/util/array'),
    unload        = require('sdk/system/unload'),
    xhr           = require('sdk/net/xhr'),
    {all, defer, race, resolve}  = require('sdk/core/promise'),
    {on, off, once, emit} = require('sdk/event/core'),
    {Ci, Cc, Cu, components}  = require('chrome');

var {Services} = Cu.import('resource://gre/modules/Services.jsm');
var {NetUtil} = Cu.import('resource://gre/modules/NetUtil.jsm');
var {FileUtils} = Cu.import('resource://gre/modules/FileUtils.jsm');

var desktop = ['winnt', 'linux', 'darwin'].indexOf(platform) !== -1;

exports.globals = {
  browser: 'firefox'
};

exports.Promise = {defer, all, race, resolve};
exports.XMLHttpRequest = xhr.XMLHttpRequest;

exports.EventEmitter = function () {
  let tmp = {};
  tmp.on = on.bind(null, tmp);
  tmp.once = once.bind(null, tmp);
  tmp.emit = emit.bind(null, tmp);
  tmp.removeListener = function removeListener (type, listener) {
    off(tmp, type, listener);
  };
  return tmp;
};

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
    for each (var tab in tabs) {
      if (tab.url) {
        temp.push(tab);
      }
    }
    return resolve(temp);
  },
  reload: function (tab) {
    tab.reload();
    return resolve(tab);
  },
  activate: function (tab) {
    tab.activate();
    tab.window.activate();
    return resolve(tab);
  }
};
unload.when(function () {
  exports.tab.list().then(function (tabs) {
    tabs.filter(t => t.url.indexOf(data.url('')) === 0).forEach(t => t.close());
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

  return {
    open: function () {
      file = obj.path ? FileUtils.File(obj.path) : FileUtils.getFile('DfltDwnld', []);
      file.append(obj.name);
      file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
      return file.path;
    },
    write: function (offset, content) {
      let d = defer();
      let ostream = Cc['@mozilla.org/network/file-output-stream;1']
        .createInstance(Ci.nsIFileOutputStream);
      ostream.init(file, 0x08| 0x02, 0, 0);  // 0x08: Create File, 0x02: Write only

      let seekstream = ostream.QueryInterface(Ci.nsISeekableStream);
      seekstream.seek(0x00, offset); // 0x00: Offset is relative to the start of the stream.

      let istream = Cc['@mozilla.org/io/string-input-stream;1']
          .createInstance(Ci.nsIStringInputStream);
      istream.data = content;

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
    remove: function () {
      if (flushed) {
        return;
      }
      try {
        file.remove(true);
      }
      catch (e) {}
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
    attachTo: ['top'],
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
    attachTo: ['top', 'frame'],
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
