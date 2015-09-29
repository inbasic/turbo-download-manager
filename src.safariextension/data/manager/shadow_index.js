'use strict';

var isSafari = typeof safari !== 'undefined';
var isChrome = typeof chrome !== 'undefined';

function add (url, callback) {
  var head = document.querySelector('head');
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = url;
  script.onload = callback;
  head.appendChild(script);
}

if (isChrome) {
  add('chrome/chrome.js', function () {
    add('index.js');
  });
}
if (isSafari) {
  add('safari/safari.js', function () {
    add('index.js');
  });
}
