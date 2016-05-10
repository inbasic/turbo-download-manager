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
/* generating links */
(function () {
  let req = new XMLHttpRequest();
  req.open('GET', 'https://api.github.com/repos/inbasic/turbo-download-manager/releases', true);
  req.responseType = 'json';
  req.onload = function () {
    try {
      let latest = req.response[0];
      latest.assets.forEach(function (obj) {
        let elem = document.querySelector(`[data-prerelease="${obj.name}"]`);
        if (elem) {
          elem.setAttribute('href', obj.browser_download_url);
          elem.textContent = 'Link';
        }
      });
      latest = req.response.filter(obj => obj.prerelease = false);
      if (latest && latest.length) {
        latest = latest[0];
        latest.assets.forEach(function (obj) {
          let elem = document.querySelector(`[data-release="${obj.name}"]`);
          if (elem) {
            elem.setAttribute('href', obj.browser_download_url);
            elem.textContent = 'Link';
          }
        });
      }
    }
    catch (e) {}
  };
  req.send();
})();
