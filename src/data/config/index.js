/* globals background */
'use strict';

(function (search) {
  function filter (e) {
    Array.from(document.querySelectorAll('tbody tr')).forEach(function (tr) {
      if (e.target.value && tr.textContent.indexOf(e.target.value) === -1) {
        tr.classList.add('hide');
      }
      else {
        tr.classList.remove('hide');
      }
    });
  }
  search.addEventListener('input', filter, false);
})(document.getElementById('search'));

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
    parent.querySelector('[data-id=description]').textContent = target.title;
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
    document.getElementById('reset').disabled = false;
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
document.getElementById('reset').addEventListener('click',
  () => background.send('reset', document.querySelector('.selected').dataset.name)
);

background.receive('pref', function (obj) {
  let tr = document.querySelector(`[data-name="${obj.name}"]`);
  if (tr) {
    tr.dataset.value = tr.querySelectorAll('td')[2].textContent = obj.value;
  }
});
background.receive('init', function (list) {
  list
  .filter(obj => ['string', 'boolean', 'number'].indexOf(obj.type) !== -1)
  .filter(obj => !obj.name.startsWith('defaults.') && !obj.name.startsWith('titles.'))
  .sort((a, b) => a.name < b.name ? -1 : +1)
  .forEach(function (obj) {
    let tr = document.createElement('tr');
    let td1 = document.createElement('td');
    let td2 = document.createElement('td');
    let td3 = document.createElement('td');
    tr.dataset.name = td1.textContent = obj.name;
    tr.dataset.type = td2.textContent = obj.type;
    tr.dataset.value = td3.textContent = obj.value;
    tr.title = obj.title;
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    document.querySelector('tbody').appendChild(tr);
  });
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
