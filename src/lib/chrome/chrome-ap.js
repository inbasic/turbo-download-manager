/* globals app, icon */
'use strict';

/* app.button */
Object.defineProperty(app.button, 'icon', {
  set: function (path) {
    app.runtime.ids.forEach(id => chrome.runtime.sendMessage(id, {cmd: 'setIcon', path}));
  }
});
Object.defineProperty(app.button, 'label', {
  set: function (title) {
    app.runtime.ids.forEach(id => chrome.runtime.sendMessage(id, {cmd: 'setTitle', title}));
  }
});
Object.defineProperty(app.button, 'badge', {
  set: function (val) {
    app.runtime.ids.forEach(id => chrome.runtime.sendMessage(id, {
      cmd: 'setBadgeText',
      text: (val ? val : '') + ''
    }));
  }
});
/* app.tab */
app.tab.open = (url) => chrome.browser.openTab({url});
/* app.platform */
app.platform = function () {
  let v1 = /Chrome\/[\d\.]*/.exec(navigator.userAgent);
  let version = v1[0].replace('Chrome/', 'Chrome ');
  return `${version} on ${navigator.platform}`;
};
/* app.runtime */
app.runtime = (function () {
  let ids = [];
  chrome.app.runtime.onLaunched.addListener(() => app.runtime.launch());

  app.manager.receive('chrome:exit', function () {
    chrome.app.window.getAll()[0].close();
    app.runtime.suspend.release();
  });

  function listen () {
    app.runtime.launch(function () {
      window.setTimeout(() => app.manager.send('confirm', {
        msg: 'Turbo Download Manager was about to be suspended. There are still some unfinished jobs that cannot be resumed after suspension. Are you sure you want to close the manager?',
        cmd: 'chrome:exit'
      }), 1000);
    });
  }

  return {
    launch: function (callback) {
      chrome.app.window.create('data/manager/index.html', {
        id: 'tdm-manager',
        bounds: {
          width: 800,
          height: 700
        }
      }, callback);
    },
    suspend: {
      watch: () => chrome.runtime.onSuspend.addListener(listen),
      release: () => chrome.runtime.onSuspend.removeListener(listen)
    },
    register: (id) => {
      ids.push(id);
      ids = ids.filter((o, i, l) => l.indexOf(o) === i);
    },
    get ids () {
      return ids;
    }
  };
})();

// communication
app.arguments = (function () {
  let callbacks = [];
  let requests = [];
  chrome.runtime.onMessageExternal.addListener(function (request, sender) {
    if (request.cmd === 'register') {
      app.runtime.register(sender.id);
      if (request.support && request.support.indexOf('icon') !== -1) {
        // allow icon module to generate icons
        app.canvas = () => document.createElement('canvas');
        icon.register();
      }
    }
    else {
      if (callbacks.length) {
        callbacks.forEach(c => c(request));
      }
      else {
        requests.push(request);
      }
    }
  });
  // request helper extension to register itself (other applications need to request registration)
  chrome.runtime.sendMessage('gnaepfhefefonbijmhcmnfjnchlcbnfc', {cmd: 'register'});

  return function (c) {
    callbacks.push(c);
    requests.forEach(request => c(request));
    requests = [];
  };
})();
/* app.download */
app.download = function (obj) {
  let a = document.createElement('a');
  a.href = obj.url;
  a.download = obj.name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
};
/* app.sandbox */
app.sandbox = function (url, options) {
  let d = Promise.defer();
  let webview = document.createElement('webview');
  document.body.appendChild(webview);

  function destroy () {
    if (webview) {
      webview.parentNode.removeChild(webview);
      webview = null;
    }
  }

  let id = window.setTimeout(d.reject, options['no-response'], null);
  webview.addEventListener('permissionrequest', function (e) {
    if (e.permission === 'download') {
      window.clearTimeout(id);
      destroy();
      d.resolve(e.request.url);
      e.request.deny();
    }
  });
  webview.src = url;

  return d.promise;
};
