/* globals background */
'use strict';

document.addEventListener('change', function (e) {
  var target = e.target;
  var tr = target.parentNode.parentNode;
  var id = tr.dataset.id;
  if (id) {
    background.send('change', {
      id,
      enabled: tr.querySelector('td:nth-child(1) input').checked,
      value: tr.querySelector('td:nth-child(3) input').value
    });
  }
}, false);

function update (name, obj) {
  var tr = document.querySelector('[data-id="' + name + '"]');
  if (tr) {
    tr.querySelector('td:nth-child(1) input').checked = obj.enabled;
    if (obj.value) {
      tr.querySelector('td:nth-child(3) input').value = obj.value;
    }
  }
}
background.receive('change', (obj) => update(obj.name, obj.settings));

background.receive('init', function (obj) {
  for (var name in obj) {
    update(name, obj[name]);
  }
});
background.send('init');
