/* globals background */
'use strict';

function bytesToSize(bytes) {
  if (bytes === 0) {
    return '0 Byte';
  }
  let k = 1024;
  let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(i ? 1 : 0) + ' ' + sizes[i];
}
function intervalToTime (sec) {
  if (isNaN(sec) || !isFinite(sec)) {
    return '--:--:--:--';
  }
  let x = sec;
  let seconds = ('00' + parseInt(x % 60)).substr(-2);
  x /= 60;
  let minutes = ('00' + parseInt(x % 60)).substr(-2);
  x /= 60;
  let hours = ('00' + parseInt(x % 24)).substr(-2);
  x /= 24;
  let days = ('00' + parseInt(x)).substr(-2);

  return [days,hours,  minutes, seconds].join(':');
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
  var speed = parent.querySelector('[data-type=speed]');
  var time = parent.querySelector('[data-type=time]');
  var name = parent.querySelector('[data-type=name]');
  var threads = parent.querySelector('[data-type=threads]');
  var retries = parent.querySelector('[data-type=retries]');

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
      name.textContent = n || name.textContent;
    },
    set threads (n) { // jshint ignore: line
      threads.textContent = n;
    },
    set retries (n) { // jshint ignore: line
      retries.textContent = n;
    },
    set speed (s) { // jshint ignore: line
      speed.textContent = bytesToSize(s) + '/s';
    },
    set time (s) { // jshint ignore: line
      time.textContent = s;
    },
    partial: function (id, offset, percent, color) {
      let holder = parent.querySelector('[data-type=partial]');
      let item = holder.querySelector('div[data-id="' + id + '"]');
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
    },
    get chunkable () {
      return parent.dataset.chunkable;
    },
    set chunkable (val) {
      parent.dataset.chunkable = val;
    }
  };
};
// add && info
(function (add, loader, iframe) {
  (function (blank) {
    loader.addEventListener('click', e => iframe.contains(e.target) ? '' : blank());
    background.receive('hide', blank, false);
    document.addEventListener('backbutton', (e) => {
      e.preventDefault();
      blank();
    }, false);
  })(function () {
    if (loader.dataset.visible === 'true') {
      loader.dataset.visible = false;
      iframe.src = 'about:blank';
    }
  });
  add.addEventListener('click', function () {
    loader.dataset.visible = true;
    iframe.src = '../add/index.html';
  }, false);
  background.receive('info', function (id) {
    loader.dataset.visible = true;
    iframe.src = '../info/index.html?id=' + id;
  });
  background.receive('modify', function (id) {
    loader.dataset.visible = true;
    iframe.src = '../modify/index.html?id=' + id;
  });
  background.receive('triggers', function () {
    loader.dataset.visible = true;
    iframe.src = '../triggers/index.html';
  });
})(document.getElementById('add'), document.getElementById('loader'), document.querySelector('#loader iframe'));

// items
function add (id) {
  toolbar.search = '';
  let parent = document.querySelector('.item[data-id="-1"]').cloneNode(true);
  let refrence = document.querySelector('.item');
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
background.receive('remove', remove);
background.receive('add', function (obj) {
  let item = add(obj.id);
  item.percent = obj.percent || 0;
  item.size = obj.size;
  item.threads = obj.threads;
  item.name = obj.name;
  item.status = obj.status;
  item.speed = obj.speed;
  item.retries = obj.retries;
  item.chunkable = obj.chunkable;
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
background.receive('speed', function (obj) {
  let item = get(obj.id);
  if (item) {
    item.speed = obj.speed;
    item.time = intervalToTime(obj.time);
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
background.receive('chunkable', function (obj) {
  let item = get(obj.id);
  if (item) {
    item.chunkable = obj.chunkable;
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
background.receive('retries', function (obj) {
  let item = get(obj.id);
  if (item) {
    item.retries = obj.retries;
  }
});
background.receive('progress', function (obj) {
  let item = get(obj.id);
  if (item) {
    let stat = obj.stat;
    item.partial(stat.id, stat.start * 100, stat.width * 100, stat.id);
  }
});
background.receive('browser', function (browser) {
  document.body.dataset.browser = browser;
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
        if (cmd === 'pause' && i.dataset.chunkable === 'false') {
          let rtn = window.confirm('Download is not resumable. Pausing will result in termination. Proceed?');
          if (rtn) {
            background.send('cmd', {id: i.dataset.id, cmd});
          }
        }
        else {
          background.send('cmd', {id: i.dataset.id, cmd});
        }
      }
      else if (target.dataset.cmd === 'trash') {
        background.send('cmd', {id: i.dataset.id, cmd: target.dataset.cmd});
        remove(i.dataset.id);
      }
      else {
        background.send('cmd', {id: i.dataset.id, cmd: target.dataset.cmd});
      }
    });
  }
});
