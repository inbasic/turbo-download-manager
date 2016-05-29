/* globals background */
'use strict';

var edit = (function () {
  let parent = document.getElementById('edit');
  let input = parent.querySelector('[data-id=value]');
  let name, type;

  parent.addEventListener('click', function (e) {
    if (this === e.target) {
      parent.style.display = 'none';
    }
  }, false);
  document.addEventListener('keyup', function (e) {
    if (e.keyCode === 27) {
      parent.style.display = 'none';
    }
  }, false);
  parent.querySelector('form').addEventListener('submit', function (e) {
    background.send('pref', {
      name,
      value: type === 'number' ? +input.value : input.value
    });
    parent.style.display = 'none';
    e.preventDefault();
    e.stopPropagation();
    return true;
  });
  parent.querySelector('[data-id=cancel]').addEventListener('click', function () {
    parent.style.display = 'none';
  });
  return function (target) {
    if (parent.style.display === 'flex') {
      return;
    }
    type = parent.querySelector('[data-id=type]').textContent = target.dataset.type;
    name = parent.querySelector('[data-id=name]').textContent = target.dataset.name;
    input.value = target.dataset.value;
    input.type = target.dataset.type === 'number' ? 'number' : 'text';
    parent.style.display = 'flex';
    input.focus();
    input.select();
  };
})();

document.addEventListener('click', function (e) {
  let target = e.target.parentNode;
  if (target.localName === 'tr') {
    let selected = document.querySelector('.selected');
    if (selected) {
      selected.classList.remove('selected');
    }
    target.classList.add('selected');
    document.getElementById('open-editor').disabled = false;
  }
});

(function (callback) {
  document.addEventListener('dblclick', (e) => callback(e.target.parentNode));
  document.getElementById('open-editor').addEventListener('click',
    () => callback(document.querySelector('.selected'))
  );
  document.addEventListener('keypress', function (e) {
    if (e.keyCode === 13) {
      let selected = document.querySelector('.selected');
      if (selected) {
        callback(selected);
      }
    }
  });

})(function (target) {
  if (target.localName === 'tr') {
    if (target.dataset.type === 'boolean') {
      background.send('pref', {
        name: target.dataset.name,
        value: target.dataset.value === 'false' ? true : false
      });
    }
    else {
      edit(target);
    }
  }
});

background.receive('pref', function (obj) {
  let tr = document.querySelector(`[data-name="${obj.name}"]`);
  if (tr) {
    tr.dataset.value = tr.querySelectorAll('td')[2].textContent = obj.value;
  }
});
background.receive('init', function (list) {
  list
  .filter(obj => ['string', 'boolean', 'number'].indexOf(obj.type) !== -1)
  .filter(obj => !obj.name.startsWith('defaults.'))
  .sort((a, b) => a.name < b.name ? -1 : +1)
  .forEach(function (obj) {
    let tr = document.createElement('tr');
    let td1 = document.createElement('td');
    let td2 = document.createElement('td');
    let td3 = document.createElement('td');
    tr.dataset.name = td1.textContent = obj.name;
    tr.dataset.type = td2.textContent = obj.type;
    tr.dataset.value = td3.textContent = obj.value;
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    document.querySelector('tbody').appendChild(tr);
  });
});
background.send('init');
