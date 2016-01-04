/* globals background, manifest */
'use strict';

document.querySelector('form').addEventListener('submit', function (e) {
  let folder = document.querySelector('[data-id=folder]').value;
  if (!folder && manifest.support) {
    return background.send('no-folder');
  }
  background.send('download', {
    url: document.querySelector('[data-id=url]').value,
    name: document.querySelector('[data-id=name]').value,
    description: document.querySelector('[data-id=description]').value,
    timeout: +document.querySelector('[data-id=timeout]').value,
    threads: +document.querySelector('[data-id=threads]').value,
    folder: document.querySelector('[data-id=folder]').value
  });
  e.preventDefault();
  e.stopPropagation();
  return true;
});

background.receive('folder', function (folder) {
  document.querySelector('[data-id=folder]').value = folder;
});

[].forEach.call(document.querySelectorAll('[data-cmd]'), function (elem) {
  elem.addEventListener('click', function () {
    background.send('cmd', {
      cmd: elem.dataset.cmd
    });
    if (elem.dataset.cmd === 'empty') {
      document.querySelector('[data-id=folder]').value = '';
    }
  });
});

background.receive('init', function (obj) {
  for (let name in obj.settings) {
    let elem = document.querySelector('[data-id="' + name + '"]');
    if (elem && obj.settings[name]) {
      elem.value = obj.settings[name];
    }
  }
  document.querySelector('[data-id=url]').value = obj.clipboard;
});
background.send('init');
// autofocus is not working on Firefox
window.setTimeout(() => document.querySelector('[data-id=url]').focus(), 500);
