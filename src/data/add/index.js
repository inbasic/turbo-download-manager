/* globals background */
'use strict';
document.querySelector('#add input[type=button]').addEventListener('click', function () {
  background.send('download', {
    url: document.querySelector('[data-id=url]').value,
    description: document.querySelector('[data-id=description]').value,
    timeout: +document.querySelector('[data-id=timeout]').value,
    threads: +document.querySelector('[data-id=threads]').value,
    folder: document.querySelector('[data-id=folder]').value
  });
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
  for (let name in obj) {
    let elem = document.querySelector('[data-id="' + name + '"]');
    if (elem && obj[name]) {
      elem.value = obj[name];
    }
  }
});
background.send('init');
