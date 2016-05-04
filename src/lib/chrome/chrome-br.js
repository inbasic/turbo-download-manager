/* globals app */
'use strict';

app.once('load', function () {
  let script = document.createElement('script');
  document.body.appendChild(script);
  script.src = 'lib/common.js';
});
/* app.notification */
app.notification = (text) => chrome.notifications.create(null, {
  type: 'basic',
  iconUrl: 'data/icons/48.png',
  title: 'Turbo Download Manager',
  message: text
});
/* app.OS */
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
/* app.startup */
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
