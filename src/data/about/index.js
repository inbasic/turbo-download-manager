/* globals background */
'use strict';

/* generating links */
background.receive('latest', function (latest) {
  if (latest && latest.assets && latest.assets.length) {
    latest.assets.forEach(function (obj) {
      let elem = document.querySelector(`[data-prerelease="${obj.name}"]`);
      if (elem) {
        elem.setAttribute('href', obj.browser_download_url);
      }
    });
  }
});
background.receive('release', function (latest) {
  if (latest) {
    latest.assets.forEach(function (obj) {
      let elem = document.querySelector(`[data-release="${obj.name}"]`);
      if (elem) {
        elem.setAttribute('href', obj.browser_download_url);
      }
    });
  }
});
background.receive('init', function (obj) {
  document.querySelector('[data-id=version]').textContent = obj.version;
  document.querySelector('[data-id=platform]').textContent = obj.platform;
});
background.send('init');

document.addEventListener('click', function (e) {
  let url = e.target.href;
  if (url && e.which === 1) {
    e.preventDefault();
    background.send('open', url);
  }
});
// prevent redirection
(function (callback) {
  window.addEventListener('dragover', callback,false);
  window.addEventListener('drop',callback, false);
})(function (e) {
  if (e.target.tagName !== 'INPUT') {
    e.preventDefault();
  }
});
