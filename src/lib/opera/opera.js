/* globals app, CryptoJS, utils */
'use strict';

/* app.globals */
app.globals.browser = 'opera';
app.globals.extension = true;
app.globals.folder = false;
/* app.canvas */
app.canvas = () => document.createElement('canvas');
/* app.button */
app.button.onCommand = (function () {
  let onCommand;
  chrome.browserAction.onClicked.addListener(function () {
    if (onCommand) {
      onCommand();
    }
  });
  return (c) => onCommand = c;
})();
Object.defineProperty(app.button, 'icon', {
  set: function (path) {
    chrome.browserAction.setIcon({path});
  }
});
Object.defineProperty(app.button, 'label', {
  set: function (title) {
    chrome.browserAction.setTitle({title});
  }
});
Object.defineProperty(app.button, 'badge', {
  set: function (val) {
    chrome.browserAction.setBadgeText({
      text: (val ? val : '') + ''
    });
  }
});
/* app.tab */
app.tab.open = function (url, inBackground, inCurrent) {
  if (inCurrent) {
    chrome.tabs.update(null, {url});
  }
  else {
    chrome.tabs.create({url, active: typeof inBackground === 'undefined' ? true : !inBackground});
  }
};
app.tab.list = () => new Promise(resolve => chrome.tabs.query({}, tabs => resolve(tabs)));
app.tab.reload = function (tab) {
  return new Promise(resolve => chrome.tabs.reload(tab.id, {}, () => resolve(tab)));
};
app.tab.activate = function (tab) {
  return new Promise(function (resolve) {
    chrome.tabs.update(tab.id, {
      active: true,
      selected: true
    }, () => resolve(tab));
  });
};
/* app.menu */
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
/* app.platform */
app.platform = function () {
  let v2 = /OPR\/[\d\.]*/.exec(navigator.userAgent);
  let version = v2[0].replace('OPR/', 'OPR ');
  return `${version} on ${navigator.platform}`;
};
/* app.download */
app.download = (obj) => chrome.downloads.download({
  url: obj.url,
  filename: obj.name
});
/* app.sandbox */
app.sandbox =  () => Promise.reject();
