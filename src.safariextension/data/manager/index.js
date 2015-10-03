/* globals background */
'use strict';

function bytesToSize(bytes) {
  if (bytes === 0) {
    return '0 Byte';
  }
  var k = 1024;
  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(i ? 1 : 0) + ' ' + sizes[i];
}
// menu
(function (button, menu) {
  // clear
  function clear (list) {
    list.forEach(function (item) {
      item.querySelector('[data-cmd=trash]').click();
    });
  }
  button.addEventListener('click', function () {
    button.dataset.toggle = button.dataset.toggle === 'open' ? 'close' : 'open';
  });
  menu.addEventListener('click', function (e) {
    let target = e.target;
    let role = target.dataset.role;
    if (role === 'done' || role === 'error') {
      let items = document.querySelectorAll('.item');
      clear([].filter.call(items, i => i.dataset.type === role));
    }
    else {
      background.send('open', role);
    }
  });
  document.addEventListener('click', function (e) {
    if (!button.contains(e.target)) {
      button.dataset.toggle = 'close';
    }
  });
})(document.querySelector('#menu div[data-role=button]'), document.querySelector('#menu ul'));

// toolbar
var toolbar = (function (search) {
  // filter
  function filter (e) {
    let items = document.querySelectorAll('.item');
    if (e.target.value) {
      [].forEach.call(items, function (item) {
        let name = get(item.dataset.id).name;
        item.dataset.filtered = name && name.indexOf(e.target.value) !== -1 ? false : true;
      });
    }
    else {
      [].forEach.call(items, i => i.dataset.filtered = false);
    }
  }
  search.addEventListener('input', filter);
  return {
    set search (value) {
      search.value = value;
      search.dispatchEvent(new Event('input'));
    }
  };
})(document.querySelector('#toolbar input[type=search]'));

// items
var get = function (id) {
  var parent = document.querySelector('.item[data-id="' + id + '"]');
  if (!parent) {
    return null;
  }
  var overal = parent.querySelector('[data-type=overal]>div');
  var percent = parent.querySelector('[data-type=percent]');
  var size = parent.querySelector('[data-type=size]');
  var name = parent.querySelector('[data-type=name]');
  var threads = parent.querySelector('[data-type=threads]');

  return {
    set percent (p) { // jshint ignore: line
      overal.style.width = p + '%';
      percent.textContent = p.toFixed(1) + '%';
    },
    set size (s) { // jshint ignore: line
      size.textContent = bytesToSize(s);
    },
    get name () {
      return name.textContent;
    },
    set name (n) {
      name.textContent = n;
    },
    set threads (n) { // jshint ignore: line
      threads.textContent = n;
    },
    partial: function (id, offset, percent, color) {
      var holder = parent.querySelector('[data-type=partial]');
      var item = holder.querySelector('div[data-id="' + id + '"');
      if (!item) {
        item = document.createElement('div');
        holder.appendChild(item);
        item.dataset.id = id;
      }
      item.style.left = offset + '%';
      item.style.width = percent + '%';
      item.style.backgroundColor = color;
    },
    set status (val) { // jshint ignore: line
      parent.dataset.type = val;
    }
  };
};
// add
(function (add, loader, iframe) {
  add.addEventListener('click', function () {
    loader.dataset.visible = true;
    iframe.src = '../add/index.html';
  });
  loader.addEventListener('click', function (e) {
    if (!iframe.contains(e.target)) {
      loader.dataset.visible = false;
    }
  });
  background.receive('hide', function () {
    loader.dataset.visible = false;
  });
})(document.getElementById('add'), document.getElementById('loader'), document.querySelector('#loader iframe'));
// items
function add (id) {
  toolbar.search = '';
  let parent = document.querySelector('.item[data-id="-1"]').cloneNode(true);
  let refrence = document.getElementById('no-active');
  parent.dataset.id = id;
  document.body.insertBefore(parent, refrence);
  return get(id);
}
function remove(id) {
  var parent = document.querySelector('.item[data-id="' + id + '"]');
  if (parent) {
    parent.parentNode.removeChild(parent);
  }
}

background.receive('add', function (obj) {
  let item = add(obj.id);
  item.percent = obj.percent || 0;
  item.size = obj.size;
  item.name = obj.name;
  item.status = obj.status;
  for (let id in obj.stats) {
    let stat = obj.stats[id];
    item.partial(id, stat.start * 100, stat.width * 100, id);
  }
});
background.receive('new', function (id) {
  add(id);
});
background.receive('percent', function (obj) {
  let item = get(obj.id);
  if (item) {
    item.percent = obj.percent;
  }
});
background.receive('name', function (obj) {
  let item = get(obj.id);
  if (item) {
    item.name = obj.name;
  }
});
background.receive('size', function (obj) {
  let item = get(obj.id);
  if (item) {
    item.size = obj.size;
  }
});
background.receive('status', function (obj) {
  let item = get(obj.id);
  if (item) {
    item.status = obj.status;
  }
});
background.receive('count', function (obj) {
  let item = get(obj.id);
  if (item) {
    item.threads = obj.count;
  }
});
background.receive('progress', function (obj) {
  let item = get(obj.id);
  if (item) {
    let stat = obj.stat;
    item.partial(stat.id, stat.start * 100, stat.width * 100, stat.id);
  }
});
background.send('init');

/* user interaction */
document.addEventListener('click', function (e) {
  let target = e.target;
  if (target.dataset.cmd) {
    [].filter.call(document.querySelectorAll('.item'), i => i.contains(target))
    .forEach(function (i) {
      if (target.dataset.cmd === 'pause') {
        let cmd = i.dataset.type === 'download' ? 'pause' : 'resume';
        background.send('cmd', {id: i.dataset.id, cmd});
      }
      if (target.dataset.cmd === 'trash') {
        background.send('cmd', {id: i.dataset.id, cmd: target.dataset.cmd});
        remove(i.dataset.id);
      }
      if (target.dataset.cmd === 'cancel') {
        background.send('cmd', {id: i.dataset.id, cmd: target.dataset.cmd});
      }
    });
  }
});
