'use strict';

/**** wrapper (start) ****/
if (typeof require !== 'undefined') {
  var app = require('./firefox/firefox');
  var wget = require('./wget');
  var config = require('./config');
  var utils = require('./utils');
  var icon = require('./icon');
  var mwget = exports;
}
/**** wrapper (end) ****/

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
    let c = instances.filter(i => i.status === 'download').length;
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
          push: function (a, link) {
            a = {
              log: a,
              link: link,
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
        app.timer.setTimeout(count, 500);
        let md5 = status === 'done' ? instance['internals@b'].md5 : '';
        callbacks.done.forEach(d => d(index, status, md5));
        percent.now(status);
      }).catch((e) => instance.log.push('internal error; ' + e.message || e));
      instance.log.push('Downloading "' + obj.url + '"', obj.url);
      instance.event.once('progress', count);
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
        instance.log.push('Download status changed to "' + c + '"; ' + (instance.message || ''));
        callbacks.details.forEach(d => d(index, 'status', c));
        if (c === 'pause' && !instance.info['multi-thread']) {
          instance.event.emit('cancel');
        }
      });
      instance.event.on('error', function (e) {
        percent.now('error');
        instance.log.push('Error: ' + (e.message || e));
      });
      instance.event.on('cancel', () => percent.now('error'));
      instance.event.on('count', (c) => callbacks.details.forEach(d => d(index, 'count', c)));
      instance.event.on('retries', (c) => callbacks.details.forEach(d => d(index, 'retries', c)));
      instance.event.once('info', function (c) {
        instance.log.push('File mime is "' + c.mime + '"');
        instance.log.push('Actual downloadable URL is "' + c.url + '"', c.url);
        instance.log.push('File encoding is "' + c.encoding + '"');
        instance.log.push('Server multi-threading support status is: ' + c['multi-thread']);
        instance.log.push('File length in bytes is "' + c.length + '"');
        callbacks.details.forEach(d => d(index, 'info', c));
      });
      instance.event.once('size-mismatch', () => instance.log.push('File size has been changed'));
      instance.event.on('speed', (s) => callbacks.speed.forEach(d => d(index, s, instance.remained)));
      instance.event.on('md5', (md5) => instance.log.push('MD5 checksum is "' + md5 + '"'));

      instance.event.on('percent', function (remained, size) {
        instance.remained = remained;
        callbacks.percent.forEach(p => p(index, remained, size));
        percent();
      });
      callbacks.add.forEach(d => d(index));
      app.timer.setTimeout(count, 500);
      return index;
    }
    else {
      return app.notification('URL is not valid');
    }
  };
  mwget.list = function () {
    return instances;
  };
  mwget.get = function (id) {
    return instances[id];
  };
  mwget.log = function (id) {
    return instances[id].log.get();
  };
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
    app.timer.setTimeout(count, 500);
  };
  mwget.resume = function (index) {
    let wget = instances[index];
    if (wget) {
      wget.event.emit('resume');
    }
    app.timer.setTimeout(count, 500);
  };
  mwget.cancel = function (index) {
    let wget = instances[index];
    if (wget) {
      wget.event.emit('cancel');
    }
    app.timer.setTimeout(count, 500);
  };
  mwget.remove = function (index) {
    let wget = instances[index];
    if (wget) {
      if (wget.status === 'download') {
        throw Error('Cannot remove an instance while it is active. Try to pause the download first');
      }
      console.error(wget.status);
      if (wget.status === 'pause') {
        console.error('hereerere');
        wget['internals@b'].file.remove();
      }
      delete instances[index];
      count();
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

/*(function (id) {
  console.error(`new job is added with id [${id}]`);
})(mwget.download({
  url: 'http://pad1.whstatic.com/images/thumb/4/4e/Download-a-New-Web-Browser-Step-1.jpg/670px-Download-a-New-Web-Browser-Step-1.jpg',
  threads: 10,
  timeout: 30000,
  retries: 200,
  folder: '/Users/amin/Desktop/'
}));*/
