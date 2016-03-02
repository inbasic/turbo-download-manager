'use strict';

var ipcRenderer = require('electron').ipcRenderer;

var background = {  // jshint ignore:line
  receive: (id, callback) => ipcRenderer.on(id + '@ui', function (event, arg) {
    if (arg && arg.url === 'background.html') {
      callback(arg.data);
    }
  }),
  send: (id, data) => ipcRenderer.send(id + '@ui', {
    url: 'manager/index.html',
    data
  })
};
// internals
ipcRenderer.on('_notification', (event, body) => new Notification('Turbo Download Manager', {
  body,
  icon: '../icons/128.png'
}));
ipcRenderer.on('_sound', (event, src) => {
  let audio = new Audio('../' + src);
  audio.play();
});
ipcRenderer.on('_sandbox', (event, obj) => {
  let webview = document.createElement('webview');
  webview.setAttribute('style', 'visibility: hidden; display:inline-block; max-height: 20px; max-width: 20px;');
  document.body.appendChild(webview);
  function destroy (url, mm) {
    console.error(mm);
    if (webview) {
      webview.parentNode.removeChild(webview);
      webview = null;
    }
    ipcRenderer.send('_sandbox', {
      id: obj.id,
      url
    });
  }
  let id = window.setTimeout(destroy, obj.options['no-response']);
  webview.addEventListener('did-get-redirect-request', function (e) {
    if (e.isMainFrame) {
      window.clearTimeout(id);
      destroy(e.newURL);
    }
  });
  webview.addEventListener('crashed', () => destroy(null, 2));
  webview.src = obj.url;
});
