/* globals CryptoJS, app */
'use strict';

app.globals = {
  browser: navigator.userAgent.indexOf('OPR') === -1 ? 'chrome' : 'opera'
};

app.once('load', function () {
  var script = document.createElement('script');
  document.body.appendChild(script);
  script.src = '../common.js';
});

app.Promise = Promise;
app.XMLHttpRequest = window.XMLHttpRequest;
app.EventEmitter = EventEmitter;

app.storage = (function () {
  var objs = {};
  chrome.storage.local.get(null, function (o) {
    objs = o;
    app.emit('load');
  });
  return {
    read: function (id) {
      return (objs[id] || !isNaN(objs[id])) ? objs[id] + '' : objs[id];
    },
    write: function (id, data) {
      objs[id] = data;
      var tmp = {};
      tmp[id] = data;
      chrome.storage.local.set(tmp, function () {});
    },
    on: function (name, callback) {
      chrome.storage.onChanged.addListener(function (obj) {
        if (name in obj) {
          callback();
        }
      });
    }
  };
})();

app.canvas = function () {
  return document.querySelector('canvas');
};

app.button = (function () {
  var onCommand;
  chrome.browserAction.onClicked.addListener(function () {
    if (onCommand) {
      onCommand();
    }
  });
  return {
    onCommand: function (c) {
      onCommand = c;
    },
    set icon (path) { // jshint ignore: line
      chrome.browserAction.setIcon({
        path: path
      });
    },
    set label (label) { // jshint ignore: line
      chrome.browserAction.setTitle({
        title: label
      });
    },
    set badge (val) { // jshint ignore: line
      chrome.browserAction.setBadgeText({
        text: (val ? val : '') + ''
      });
    }
  };
})();

app.getURL = function (path) {
  return chrome.extension.getURL('/data/' + path);
};

app.popup = {
  send: function (id, data) {
    chrome.extension.sendRequest({method: id, data: data});
  },
  receive: function (id, callback) {
    chrome.extension.onRequest.addListener(function (request, sender) {
      if (request.method === id && !sender.tab) {
        callback(request.data);
      }
    });
  }
};

app.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      chrome.tabs.update(null, {url: url});
    }
    else {
      chrome.tabs.create({
        url: url,
        active: typeof inBackground === 'undefined' ? true : !inBackground
      });
    }
  },
  list: function () {
    return new Promise(function (resolve) {
      chrome.tabs.query({}, function (tabs) {
        resolve(tabs);
      });
    });
  },
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

app.menu = function (title, callback) {
  chrome.contextMenus.create({
    'title': title,
    'contexts': ['link', 'image', 'video', 'audio'],
    'onclick': function (obj) {
      callback({
        url: obj.linkUrl || obj.srcUrl,
        referrer: obj.pageUrl
      });
    }
  });
};

app.notification = function (text) {
  chrome.notifications.create(null, {
    type: 'basic',
    iconUrl: chrome.extension.getURL('./') + 'data/icons/48.png',
    title: 'Turbo Download Manager',
    message: text
  }, function () {});
};

app.play = (function () {
  var audio = new Audio();
  var canPlay = audio.canPlayType('audio/mpeg');
  if (!canPlay) {
    audio = document.createElement('iframe');
    document.body.appendChild(audio);
  }
  return function (url) {
    if (canPlay) {
      audio.setAttribute('src', url);
      audio.play();
    }
    else {
      audio.removeAttribute('src');
      audio.setAttribute('src', url);
    }
  };
})();

app.version = function () {
  return chrome[chrome.runtime && chrome.runtime.getManifest ? 'runtime' : 'extension'].getManifest().version;
};

app.timer = window;

app.options = {
  send: function (id, data) {
    chrome.tabs.query({}, function (tabs) {
      tabs.forEach(function (tab) {
        if (tab.url.indexOf(chrome.extension.getURL('data/options/index.html') === 0)) {
          chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function () {});
        }
      });
    });
  },
  receive: function (id, callback) {
    chrome.runtime.onMessage.addListener(function (message, sender) {
      if (
        message.method === id &&
        sender.tab &&
        sender.tab.url.indexOf(chrome.extension.getURL('data/options/index.html') === 0)
      ) {
        callback.call(sender.tab, message.data);
      }
    });
  }
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

// manager
app.manager = (function () {
  return {
    send: function (id, data) {
      id += '@ui';
      chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
          chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function () {});
        });
      });
    },
    receive: function (id, callback) {
      id += '@ui';
      chrome.runtime.onMessage.addListener(function (message, sender) {
        if (id === message.method) {
          callback.call(sender.tab, message.data);
        }
      });
    }
  };
})();

// add
app.add = (function () {
  return {
    send: function (id, data) {
      id += '@ad';
      chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
          chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function () {});
        });
      });
    },
    receive: function (id, callback) {
      id += '@ad';
      chrome.runtime.onMessage.addListener(function (message, sender) {
        if (id === message.method) {
          callback.call(sender.tab, message.data);
        }
      });
    }
  };
})();

// info
app.info = (function () {
  return {
    send: function (id, data) {
      id += '@if';
      chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
          chrome.tabs.sendMessage(tab.id, {method: id, data: data}, function () {});
        });
      });
    },
    receive: function (id, callback) {
      id += '@if';
      chrome.runtime.onMessage.addListener(function (message, sender) {
        if (id === message.method) {
          callback.call(sender.tab, message.data);
        }
      });
    }
  };
})();
