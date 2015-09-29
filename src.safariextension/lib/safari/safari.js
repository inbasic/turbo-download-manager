/* globals Q, safari, config, webkitNotifications */
'use strict';

var app = new EventEmitter();
app.globals = {
  browser: 'safari'
};

app.Promise = Q.promise;
app.Promise.defer = Q.defer;

// Eventify
app.eventify = function (obj, event) {
  obj = obj || {};
  event = event && event.on ? event : new EventEmitter();
  var d = app.Promise.defer();
  obj.on = event.on.bind(event);
  obj.once = event.once.bind(event);
  obj.emit = event.emit.bind(event);
  obj.removeListener = event.removeListener.bind(event);
  obj.resolve = d.resolve;
  obj.reject = d.reject;
  function unbind (e) {
    obj.on = obj.once = obj.emit = obj.removeListener = function () {
      console.error('event is dead; promise is either resolved or rejected');
    };
    return e;
  }
  obj.promise = d.promise.then(unbind, unbind);
  return Promise.resolve(obj);
};

app.storage = {
  read: function (id) {
    return safari.extension.settings[id] || null;
  },
  write: function (id, data) {
    safari.extension.settings[id] = data + '';
  }
};

app.get = function (url, headers, data) {
  var xhr = new XMLHttpRequest();
  var d = new app.Promise.defer();
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status >= 400) {
        var e = new Error(xhr.statusText);
        e.status = xhr.status;
        d.reject(e);
      }
      else {
        d.resolve(xhr.responseText);
      }
    }
  };
  xhr.open(data ? 'POST' : 'GET', url, true);
  for (var id in headers) {
    xhr.setRequestHeader(id, headers[id]);
  }
  if (data) {
    var arr = [];
    for (var e in data) {
      arr.push(e + '=' + data[e]);
    }
    data = arr.join('&');
  }
  xhr.send(data ? data : '');
  return d.promise;
};

app.getURL = function (path) {
  return safari.extension.baseURI + 'data/' + path;
};

app.button = (function () {
  var onCommand,
      toolbarItem = safari.extension.toolbarItems[0];
  safari.application.addEventListener('command', function (e) {
    if (e.command === 'toolbarbutton' && onCommand) {
      onCommand();
    }
  }, false);

  return {
    onCommand: function (c) {
      onCommand = c;
    },
    set label (val) { // jshint ignore: line
      toolbarItem.toolTip = val;
    },
    set icon (obj) {  // jshint ignore: line
      toolbarItem.image =
        safari.extension.baseURI + 'data/icons/safari/' +
        (obj.path.indexOf('disabled') === -1 ? 'on' : 'off') +
        '.png';
    },
    set badge (val) { // jshint ignore: line
      toolbarItem.badge = (val ? val : '') + '';
    }
  };
})();

app.popup = (function () {
  var callbacks = {},
    toolbarItem = safari.extension.toolbarItems[0],
    popup = safari.extension.createPopover(
      'popover',
      safari.extension.baseURI + 'data/popup/index.html',
      100,
      100
    );

  safari.application.addEventListener('popover', function () {
    popup.width = config.popup.width;
    popup.height = config.popup.height;
  }, true);

  toolbarItem.popover = popup;
  return {
    show: function () {
      toolbarItem.showPopover();
    },
    hide: function () {
      popup.hide();
    },
    send: function (id, data) {
      popup.contentWindow.background.dispatchMessage(id, data);
    },
    receive: function (id, callback) {
      callbacks[id] = callback;
    },
    dispatchMessage: function (id, data) {
      if (callbacks[id]) {
        callbacks[id](data);
      }
    }
  };
})();

app.tab = {
  open: function (url, inBackground, inCurrent) {
    if (inCurrent) {
      safari.application.activeBrowserWindow.activeTab.url = url;
    }
    else {
      safari.application.activeBrowserWindow.openTab(inBackground ? 'background' : 'foreground').url = url;
    }
  },
  list: function () {
    var wins = safari.application.browserWindows;
    var tabs = wins.map(function (win) {
      return win.tabs;
    });
    tabs = tabs.reduce(function (p, c) {
      return p.concat(c);
    }, []);
    return new app.Promise(function (a) {a(tabs);});
  }
};

app.notification = function (title, text) {
  var notification = webkitNotifications.createNotification(
    safari.extension.baseURI + 'data/icon48.png',  title,  text
  );
  notification.show();
  window.setTimeout(function () {
    notification.cancel();
  }, 5000);
};

app.play = (function () {
  var canPlay = false, audio;
  try {
    audio = new Audio();
    canPlay = audio.canPlayType('audio/mpeg');
  } catch (e) {}
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
  return safari.extension.displayVersion;
};

app.timer = window;

app.contentScript = (function () {
  var callbacks = {};
  safari.application.addEventListener('message', function (e) {
    if (callbacks[e.message.id]) {
      callbacks[e.message.id].call(e.target, e.message.data);
    }
  }, false);
  return {
    send: function (id, data, global) {
      if (global) {
        safari.application.browserWindows.forEach(function (browserWindow) {
          browserWindow.tabs.forEach(function (tab) {
            if (tab.page && tab.url.indexOf('http') === 0) {
              tab.page.dispatchMessage(id, data);
            }
          });
        });
      }
      else if ('page' in this) {
        this.page.dispatchMessage(id, data);
      }
      else {
        var page =  safari.application.activeBrowserWindow.activeTab.page;
        if (page) {
          page.dispatchMessage(id, data);
        }
      }
    },
    receive: function (id, callback) {
      callbacks[id] = callback;
    }
  };
})();

app.contextMenu = (function () {
  var onSelection = [];
  var onPage = [];

  safari.application.addEventListener('contextmenu', function (e) {
    var selected = e.userInfo && 'selectedText' in e.userInfo && e.userInfo.selectedText;

    onPage.forEach(function (arr, i) {
      e.contextMenu.appendContextMenuItem('igtranslator.onPage:' + i, arr[0]);
    });
    if (selected) {
      onSelection.forEach(function (arr, i) {
        e.contextMenu.appendContextMenuItem('igtranslator.onSelection:' + i, arr[0]);
      });
    }
  }, false);
  safari.application.addEventListener('command', function (e) {
    var cmd = e.command;
    if (cmd.indexOf('igtranslator.onPage:') !== -1) {
      var i = parseInt(cmd.substr(20));
      onPage[i][1]();
    }
    if (cmd.indexOf('igtranslator.onSelection:') !== -1) {
      var j = parseInt(cmd.substr(25));
      onSelection[j][1]();
    }
  }, false);

  return {
    create: function (title, type, callback) {
      if (type === 'page') {
        onPage.push([title, callback]);
      }
      if (type === 'selection') {
        onSelection.push([title, callback]);
      }
    }
  };
})();

app.options = (function () {
  var callbacks = {};
  safari.application.addEventListener('message', function (e) {
    if (callbacks[e.message.id]) {
      callbacks[e.message.id](e.message.data);
    }
  }, false);
  return {
    send: function (id, data) {
      safari.application.browserWindows.forEach(function (browserWindow) {
        browserWindow.tabs.forEach(function (tab) {
          if (tab.page && tab.url.indexOf(safari.extension.baseURI + 'data/options/index.html') === 0) {
            tab.page.dispatchMessage(id, data);
          }
        });
      });
    },
    receive: function (id, callback) {
      callbacks[id] = callback;
    }
  };
})();
