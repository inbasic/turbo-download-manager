'use strict';

var isSafari = typeof safari !== 'undefined',
    isChrome = typeof chrome !== 'undefined';

function script (src, callback) {
  var head = document.querySelector('head');
  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.src = src;
  s.onload = callback;
  head.appendChild(s);
}

if (isChrome) {
  script('./chrome/chrome.js', function () {
    script('index.js');
  });
}
if (isSafari) {
  script('./safari/safari.js', function () {
    script('index.js');
  });
}
