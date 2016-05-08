/* globals background, manifest */
'use strict';

document.querySelector('form').addEventListener('submit', function (e) {
  let folder = document.querySelector('[data-id=folder]').value;
  if (!folder && manifest.folder) {
    return background.send('no-folder');
  }
  background.send('download', {
    url: document.querySelector('[data-id=url]').value,
    referrer: document.querySelector('[data-id=referrer]').value,
    alternatives: [].map.call(document.querySelectorAll('[data-id=alternative'), e => e.value),
    name: document.querySelector('[data-id=name]').value,
    description: document.querySelector('[data-id=description]').value,
    timeout: +document.querySelector('[data-id=timeout]').value,
    threads: +document.querySelector('[data-id=threads]').value,
    folder: document.querySelector('[data-id=folder]').value,
    'auto-pause': document.querySelector('[data-id="auto-pause"]').checked,
    'use-native': document.querySelector('[data-id="use-native"]').checked
  });
  e.preventDefault();
  e.stopPropagation();
  return true;
});

document.querySelector('[data-id=url]').addEventListener('keyup', function () {
  let length = this.value.split(/\s*\,\s*/).length;
  document.body.dataset.batch = length > 1;
});

background.receive('folder', function (folder) {
  document.querySelector('[data-id=folder]').value = folder;
});

document.addEventListener('click', function (e) {
  let target = e.target;
  let cmd = target.dataset.cmd;
  if (cmd) {
    background.send('cmd', {cmd});
    if (cmd === 'empty') {
      document.querySelector('[data-id=folder]').value = '';
    }
    if (cmd === 'plus') {
      let parent = document.querySelector('#t2 tbody');
      let tr = parent.querySelector('tr:nth-child(2)').cloneNode(true);
      parent.appendChild(tr);
      tr.querySelector('input').focus();
    }
    if (cmd === 'minus') {
      let tr = target.parentNode.parentNode;
      tr.parentNode.removeChild(tr);
    }
  }
});

background.receive('init', function (obj) {
  for (let name in obj.settings) {
    let elem = document.querySelector('[data-id="' + name + '"]');
    if (elem && obj.settings[name]) {
      elem.value = obj.settings[name];
    }
  }
  document.querySelector('[data-id=url]').value = obj.clipboard;
  let e = document.createEvent('HTMLEvents');
  e.initEvent('keyup', false, true);
  document.querySelector('[data-id=url]').dispatchEvent(e);
});
background.send('init');
// autofocus is not working on Firefox
window.setTimeout(() => document.querySelector('[data-id=url]').focus(), 500);
//
document.body.dataset.support = manifest.support;
document.body.dataset.sandbox = manifest.sandbox;
if (manifest.referrer) {
  let input = document.querySelector('[data-id=referrer]');
  input.disabled = false;
  input.placeholder = 'http(s)://the-referring-page';
}
