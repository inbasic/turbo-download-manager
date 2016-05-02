/* globals app */
'use strict';

/* app.button */
Object.defineProperty(app.button, 'icon', {
  set: function (path) {
    chrome.runtime.sendMessage(app.runtime.id, {cmd: 'setIcon', path});
  }
});
Object.defineProperty(app.button, 'label', {
  set: function (title) {
    chrome.runtime.sendMessage(app.runtime.id, {cmd: 'setTitle', title});
  }
});
Object.defineProperty(app.button, 'badge', {
  set: function (val) {
    chrome.runtime.sendMessage(app.runtime.id, {
      cmd: 'setBadgeText',
      text: (val ? val : '') + ''
    });
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
  chrome.app.runtime.onLaunched.addListener(() => app.runtime.launch());
  let isInstalled = false;
  return {
    id: 'gnaepfhefefonbijmhcmnfjnchlcbnfc',
    get isInstalled () {
      return isInstalled;
    },
    set isInstalled (val) {
      isInstalled = val;
    },
    launch: function () {
      chrome.app.window.create('data/manager/index.html', {
        id: 'tdm-manager',
        bounds: {
          width: 800,
          height: 800
        }
      });
    }
  };
})();
chrome.runtime.sendMessage(app.runtime.id, app.version());
// communication
chrome.runtime.onMessageExternal.addListener(function (request, sender) {
  if (sender.id !== app.runtime.id) {
    return;
  }
  app.runtime.isInstalled = true;
  if (request.cmd === 'version') {
    chrome.runtime.sendMessage(app.runtime.id, app.version());
  }
  if (request.cmd === 'download') {
    app.emit('download', request);
  }
  if (request.cmd === 'open-manager') {
    app.runtime.launch();
  }
});
chrome.runtime.sendMessage(app.runtime.id, {cmd: 'version'});
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
