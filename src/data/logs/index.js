/* globals background */
'use strict';

var tbody = document.querySelector('#history tbody');
var ref = document.querySelector('#ref tr');

function bytesToSize(bytes) {
  if (bytes === 0) {
    return '0 Byte';
  }
  let k = 1024;
  let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(i ? 1 : 0) + ' ' + sizes[i];
}

function add (obj, type) {
  let tr = ref.cloneNode(true);
  tr.querySelector('td:nth-child(1)').textContent = type;
  tr.querySelector('td:nth-child(2)').textContent = obj.date;
  tr.querySelector('td:nth-child(3)').textContent = obj.name;
  tr.querySelector('td:nth-child(3)').title = obj.name;
  tr.querySelector('td:nth-child(4)').textContent = bytesToSize(obj.size);
  tr.querySelector('td:nth-child(5)').textContent = obj.urls.join(', ');
  tr.querySelector('td:nth-child(5)').title = obj.urls.join(', ');
  tr.querySelector('td:nth-child(6)').textContent = obj.path;
  tr.querySelector('td:nth-child(6)').title = obj.path;

  tr.dataset.id = obj.id;
  tr.dataset.type = type;
  tr.dataset.url = obj.urls[0];

  console.error(obj, type)

  tbody.appendChild(tr);
}

document.addEventListener('click', (e) => {
  let target = e.target;
  let cmd = target.dataset.cmd;
  if (cmd === 'download') {
    background.send('download', target.closest('tr').dataset.url);
  }
  else if (cmd === 'delete') {
    let tr = target.closest('tr');
    background.send('delete', {
      id: +tr.dataset.id,
      type: tr.dataset.type
    });
    tr.parentNode.removeChild(tr);
  }
  else {
    background.send(cmd);
  }
});

background.receive('init', (obj) => {
  tbody.textContent = '';
  obj.failed.forEach(o => add(o, 'failed'));
  obj.completed.forEach(o => add(o, 'completed'));
});
background.send('init');

// prevent redirection
(function (callback) {
  window.addEventListener('dragover', callback,false);
  window.addEventListener('drop',callback, false);
})(function (e) {
  if (e.target.tagName !== 'INPUT') {
    e.preventDefault();
  }
});
