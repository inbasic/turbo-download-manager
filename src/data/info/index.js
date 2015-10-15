/* globals background */
'use strict';

var id = /id\=([^\&]+)/.exec(document.location.search);
id = id && id.length ? +id[1] : null;

background.receive('log', function (obj) {
  if (obj.id === id) {
    let parent = document.querySelector('#log tbody');

    obj.log.forEach(function (obj) {
      let tr = document.createElement('tr');
      let date = document.createElement('td');
      date.textContent = obj.date;
      tr.appendChild(date);
      let msgParent = document.createElement('td');
      let msg = document.createElement('pre');
      msg.textContent = obj.log;
      msgParent.appendChild(msg);
      tr.appendChild(msgParent);
      parent.appendChild(tr);
    });
  }
});

background.receive('status', function (obj) {
  if (obj.id === id) {
    document.body.dataset.status = obj.status;
  }
});

document.addEventListener('click', function (e) {
  let target = e.target;
  let cmd = target.dataset.cmd;

  if (cmd) {
    if (cmd === 'remove') {
      let rtn = window.confirm('File will be removed permanently. Proceed?');
      if (!rtn) {
        return;
      }
    }
    background.send('cmd', {
      cmd: cmd,
      id: id
    });
  }
});

if (id !== null) {
  background.send('init', id);
}
