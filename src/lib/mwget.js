'use strict';

if (typeof require !== 'undefined') {
  var app = require('./firefox/firefox');
  var wget = require('./wget');
  var config = require('./config');
  var utils = require('./utils');
  var icon = require('./icon');
  var mwget = exports;
}
else {
  var mwget = {};
}

(function () {
  let instances = [];
  let callbacks = {
    'add': [],
    'done': [],
    'progress': [],
    'count': [],
    'details': [],
    'percent': [],
    'total-percent': [],
    'speed': [],
    'logs': []
  };
  function count () {
    let c = instances.filter(i => i.status === 'download' || i.status === 'head').length;
    callbacks.count.forEach(a => a(c));
    app.button.badge = c ? c : '';
    return c;
  }
  // percent
  let percent = utils.debounce(function (status) {
    let size, remained;
    (function (tmp) {
      size = tmp.reduce((p, c) => p += c.info.length, 0);
      remained = tmp.reduce((p, c) => p += c.remained || c.info.length, 0);
    })(instances.filter(i => i.status === 'download' || i.status === 'pause'));
    let tmp = (size - remained) / size * 100;
    if (remained === 0) {
      tmp = 0;
    }
    if (size === 0) {
      tmp = 100;
    }
    icon.percent(status, tmp);
    callbacks['total-percent'].forEach(c => c(tmp));
  }, config.mwget.percent['rate-total'] * 1000);

  mwget.download = function (obj) {
    if (utils.validate(obj.url)) {
      let instance = wget.download(obj);
      instance.stats = {};
      instance.log = (function () {
        let arr = [];
        return {
          push: function (log, properties) {
            let a = {
              log,
              properties,
              date: (new Date()).toLocaleTimeString()
            };
            arr.push(a);
            instance.event.emit('log', a);
          },
          get: function () {
            return arr;
          }
        };
      })();
      let index = instances.push(instance) - 1;
      instance.obj = obj;
      instance.promise.then(function (status) {
        let md5 = status === 'done' ? instance.internals.md5 : '';
        callbacks.done.forEach(d => d(index, status, md5));
      }).catch((e) => {
        instance.log.push(`Internal Error; ${e ? e.message || e.exception || e : 'no error message'}`, {type: 'error'});
        callbacks.done.forEach(d => d(index, 'error', ''));
      });
      instance.log.push(`Downloading ${obj.url}`);
      instance.event.on('progress', function (a, e) {
        let start = a.range.start;
        let length = e.offset + e.length;
        let size = instance.info.length;
        let tmp = {
          id: a.id,
          start: start / size,
          width: length / size
        };
        instance.stats[tmp.id] = tmp;
        callbacks.progress.forEach(p => p(index, tmp));
      });
      instance.event.on('log', (c) => callbacks.logs.forEach(d => d(index, c)));
      instance.event.on('name', (c) => callbacks.details.forEach(d => d(index, 'name', c)));
      instance.event.on('status', function (c) {
        callbacks.details.forEach(d => d(index, 'status', c));
        //instance.threads === 0; download has not been initialized yet
        if (c === 'pause' && !instance.info['multi-thread'] && instance.threads !== 0) {
          instance.event.emit('cancel');
          instance.log.push(
            'Download status changed to paused while this download is not supporting multi-threading.',
            {type: 'error'}
          );
        }
        app.timer.setTimeout(count, 500);
        percent.now(c);
      });
      instance.event.on('count', (c) => callbacks.details.forEach(d => d(index, 'count', c)));
      instance.event.on('retries', (c) => callbacks.details.forEach(d => d(index, 'retries', c)));
      instance.event.on('info', (c) => callbacks.details.forEach(d => d(index, 'info', c)));
      instance.event.on('add-log', (msg, properties) => instance.log.push(msg, properties));
      instance.event.on('speed', (s) => callbacks.speed.forEach(d => d(index, s, instance.remained)));

      instance.event.on('percent', function (remained, size) {
        instance.remained = remained;
        callbacks.percent.forEach(p => p(index, remained, size));
        percent();
      });
      callbacks.add.forEach(d => d(index));
      app.timer.setTimeout(count, 0);
      return index;
    }
    else {
      return app.notification('URL is not valid');
    }
  };
  mwget.list = () => instances;
  mwget.get = (id) => instances[id];
  mwget.id = (obj) => instances.indexOf(obj);
  mwget.count = () => count(),
  mwget.log = (id) => instances[id].log.get();
  mwget.stats = function (index) {
    let wget = instances[index];
    if (wget) {
      return wget.stats;
    }
  };
  mwget.pause = function (index) {
    let wget = instances[index];
    if (wget) {
      wget.event.emit('pause');
    }
  };
  mwget.resume = function (index) {
    let wget = instances[index];
    if (wget) {
      wget.event.emit('resume');
    }
  };
  mwget.cancel = function (index) {
    let wget = instances[index];
    if (wget) {
      wget.event.emit('cancel');
    }
  };
  mwget.remove = function (index) {
    let wget = instances[index];
    if (wget) {
      if (wget.status === 'download') {
        throw Error('Cannot remove an instance while it is active. Try to pause the download first');
      }
      if (wget.status === 'pause' || wget.status === 'error') {
        if (wget.internals.file) {
          wget.internals.file.remove();
        }
      }
      delete instances[index];
      app.manager.send('remove', index);
    }
  };
  mwget.addEventListener = function (type, func) {
    for (let name in callbacks) {
      if (name === type) {
        callbacks[type].push(func);
      }
    }
  };
  mwget.removeEventListener = function (type, func) {
    for (let name in callbacks) {
      if (name === type) {
        let index = callbacks[type].indexOf(func);
        if (index) {
          callbacks[type].splice(index, 1);
        }
      }
    }
  };
})();
