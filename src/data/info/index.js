/* globals background, showdown */
'use strict';

var id = /id\=([^\&]+)/.exec(document.location.search);
id = id && id.length ? +id[1] : null;

background.receive('log', function (obj) {
  if (obj.id === id) {
    let converter = new showdown.Converter({
      simplifiedAutoLink: true
    });

    let parent = document.querySelector('#log tbody');

    obj.log.forEach(function (obj) {
      let tr = document.createElement('tr');
      let date = document.createElement('td');
      date.textContent = obj.date;
      tr.appendChild(date);
      let msgParent = document.createElement('td');
      let msg = document.createElement('pre');
      // this is a safe HTML
      msg.innerHTML = converter.makeHtml(obj.log);
      if (obj.properties) {
        if (obj.properties.type === 'error') {
          date.style.color = 'red';
        }
        if (obj.properties.type === 'warning') {
          date.style.color = 'green';
        }
      }

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

  let href = target.href;
  if (href && e.which === 1) { // left click only
    e.preventDefault();
    e.stopPropagation();
    background.send('open', href);
  }
});

if (id !== null) {
  background.send('init', id);
}
