/* globals background */
'use strict';

background.receive('init', function (obj) {
  document.querySelector('[data-id=version]').textContent = obj.version;
  document.querySelector('[data-id=platform]').textContent = obj.platform;
});
background.send('init');

document.addEventListener('click', function (e) {
  let url = e.target.href;
  if (url) {
    e.preventDefault();
    background.send('open', url);
  }
});
