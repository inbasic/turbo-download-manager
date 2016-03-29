/* globals CryptoJS, utils */
'use strict';

var app = new utils.EventEmitter();

app.globals = {
  browser: 'opera',
  extension: true
};

app.once('load', function () {
  let script = document.createElement('script');
  document.body.appendChild(script);
  script.src = 'lib/common.js';
});

if (!Promise.defer) {
  Promise.defer = function () {
    let deferred = {};
    let promise = new Promise(function (resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject  = reject;
    });
    deferred.promise = promise;
    return deferred;
  };
}
app.Promise = Promise;
app.XMLHttpRequest = window.XMLHttpRequest;
app.fetch = (url, props) => fetch(url, props);
app.EventEmitter = utils.EventEmitter;
app.timer = window;
app.URL = window.URL;

app.canvas = () => document.createElement('canvas');

app.storage = (function () {
  let objs = {};
  chrome.storage.local.get(null, function (o) {
    objs = o;
    app.emit('load');
  });
  return {
    read: (id) => (objs[id] || !isNaN(objs[id])) ? objs[id] + '' : objs[id],
    write: function (id, data) {
      objs[id] = data;
      var tmp = {};
      tmp[id] = data;
      chrome.storage.local.set(tmp, function () {});
    },
    on: (name, callback) => chrome.storage.onChanged.addListener(function (obj) {
      if (name in obj) {
        callback();
      }
    })
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

app.button = (function () {
  let onCommand;
  chrome.browserAction.onClicked.addListener(function () {
    if (onCommand) {
      onCommand();
    }
  });
  return {
    onCommand: (c) => onCommand = c,
    set icon (path) { // jshint ignore: line
      chrome.browserAction.setIcon({path});
    },
    set label (title) { // jshint ignore: line
      chrome.browserAction.setTitle({title});
    },
    set badge (val) { // jshint ignore: line
      chrome.browserAction.setBadgeText({
        text: (val ? val : '') + ''
      });
    }
  };
})();

app.getURL = (path) => chrome.runtime.getURL('/data/' + path);

app.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      chrome.tabs.update(null, {url});
    }
    else {
      chrome.tabs.create({url, active: typeof inBackground === 'undefined' ? true : !inBackground});
    }
  },
  list: () => new Promise(resolve => chrome.tabs.query({}, tabs => resolve(tabs))),
  reload: function (tab) {
    return new Promise(function (resolve) {
      chrome.tabs.reload(tab.id, {}, () => resolve(tab));
    });
  },
  activate: function (tab) {
    return new Promise(function (resolve) {
      chrome.tabs.update(tab.id, {
        active: true,
        selected: true
      }, () => resolve(tab));
    });
  }
};

app.menu = function (title, ...items) {
  items.forEach(function (arr) {
    chrome.contextMenus.create({
      'title': arr[0],
      'contexts': ['link', 'image', 'video', 'audio'],
      'onclick': (obj) => arr[1]({
        url: obj.srcUrl || obj.linkUrl,
        referrer: obj.pageUrl
      })
    });
  });
};

app.notification = (text) => chrome.notifications.create(null, {
  type: 'basic',
  iconUrl: 'data/icons/48.png',
  title: 'Turbo Download Manager',
  message: text
});

app.version = () => chrome[chrome.runtime && chrome.runtime.getManifest ? 'runtime' : 'extension'].getManifest().version;

app.platform = function () {
  let v1 = /Chrome\/[\d\.]*/.exec(navigator.userAgent);
  let v2 = /OPR\/[\d\.]*/.exec(navigator.userAgent);
  let version = v2 ? v2[0].replace('OPR/', 'OPR ') : v1[0].replace('Chrome/', 'Chrome ');
  return `${version} on ${navigator.platform}`;
};

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

// manager
app.manager = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({
      method: id + '@ui',
      data
    }),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@ui' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

// add
app.add = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({
      method: id + '@ad',
      data
    }),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@ad' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

// info
app.info = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({
      method: id + '@if',
      data
    }),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@if' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

// modify
app.modify = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({
      method: id + '@md',
      data
    }),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@md' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

// triggers
app.triggers = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({
      method: id + '@tr',
      data
    }),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@tr' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

// about
app.about = (function () {
  return {
    send: (id, data) => chrome.runtime.sendMessage({
      method: id + '@ab',
      data
    }),
    receive: (id, callback) => chrome.runtime.onMessage.addListener(function (message, sender) {
      if (id + '@ab' === message.method && sender.url !== document.location.href) {
        callback.call(sender.tab, message.data);
      }
    })
  };
})();

app.File = function (obj) { // {name, path, mime, length}
  let cache = {};
  let toBlob = (function () {
    let blob;
    function b () {
      let arr = [], tmp = [];
      for (let i in cache) {
        tmp.push(i);
      }
      tmp.sort(function (a, b) {
        return a - b;
      });
      tmp.forEach(function (i) {
        arr = arr.concat(cache[i + '']);
      });
      let _blob = new Blob(arr, {
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
  })();

  return {
    open: function () {
      return Promise.resolve();
    },
    write: function (offset, content) {
      cache[offset] = cache[offset] || [];
      content.forEach(view => cache[offset].push(view.buffer));
      return Promise.resolve(true);
    },
    md5: function () {
      if (obj.length > 50 * 1024 * 1024) {
        return Promise.resolve('MD5 calculation is skipped');
      }
      return toBlob()
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
      return toBlob()
      .then(function (blob) {
        let link = document.createElement('a');
        link.download = obj.name;
        link.href = URL.createObjectURL(blob);
        link.dispatchEvent(new MouseEvent('click'));
        return blob.size;
      });
    },
    remove: function () {
      cache = {};
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

app.disk = {
  browse: function () {
    return new Promise(function (resolve, reject) {
      let wins = chrome.app.window.getAll();
      if (wins && wins.length) {
        let win = wins[0].contentWindow;
        win.chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function (folder) {
          chrome.storage.local.set({
            folder: chrome.fileSystem.retainEntry(folder)
          });
          resolve(folder.name);
        });
      }
      else {
        reject();
      }
    });

  }
};

// native downloader
app.download = (obj) => chrome.downloads.download({
  url: obj.url,
  filename: obj.name
});

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

app.play = (src) => {
  let audio = new Audio(chrome.runtime.getURL('/data/' + src));
  audio.play();
};

app.sandbox =  () => Promise.reject();
