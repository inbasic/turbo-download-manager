/* globals background, manifest */
'use strict';

var id = /id\=([^\&]+)/.exec(document.location.search);
id = id && id.length ? +id[1] : null;

document.querySelector('form').addEventListener('submit', function (e) {
  background.send('modified', {
    id: id,
    url: document.querySelector('[data-id=url]').value,
    name: document.querySelector('[data-id=name]').value,
    timeout: +document.querySelector('[data-id=timeout]').value,
    threads: +document.querySelector('[data-id=threads]').value
  });
  e.preventDefault();
  e.stopPropagation();
  return true;
});
background.receive('init', function (obj) {
  for (let name in obj) {
    let elem = document.querySelector('[data-id="' + name + '"]');
    if (elem && obj[name]) {
      elem.value = obj[name];
    }
  }
});
background.send('init', id);
// autofocus is not working on Firefox
window.setTimeout(() => document.querySelector('[data-id=url]').focus(), 500);
