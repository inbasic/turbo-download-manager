/* globals background, manifest */
'use strict';

var urls = {};
var home = /url\=([^\&]+)/.exec(document.location.search);
if (home && home.length) {
  home = decodeURIComponent(home[1]);
}

background.receive('media', function (obj) {
  if (urls[obj.url]) {
    return;
  }
  let elements = document.getElementById('elements');
  var element = elements.querySelector('div').cloneNode(true);

  urls[obj.url] = {
    type: obj.type,
    element: element
  };

  elements.appendChild(element);
  element.style.display = 'inline-flex';

  let req = new XMLHttpRequest();
  req.open('GET', obj.url);
  req.responseType = 'blob';
  req.onload = function (element) {
    let reader = new FileReader();
    reader.onload = function () {
      element.style['background-image'] = `url(${reader.result})`;
    };
    reader.readAsDataURL(req.response);
  }.bind(this, element);
  req.onerror = function () {
    console.error('error loading image');
  };
  req.send();
});

function clear () {
  let iframe = top.document.getElementById('media-webview');
  if (iframe) {
    iframe.parentNode.removeChild(iframe);
  }
}

if (home) {
  let iframe;
  clear();
  if (manifest.iframe === 'iframe') {
    iframe = top.document.createElement('iframe');
  }
  else {
    iframe = top.document.createElement('webview');
    (function (callback) {
      iframe.addEventListener('loadcommit', callback);
      iframe.addEventListener('load-commit', callback);
    })(function (e) {
      // chrome
      if (e.isTopLevel) {
        iframe.request.onBeforeRequest.addListener(function (e) {
          if (e.type === 'image') {
            background.send('media', {
              url: e.url,
              type: e.type
            });
          }
        }, {urls: ['<all_urls>']});
      }
      // electron
      if (e.isMainFrame) {
        iframe.addEventListener('did-get-response-details', function (e) {
          if (e.resourceType === 'image') {
            background.send('media', {
              url: e.originalURL,
              type: e.resourceType
            });
          }
        }.bind(this));
      }
    });
  }
  iframe.setAttribute('id', 'media-webview');
  top.document.body.appendChild(iframe);
  iframe.setAttribute('src', home);
}
