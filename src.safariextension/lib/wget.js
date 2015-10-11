'use strict';

/**** wrapper (start) ****/
if (typeof require !== 'undefined') {
  var app = require('./firefox/firefox');
  var wget = exports;
}
/**** wrapper (end) ****/

// @param  {[type]} obj.url     [url]
// @param  {[type]} obj.folder  [folder path to store download link to (Firefox only)]
// @param  {[type]} obj.name    [overwrite suggested file-name]
// @param  {[type]} obj.timeout [timeout]
// @param  {[type]} obj.retries [number of retries; 50]
// @param  {[type]} obj.headers [headers; {}]
// @param  {[type]} obj.delay   [delay in xhr starting; 0 mSeconds]
// @param  {[type]} obj.pause   [delay in between multiple schedule calls; 100 mSecs]
(function () {
  function log () {
    let args = [].slice.call(arguments);
    if (log.levels.indexOf(args[0]) !== -1) {
      console.error.apply(console, [(new Date()).toLocaleTimeString()].concat(args.slice(0)));
    }
  }
  log.levels = [/*'[a]', '[b]'*/];

  function xhr (obj) {
    let id, status = 'ready';
    let req = new app.XMLHttpRequest();
    let d = app.Promise.defer();

    req.onprogress = (e) => obj.event.emit('progress@xhr', e);
    req.onerror = () => done('error');
    req.ontimeout = () => done('timeout');
    req.onload = () => done('done');

    req.open('GET', obj.url, true);
    req.timeout = obj.timeout;
    req.overrideMimeType('text/plain; charset=x-user-defined');
    if (app.globals.browser === 'firefox') {
      req.responseType = 'moz-chunked-text';
    }
    for (let i in obj.headers) {
      req.setRequestHeader(i, obj.headers[i]);
    }
    id = app.timer.setTimeout(function () {
      req.send();
      status = 'downloading';
    }, obj.delay || 0);
    function abort () {
      if (status === 'downloading') {
        req.abort();
        return done('abort');
      }
      return done('abort');
    }
    obj.event.on('abort', abort);
    function mismatch () {
      req.abort();
      done('error');
    }
    obj.event.on('size-mismatch', mismatch);

    function done (s) {
      status = s || status;
      d.resolve(status);
      obj.event.removeListener('abort', abort);
      obj.event.removeListener('size-mismatch', mismatch);
      obj.event.emit = function () {};
      app.timer.clearTimeout(id);
    }
    return {
      get status () {return status;}, // 'ready', 'downloading', 'done', 'error', 'timeout'
      req: req,
      promise: d.promise
    };
  }
  function chunk (obj, range, event) {
    let length, offset = 0;
    obj = Object.assign({}, obj); // clone
    obj.event = event;
    obj.headers = obj.headers || {};
    obj.headers.Range = `bytes=${range.start}-${range.end}`;
    event.on('length', len => length = len);
    event.on('progress@xhr', function (e) {
      if (e.total !== range.end - range.start + 1) {
        event.emit('size-mismatch');
      }
      else {
        let tmp = {offset: offset};
        let buffer = app.globals.browser === 'firefox' ? e.target.response : e.target.response.substr(offset);
        tmp.buffer = length && e.loaded > length ? buffer.substr(0, length - offset) : buffer;
        if (tmp.buffer.length) {
          event.emit('progress', tmp);
        }
        offset += tmp.buffer.length;
        if (length && e.loaded > length) {
          event.emit('abort');
        }
      }
    });
    let segment = xhr(obj);
    return segment;
  }
  var head = function (url) {
    let req = new app.XMLHttpRequest();
    let d = app.Promise.defer();

    req.open('HEAD', url, true);
    req.onload = function () {
      let length = +req.getResponseHeader('Content-Length');
      let encoding = req.getResponseHeader('Content-Encoding');
      d.resolve({
        'length': length,
        'url': req.responseURL,
        'encoding': req.getResponseHeader('Content-Encoding'),
        'mime': req.getResponseHeader('Content-Type'),
        'multi-thread': !!length && encoding === null &&
          req.getResponseHeader('Accept-Ranges') === 'bytes' &&
          req.getResponseHeader('Length-Computable') !== 'false'
      });
    };
    req.onerror = (e) => d.reject(e);
    req.ontimeout = (e) => d.reject(e);
    req.timeout = 120000;
    req.send();
    return d.promise;
  };

  function aget (obj) {
    obj.threads = obj.threads || 1;
    obj.retries = obj.retries || 50;

    let status = 'head';  // 'head', 'download', 'error', 'done', 'pause'
    let event = new app.EventEmitter();
    event.emit('status', status);
    let d = app.Promise.defer();
    let info;
    let segments = [];
    let retries = 0;
    let internals = {};

    function count () {
      let c = segments.filter(s => ['done', 'error', 'timeout', 'abort'].indexOf(s.status) === -1).length;
      event.emit('count', c);
      return c;
    }
    function done (s) {
      status = s || status;
      event.emit('status', status);
      event.emit('count', 0);
      event.emit('done', status);
      d.resolve(s);
    }
    function schedule () {
      if (status === 'error' || status === 'pause' || status === 'done') {
        log('[a]', `schedule is called but status is ${status}`);
        return;
      }
      if (internals.ranges.length === 0) {
        return done('done');
      }
      else {
        log('[a]', 'current map', internals.ranges.map(r => `${r.start} - ${r.end}`).join(', '));
        log('[a]', 'internals.locks', internals.locks.map(r => `${r.start} - ${r.end}`).join(', '));
        let ranges = internals.ranges
          .filter(a => internals.locks.indexOf(a) === -1)
          .sort((a, b) => (b.end - b.start) - (a.end - a.start));
        if (ranges.length) {
          add(obj, ranges[0]);
          internals.locks.push(ranges[0]);
        }
        else {
          log('[a]', 'all ranges are in the lock list');
          return;
        }
      }
      //
      let c = count();
      log('[a]', `number of active chunks = ${c}`);
      if (c < obj.threads) {
        app.timer.setTimeout(schedule, obj.pause || 100);
      }
    }
    function fix (range) {
      let rngs = internals.ranges.filter(r => r.start <= range.start && r.end >= range.end);
      if (rngs.length !== 1) {
        log('[a]', 'something went wrong', range);
        return done('error');
      }
      if (rngs[0].start < range.start) {
        log('[a]', `something went wrong, ${rngs[0].start} is smaller than ${range.start}.`);
        return done('error');
      }
      if (rngs[0].end > range.end) {
        (function (tmp) {
          internals.ranges.push(tmp);
          internals.locks.push(tmp);
        })({
          start: range.end + 1,
          end: rngs[0].end
        });
      }
      // removing the old range and free up its index
      internals.ranges.splice(internals.ranges.indexOf(rngs[0]), 1);
      internals.locks.splice(internals.locks.indexOf(rngs[0]), 1);
      //
      event.emit('percent', internals.ranges.reduce((p, c) => p += c.end - c.start, 0), info.length);
    }

    function add (obj, range) {
      log('[a]', `adding a new range: ${range.start} - ${range.end}`);
      let e = new app.EventEmitter();
      e.on('progress', function (obj) {
        fix({
          start: obj.offset + range.start,
          end: obj.offset + obj.buffer.length + range.start - 1
        });
      });
      e.on('size-mismatch', () => log('[a]', 'aborting because of size mismatch'));
      let c = chunk(obj, range, e);
      let tmp = {
        get status () {
          return c.status;
        },
        range: range,
        chunk: c,
        event: e,
        // we will use id as progress color as well
        id: '#' + Math.floor(Math.random() * 16777215).toString(16)
      };
      segments.push(tmp);
      e.on('progress', (e) => event.emit('progress', tmp, e));
      c.promise.then(function (status) {
        log('[a]', `a segment is finished with status: ${status}`);
        if (status === 'done') {
          app.timer.setTimeout(schedule, obj.pause || 100);
        }
        else if (status === 'abort') {
          // removing locked ranges inside the chunk with abort code
          internals.locks = internals.locks.filter(r => r.start < range.start || r.end > range.end);
        }
        else {
          if (retries < obj.retries) {
            retries += 1;
            event.emit('retries', retries);
            // removing locked ranges inside the chunk with error code
            internals.locks = internals.locks.filter(r => r.start < range.start || r.end > range.end);
            log('[a]', `chunk exited with error. Number of retries left: ${obj.retries - retries}. Retrying ...`);
            app.timer.setTimeout(schedule, obj.pause || 100);
          }
          else {
            log('[a]', 'max number of retries reached');
            return event.emit('pause');
          }
        }
      });
    }
    //
    event.on('info', function () {
      log('[a]', info);
      if (!info['multi-thread']) {
        obj.threads = 1;
      }
      if (info.length === 0) {
        return done('error');
      }
      (function (arr, len) {
        internals.ranges = arr.map((a, i, l) => ({
          start: a * len,
          end: l.length === i + 1 ? info.length - 1 : (a + 1) * len - 1
        }));
        internals.locks = [];
      })(Array.from(new Array(obj.threads), (x, i) => i), Math.floor(info.length / obj.threads));
      status = 'download';
      event.emit('status', status);
      schedule();
    });
    // pause
    event.on('pause', function () {
      status = 'pause';
      event.emit('status', status);
      segments.forEach(s => s.event.emit('abort'));
    });
    event.on('resume', function () {
      if (status === 'pause') {
        retries = 0;
        event.emit('retries', retries);
        if (internals.locks.length) {
          log('[a]', 'internals.locks is not empty');
          internals.locks = [];
        }
        status = 'download';
        event.emit('status', status);
        schedule();
      }
    });
    // cancel
    event.on('cancel', function () {
      status = 'error';
      event.emit('status', status);
    });
    // getting header
    app.Promise.race([obj.url, obj.url, obj.url].map(head))
      .then(
        function (i) {
          info = i;
          if (info.url) { // bypass redirects
            obj.url = info.url;
          }
          event.emit('info', info);
        },
        () => done('error')
      );
    return {
      event: event,
      promise: d.promise,
      get status () {return status;},
      get retries () {return retries;},
      get info () {return info;},
      get internals () {return internals;},
    };
  }
  /* handling IO */
  function bget (obj) {
    let internals = {};
    let mimeToExtension  = (function () {
      let types = {}, xhr = new app.XMLHttpRequest();
      xhr.onload = function () {
        types = xhr.response;
      };
      xhr.open('GET', app.getURL('assets/mime.json'), true);
      xhr.responseType = 'json';
      xhr.send();
      return function (m) {
        m = m.split(';')[0];
        return types[m] ? types[m][0] : '';
      };
    })();
    function guess (obj) {
      let url = obj.url, name = obj.name, mime = obj.mime;
      if (!name) {
        url = decodeURIComponent(url);
        url = url.replace(/\/$/, '');
        let tmp = /(title|filename)\=([^\&]+)/.exec(url);
        if (tmp && tmp.length) {
          name = tmp[2];
        }
        else {
          name = url.substring(url.lastIndexOf('/') + 1);
        }
        name = name.split('?')[0].split('&')[0] || 'unknown';
      }
      // extracting extension from file name
      let se = /\.\w+$/.exec(name);
      if (se && se.length) {
        name = name.replace(se[0], '');
      }
      // removing exceptions
      name = name.replace(/[\\\/\:\*\?\"\<\>\|\"]/g, '-');
      if (se && se.length) {
        return name + se[0];
      }
      // extension
      let extension = mimeToExtension(mime);
      if (extension) {
        let r = new RegExp('\.' + extension + '$');
        name = name.replace(r, '');
        return name + '.' + extension;
      }
      else {
        return name;
      }
    }
    let a = aget(obj);
    a.event.once('info', function (info) {
      internals.name = guess(Object.assign({mime: info.mime}, obj));
      a.event.emit('name', internals.name);
    });
    a.event.on('progress', function (o, e) {
      if (!internals.file) {
        internals.file = new app.File({
          name: internals.name,
          mime: a.info.mime,
          path: obj.folder
        });
        internals.file.open();
      }
      log('[b]', `writing ${e.offset + o.range.start} - ${e.offset + e.buffer.length + o.range.start - 1}`);
      internals.file.write(e.offset + o.range.start, e.buffer);
    });
    a.event.on('done', function (status) {
      if (status === 'done') {
        internals.file.md5().then(function (md5) {
          internals.md5 = md5;
          a.event.emit('md5', md5);
          internals.file.flush();
        });
      }
      if (status === 'error' && internals.file) {
        internals.file.remove();
      }
    });
    Object.defineProperty(a, 'internals@b', {
      get: function () {
        return internals;
      }
    });
    return a;
  }
  /* handling speed measurement */
  function cget (obj) {
    let b = bget(obj);
    let id, stats = [0];
    obj.update = obj.update || 1000;

    function done (a) {
      app.timer.clearInterval(id);
      update();
      return a;
    }
    function speed () {
      return stats.reduce((p, c) => p + c, 0) / stats.length / obj.update * 1000;
    }
    function update () {
      b.event.emit('speed', speed());
      stats.push(0);
      stats = stats.slice(-10);
    }
    function start () {
      id = app.timer.setInterval(update, obj.update);
    }

    b.event.on('progress', function (d, obj) {
      stats[stats.length - 1] += obj.buffer.length;
    });
    b.event.on('pause', function () {
      stats = [0];
      done();
    });
    b.event.on('resume', start);

    start();

    b.promise.then(done, done);

    Object.defineProperty(b, 'speed', {
      get: function () {
        return speed();
      }
    });

    return b;
  }
  wget.download = cget;
})();
/*
(function (c) {
  c.event.on('error', function (e) {
    console.error(e);
  });
  c.promise.then(function (status) {
    console.error(`download is done with "${status}" code.`);
    console.error(`file name is ${c['internals@b'].name}`);
  });
  app.timer.setTimeout(function () {
    console.error('pausing ...');
    c.event.emit('pause');
  }, 1000);
  app.timer.setTimeout(function () {
    console.error('resuming ...');
    c.event.emit('resume');
  }, 4000);
})(wget.download({
  url: 'http://pad1.whstatic.com/images/thumb/4/4e/Download-a-New-Web-Browser-Step-1.jpg/670px-Download-a-New-Web-Browser-Step-1.jpg',
  threads: 3,
  timeout: 10000,
  folder: '/Users/amin/Desktop/'
}));*/
