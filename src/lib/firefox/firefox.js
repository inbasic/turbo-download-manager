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
    xul           = require('sdk/system/xul-app'),
    runtime       = require('sdk/system/runtime'),
    array         = require('sdk/util/array'),
    unload        = require('sdk/system/unload'),
    xpcom         = require('sdk/platform/xpcom'),
    tUtils        = require('sdk/tabs/utils'),
    wUtils        = require('sdk/window/utils'),
    {viewFor}     = require('sdk/view/core'),
    {Page}        = require('sdk/page-worker'),
    {Class}       = require('sdk/core/heritage'),
    {all, defer, race, resolve, reject}  = require('sdk/core/promise'),
    {Ci, Cc, Cu, components}  = require('chrome');

var utils = require('../utils');

var {Services} = Cu.import('resource://gre/modules/Services.jsm');
var {NetUtil} = Cu.import('resource://gre/modules/NetUtil.jsm');
var {FileUtils} = Cu.import('resource://gre/modules/FileUtils.jsm');
var {Downloads} = Cu.import('resource://gre/modules/Downloads.jsm');

var dnldMgr = Cc['@mozilla.org/download-manager;1'].getService(Ci.nsIDownloadManager);

var desktop = ['winnt', 'linux', 'darwin', 'openbsd'].indexOf(platform) !== -1;
var xhr = {
  XMLHttpRequest: function () {
    return Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);
  }
};

exports.globals = {
  browser: 'firefox',
  referrer: true,
  open: true,
  folder: true
};

exports.Promise = function (callback) {
  let d = defer();
  callback(d.resolve, d.reject);
  return d.promise;
};
exports.Promise.defer = defer;
exports.Promise.all = all;
exports.Promise.race = race;
exports.Promise.resolve = resolve;

exports.XMLHttpRequest = xhr.XMLHttpRequest;
exports.URL = urls.URL;

exports.mimes = require('../../data/assets/mime.json');

exports.fetch = function (url, props) {
  let d = defer(), req = new xhr.XMLHttpRequest(), ppp, buffers = [];

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
          ok: req.status >= 200 && req.status < 300,
          get status () {
            return req.status;
          },
          body: {
            getReader: function () {
              return {
                read: function () {
                  let d = defer();
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
  if (props.referrer) {
    req.setRequestHeader('referer', props.referrer);
  }

  req.onprogress = function (e) {
    if (req.response.byteLength) {
      buffers.push({
        value: req.response,
        done: e.loaded === e.total
      });
    }
    resolve();
  };
  req.onload = function () {
    resolve();
  };
  req.ontimeout = () => d.reject(new Error('XMLHttpRequest timeout'));
  req.onerror = () => d.reject(new Error('XMLHttpRequest internal error'));
  req.send();
  return d.promise;
};

exports.EventEmitter = utils.EventEmitter;

// Event Emitter
(function (e) {
  exports.on = e.on.bind(e);
  exports.once = e.once.bind(e);
  exports.emit = e.emit.bind(e);
  exports.removeListener = e.removeListener.bind(e);
})(new utils.EventEmitter());

//startup
exports.startup = function (callback) {
  if (self.loadReason === 'install' || self.loadReason === 'startup') {
    callback();
  }
};

// arguments
exports.arguments = function () {};

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
      label: `Turbo Download Manager (${self.version})`,
      icon: {
        '18': './icons/18.png',
        '36': './icons/36.png'
      },
      onClick: function () {
        if (callback) {
          callback();
        }
      }
    });
  }
  else {
    button = {};
    let window = getNativeWindow();
    id = window.menu.add({
      name: 'Turbo Download Manager',
      parent: window.menu.toolsMenuID,
      callback: function () {
        if (callback) {
          callback();
        }
      }
    });

    unload.when(() => window.menu.remove(id));
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
  read: id => prefs[id],
  write: (id, data) => prefs[id] = data,
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
unload.when(function (e) {
  if (e === 'shutdown') {
    return;
  }
  for (let tab of tabs) {
    if (tab && tab.url && tab.url.startsWith(data.url(''))) {
      tab.close();
    }
  }
});

exports.menu = function (label, ...items) {
  let selector = 'a[href], video, audio, img';
  if (desktop) {
    let contextMenu = require('sdk/context-menu');
    contextMenu.Menu({
      label,
      image: data.url('./icons/32.png'),
      context: contextMenu.SelectorContext(selector),
      items: items.map(arr => contextMenu.Item({
        label: arr[0],
        contentScriptFile: data.url('./firefox/menu.js'),
        onMessage: node => arr[1](node)
      }))
    });
  }
  else {
    let window = Services.wm.getMostRecentWindow('navigator:browser');
    let id = window.NativeWindow.contextmenus.add(
      'Download With Turbo Download Manager',
      window.NativeWindow.contextmenus.SelectorContext(selector),
      (target) => items[0][1](require('../../data/firefox/menu.js').click(target))
    );
    unload.when(() => window.NativeWindow.contextmenus.remove(id));
  }
};

exports.version = () => resolve(self.version);
exports.platform = () => `${xul.name} v.${xul.platformVersion} on ${runtime.OS}`;

exports.timer = timers;

exports.notification = function (text) {
  if (desktop) {
    notifications.notify({
      title: 'Turbo Download Manager',
      text: text,
      iconURL: data.url('icons/32.png')
    });
  }
  else {
    let window = Services.wm.getMostRecentWindow('navigator:browser');
    window.NativeWindow.toast.show(text, 'short');
  }
};

exports.fileSystem = {
  file: {
    exists: function (root, name) {
      let file = root.clone();
      file.append(name);
      return resolve(file.exists());
    },
    create: function (root, name) {
      let file = root.clone();
      file.append(name);
      let d = defer();
      try {
        file.create(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
        d.resolve(file);
      }
      catch (e) {
        d.reject(e);
      }
      return d.promise;
    },
    truncate: () => resolve(),
    write: function (file, offset, arr) {
      let d = defer();
      let ostream = Cc['@mozilla.org/network/file-output-stream;1']
        .createInstance(Ci.nsIFileOutputStream);
      ostream.init(file, 0x08 | 0x02, 0, 0);  // 0x08: Create File, 0x02: Write only
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
        function (status) {
          if (!components.isSuccessCode(status)) {
            d.reject(Error('Segment write error.'));
          }
          d.resolve(true);
        }
      );
      return d.promise;
    },
    md5: function (file) {
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
      let s = Array.from(hash, (c, i) => toHexString(hash.charCodeAt(i))).join('');
      return resolve(s);
    },
    rename: function (file, root, name) {
      let d = defer();
      let dummpy = root.clone();
      dummpy.append(name);
      try {
        file.renameTo(null, name);
        d.resolve(dummpy);
      }
      catch (e) {
        d.reject(e);
      }
      return d.promise;
    },
    remove: function (file) {
      let d = defer();
      try {
        file.remove(false);
        d.resolve();
      }
      catch (e) {
        d.reject(e);
      }
      return d.promise;
    },
    launch: function (file) {
      let d = defer();
      try {
        file.launch();
        d.resolve();
      }
      catch (e) {
        d.reject(e);
      }
      return d.promise;
    },
    reveal: function (file) {
      let d = defer();
      try {
        file.reveal();
        d.resolve();
      }
      catch (e) {
        d.reject(e);
      }
      return d.promise;
    },
    close: () => resolve(),
    toURL: (file) => resolve(Services.io.newFileURI(file).spec)
  },
  root: {
    internal: () => reject(),
    external: function (bytes, path) {
      let d = defer();
      try {
        let root = path ? FileUtils.File(path) : dnldMgr.userDownloadsDirectory;
        if (root.diskSpaceAvailable > bytes) {
          d.resolve(root);
        }
        else {
          d.reject(new Error(`cannot allocate space; available: ${root.diskSpaceAvailable}, required: ${bytes}`));
        }
      }
      catch (e) {
        d.reject(e);
      }
      return d.promise;
    }
  }
};

exports.disk = (function () {
  let filePicker = Cc['@mozilla.org/filepicker;1']
    .createInstance(Ci.nsIFilePicker);
  return {
    browse: function () {
      let d = defer();
      let window = Services.wm.getMostRecentWindow('navigator:browser');
      filePicker.init(window, 'Save in', Ci.nsIFilePicker.modeGetFolder);
      filePicker.appendFilters(Ci.nsIFilePicker.filterAll);
      let pickerStatus = filePicker.show();
      if (pickerStatus === Ci.nsIFilePicker.returnOK || pickerStatus === Ci.nsIFilePicker.returnReplace) {
        d.resolve(filePicker.file.path);
      }
      else {
        d.reject();
      }
      return d.promise;
    }
  };
})();

exports.OS = (function () {
  return {
    clipboard: {
      get: function () {
        if (desktop) {
          let clipboard = require('sdk/clipboard');
          return Promise.resolve(clipboard.get());
        }
        else {
          let clipBoard  = Cc['@mozilla.org/widget/clipboard;1'].getService(Ci.nsIClipboard);
          let transferable = Cc['@mozilla.org/widget/transferable;1'].createInstance(Ci.nsITransferable);
          transferable.addDataFlavor('text/unicode');
          clipBoard.getData(transferable, clipBoard.kGlobalClipboard);
          let flavour = {};
          let data = {};
          let length = {};
          transferable.getAnyTransferData(flavour, data, length);

          return Promise.resolve(data.value.QueryInterface(Ci.nsISupportsString).data);
        }
      }
    }
  };
})();

// Overlay Manager
(function () {
  let windows = [];
  function inject (window) {
    if (window.document.location.href !== 'chrome://mozapps/content/downloads/unknownContentType.xul') {
      return;
    }
    window.document.loadOverlay('chrome://itdmanager/content/overlay.xul', {
      observe: function () {}
    });
    windows.push(window);
  }
  let windowListener = {
    onOpenWindow: function (xulWindow) {
      let window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIDOMWindow);
      function onWindowLoad() {
        window.removeEventListener('load', onWindowLoad);
        inject(window);
      }
      window.addEventListener('load', onWindowLoad);
    },
    onCloseWindow: function (xulWindow) {
      let index = windows.indexOf(xulWindow);
      if (index !== -1) {
        windows.splice(index, 1);
      }
    },
    onWindowTitleChange: function () { }
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

(function (attach) {
  exports.manager = attach(
    data.url('manager/index.html'),
    [data.url('./manager/firefox/firefox.js'), data.url('./manager/index.js')]
  );
  exports.add = attach(
    data.url('add/index.html'),
    [data.url('./add/firefox/firefox.js'), data.url('./add/index.js')]
  );
  exports.info = attach(
    data.url('info/index.html'),
    [data.url('./info/showdown.js'), data.url('./info/firefox/firefox.js'), data.url('./info/index.js')]
  );
  exports.modify = attach(
    data.url('modify/index.html'),
    [data.url('./modify/firefox/firefox.js'), data.url('./modify/index.js')]
  );
  exports.triggers = attach(
    data.url('triggers/index.html'),
    [data.url('./triggers/firefox/firefox.js'), data.url('./triggers/index.js')]
  );
  exports.about = attach(
    data.url('about/index.html'),
    [data.url('./about/firefox/firefox.js'), data.url('./about/index.js')]
  );
  exports.extract = attach(
    data.url('extract/index.html'),
    [data.url('./extract/firefox/firefox.js'), data.url('./extract/index.js')]
  );
  exports.preview = attach(
    data.url('preview/index.html'),
    [data.url('./preview/firefox/firefox.js'), data.url('./preview/index.js')]
  );
  exports.config = attach(
    data.url('config/index.html'),
    [data.url('./config/firefox/firefox.js'), data.url('./config/index.js')]
  );
})(function (include, contentScriptFile) {
  let workers = [], contentScripts = [];
  pageMod.PageMod({
    include: [include, include + '*'],
    contentScriptFile: contentScriptFile,
    contentScriptWhen: 'ready',
    attachTo: ['top', 'existing', 'frame'],
    contentScriptOptions: {
      base: data.url('.')
    },
    onAttach: function (worker) {
      array.add(workers, worker);
      worker.on('pageshow', function () {
        array.add(workers, this);
      });
      worker.on('pagehide', function () {
        array.remove(workers, this);
      });
      worker.on('detach', function () {
        array.remove(workers, this);
      });
      contentScripts.forEach(function (arr) {
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
      contentScripts.push([id, callback]);
      workers.forEach(function (worker) {
        worker.port.on(id, callback);
      });
    }
  };
});

// native downloader
exports.download = function (obj) {
  let target = obj.path ? FileUtils.File(obj.path) : dnldMgr.userDownloadsDirectory;
  target.append(obj.name || 'undefined'); // if obj.name is undefined then root folder is considered as file name
  target.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
  return Downloads.getList(Downloads.ALL).then(function (list) {
    return Downloads.createDownload({
      source: obj.url,
      target,
    }).then(function (download) {
      list.add(download);
      download.start();
    });
  });
};

// sound
exports.play = function (src) {
  let page = require('sdk/page-worker').Page({
    contentScript: 'let sound = new Audio(self.options.url);' +
      'sound.addEventListener("ended", self.postMessage);' +
      'sound.play();',
    contentScriptOptions: {
      url: self.data.url(src)
    },
    contentURL: self.data.url('firefox/sound.html'),
    onMessage: () => page.destroy()
  });
};

// sandbox
exports.sandbox = (function () {
  let callbacks = [];
  let categoryManager = Cc['@mozilla.org/categorymanager;1']
    .getService(Ci.nsICategoryManager);
  let Interceptor = new Class({
    extends:  xpcom.Unknown,
    interfaces: ['nsIContentPolicy'],

    shouldLoad : function (contentType, contentLocation, requestOrigin) {
      if (!requestOrigin || !contentLocation || contentType !== Ci.nsIContentPolicy.TYPE_DOCUMENT) {
        return Ci.nsIContentPolicy.ACCEPT;
      }
      callbacks.filter(c => c.spec === requestOrigin.spec)
        .forEach(o => o.callback(contentLocation.spec));

      return Ci.nsIContentPolicy.ACCEPT;
    },
    shouldProcess: () => Ci.nsIContentPolicy.ACCEPT
  });
  let factory = xpcom.Factory({
    contract: `@add0n.com/tdm;${Math.random()}`,
    Component: Interceptor,
    unregister: false
  });
  categoryManager.addCategoryEntry('content-policy', factory.contract, factory.contract, false, true);
  unload.when(function () {
    categoryManager.deleteCategoryEntry('content-policy', factory.contract, factory.contract, false, true);
  });

  return function (contentURL, options) {
    let d = defer(), id, spec = contentURL;
    let obj = {
      get spec () {
        return spec;
      },
      callback: destroy
    };
    callbacks.push(obj);
    let page = new Page({
      contentURL,
      contentScriptFile: self.data.url('firefox/redirect.js'),
      contentScriptWhen: 'start'
    });
    page.port.on('url', url => spec = url);
    function destroy (url) {  // jshint ignore:line
      if (page) {
        page.destroy();
        page = null;
      }
      let index = callbacks.indexOf(obj);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
      d[url ? 'resolve' : 'reject'](url);
      timers.clearTimeout(id);
    }
    id = timers.setTimeout(destroy, options['no-response'], null);

    page.port.once('redirect', function (url) {
      d.resolve(url);
      timers.clearTimeout(id);
      page.destroy();
    });

    return d.promise;
  };
})();
/*
var {WebRequest} = Cu.import('resource://gre/modules/WebRequest.jsm');
exports.webRequest = (function () {
  let ids = [];
  let callbacks = {
    media: function () {}
  };

  tabs.on('ready', function (tab) {
    if (tab.url === self.data.url('manager/index.html')) {
      let win = tUtils.getTabContentWindow(viewFor(tab));
      if (win) {
        let id = wUtils.getOuterId(win);
        if (id) {
          ids.push(id);
        }
      }
    }
  });
  tabs.on('close', function (tab) {
    if (tab.url === self.data.url('manager/index.html')) {
      ids = [];
    }
  });

  function logURL(e) {
    if (ids.indexOf(e.parentWindowId) === -1) {
      return;
    }
    if (e.type === 'sub_frame' || e.type === 'main_frame') {
      ids.push(e.windowId);
    }
    if (e.url.startsWith('http') && (e.type === 'image')) {
      callbacks.media({
        url: e.url,
        type: e.type
      });
    }
  }
  WebRequest.onBeforeRequest.addListener(logURL);
  unload.when(() => WebRequest.onBeforeRequest.removeListener(logURL));

  return {
    media: (c) => callbacks.media = c
  };
})();
*/
