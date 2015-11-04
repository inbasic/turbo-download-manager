'use strict';

/**** wrapper (start) ****/
if (typeof require !== 'undefined') {
  var utils = require('./utils');
  var app = require('./firefox/firefox');
  var wget = exports;
}
/**** wrapper (end) ****/

// @param  {[type]} obj.url         [url]
// @param  {[type]} obj.folder      [folder path to store download link to (Firefox only)]
// @param  {[type]} obj.name        [overwrite suggested file-name]
// @param  {[type]} obj.timeout     [timeout]
// @param  {[type]} obj.retries     [number of retries; 50]
// @param  {[type]} obj.headers     [headers; {}]
// @param  {[type]} obj.minByteSize [minimum thread size; 50 KBytes]
// @param  {[type]} obj.maxByteSize [maximum thread size; 50 MBytes]
// @param  {[type]} obj.pause       [delay in between multiple schedule calls; 100 mSecs]

(function () {
  function xhr (obj) {
    let d = app.Promise.defer(), loaded = 0, active = true;
    let id = app.timer.setTimeout(() => d.resolve(new Error('timeout')), obj.timeout);

    obj.event.on('abort', () => d.resolve(new Error('abort')));

    function process (reader) {
      return reader.read().then(function (result) {
        if (!active) {
          return reader.cancel();
        }
        app.timer.clearTimeout(id);
        id = app.timer.setTimeout(() => d.resolve(new Error('timeout')), obj.timeout);

        let chunk = result.value;
        if (chunk) {
          loaded += chunk.byteLength;
          obj.event.emit('progress@xhr', {loaded, chunk, length: chunk.byteLength});
        }
        return result.done ? d.resolve('done') : process(reader);
      });
    }
    app.fetch(obj.url, {headers: obj.headers}).then(function (res) {
      if (!res.ok) {
        throw Error('fetch error');
      }
      return process(res.body.getReader());
    }).catch(function (e) {
      return d.resolve(e);
    });

    return d.promise
      .then((s) => {active = false; return s;}, (e) => {active = false; throw e;});
  }
  function chunk (obj, range, event, report) {
    obj = Object.assign({ // clone
      headers: {},
      event: event
    }, obj);
    if (report) { // if download does not support multi-threading do not send range info
      obj.headers.Range = `bytes=${range.start}-${range.end}`;
    }
    event.on('progress@xhr', function (e) {
      if (e.chunk.byteLength) {
        let tmp = {
          offset: e.loaded - e.length,
          length: e.chunk.byteLength
        };
        event.emit('progress-with-buffer', Object.assign({buffer: e.chunk}, tmp));
        event.emit('progress', tmp);
      }
    });
    return xhr(obj);
  }
  var head = function (url) {
    let req = new app.XMLHttpRequest();
    let d = app.Promise.defer();

    req.open('HEAD', url, true);
    req.onload = function () {
      let length = +req.getResponseHeader('Content-Length');
      d.resolve({
        'length': length,
        'url': req.responseURL,
        'mime': req.getResponseHeader('Content-Type'),
        'multi-thread': !!length &&
          req.getResponseHeader('Content-Encoding') === null &&
          req.getResponseHeader('Accept-Ranges') === 'bytes' &&
          req.getResponseHeader('Length-Computable') !== 'false'
      });
    };
    req.onerror = req.ontimeout = (e) => d.reject(e);
    req.timeout = 120000;
    req.send();
    return d.promise;
  };

  function aget (obj) {
    obj.threads = obj.threads || 1;
    obj.retries = obj.retries || 50;

    let event = new app.EventEmitter(), d = app.Promise.defer(), info, segments = [], message;
    let internals = {};
    utils.assign(internals, 'status', event).assign(internals, 'retries', event, 0);
    internals.status = 'head';  // 'head', 'download', 'error', 'done', 'pause'

    function count () {
      let c = segments.filter(s => s.status === 'downloading').length;
      event.emit('count', c);
      return c;
    }
    function done (s) {
      internals.status = s || internals.status;
      event.emit('count', 0);
      d.resolve(s);
      segments = [];
    }
    function schedule () {
      if (['error', 'pause', 'done'].indexOf(internals.status) !== -1) {
        return;
      }
      if (internals.ranges.length === 0) {
        return done('done');
      }
      let ranges = internals.ranges
        .filter(a => internals.locks.indexOf(a) === -1)
        .sort((a, b) => a.start - b.start);
      if (ranges.length) {
        add(obj, ranges[0]);
        internals.locks.push(ranges[0]);
      }
      else {
        return;
      }
      //
      let c = count();
      if (c < obj.threads) {
        app.timer.setTimeout(schedule, obj.pause || 100);
      }
    }
    function fix (range) {
      let rngs = internals.ranges.filter(r => r.start <= range.start && r.end >= range.end);
      if (rngs.length !== 1) {
        return done('error', 'internals.ranges.length is not equal to one');
      }
      if (rngs[0].start < range.start) {
        return done('error', 'rngs[0].start is not euqal to range.start');
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
      let e = new app.EventEmitter();
      e.on('progress', (obj) => fix({
          start: obj.offset + range.start,
          end: obj.offset + obj.length + range.start - 1
        }));
      let tmp = {
        status: 'downloading',
        range: range,
        event: e,
        // we will use id as progress color as well
        id: '#' + Math.floor(Math.random() * 16777215).toString(16)
      };
      segments.push(tmp);
      e.on('progress', (e) => event.emit('progress', tmp, e));
      e.on('progress-with-buffer', (e) => event.emit('progress-with-buffer', tmp, e));
      chunk(obj, range, e, info['multi-thread']).then(function (status) {
        tmp.status = status;
        // clean up
        e.removeAllListeners();
        //
        if (status === 'done') {
          app.timer.setTimeout(schedule, obj.pause || 100);
        }
        else if (status.message === 'abort') {
          // removing locked ranges inside the chunk with abort code
          internals.locks = internals.locks.filter(r => r.start < range.start || r.end > range.end);
        }
        else {
          if (internals.retries < obj.retries && info['multi-thread']) {
            if (internals.locks.filter(r => r.start === range.start).length) {
              internals.retries += 1;
            }
            // removing locked ranges inside the chunk with error code
            internals.locks = internals.locks.filter(r => r.start < range.start || r.end > range.end);
            app.timer.setTimeout(schedule, obj.pause || 100);
          }
          else {
            message = status.message;
            return event.emit('pause');
          }
        }
      });
    }
    //
    event.on('info', function () {
      if (info.length === 0) {
        return done('error', 'info.length is equal to zero');
      }
      if (info.encoding) {
        return done('error', 'info.encoding is not null');
      }
      (function (len) {
        len = Math.max(len, obj.minByteSize ||  50 * 1024);
        len = Math.min(len, obj.maxByteSize || 50 * 1024 * 1024);
        len = Math.min(info.length, len);

        let threads = Math.floor(info.length / len);
        if (!info['multi-thread']) {
          threads = 1;
        }
        let arr = Array.from(new Array(threads), (x, i) => i);

        internals.ranges = arr.map((a, i, l) => ({
          start: a * len,
          end: l.length === i + 1 ? info.length - 1 : (a + 1) * len - 1
        }));
        internals.locks = [];
      })(Math.floor(info.length / obj.threads));
      // do not download large files if multi-thread is not supported
      if (!info['multi-thread'] && info.length > 200 * 1024 * 1024) {
        return done('error');
      }
      internals.status = 'download';
      schedule();
    });
    // pause
    event.on('pause', function () {
      internals.status = 'pause';
      segments.forEach(s => s.event.emit('abort'));
    });
    event.on('resume', function () {
      if (internals.status === 'pause') {
        internals.retries = 0;
        if (internals.locks.length) {
          internals.locks = [];
        }
        internals.status = 'download';
        schedule();
      }
    });
    // cancel
    event.on('cancel', () => internals.status = 'error');
    // error
    event.on('error', function () {
      if (internals.status !== 'error') {
        segments.forEach(s => s.event.emit('abort'));
        internals.status = 'error';
      }
    });
    // getting header
    app.Promise.race([obj.url, obj.url, obj.url].map(head)).then(
      function (i) {
        info = i;
        if (info.url) { // bypass redirects
          obj.url = info.url;
        }
        event.emit('info', info);
      },
      (e) => done('error', 'cannot get file information form server;' + e.message)
    );
    return {
      event: event,
      promise: d.promise,
      resolve: d.resolve,
      reject: d.reject,
      get message () {return message;},
      get status () {return internals.status;},
      get retries () {return internals.retries;},
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
    a.event.on('progress-with-buffer', function (o, e) {
      if (!internals.file) {
        internals.file = new app.File({
          name: internals.name,
          mime: a.info.mime,
          path: obj.folder,
          length: a.info.length
        });
        internals.file.open().catch((e) => a.reject(e));
      }
      internals.file.write(e.offset + o.range.start, e.buffer).catch((e) => a.event.emit('error', e));
    });
    Object.defineProperty(a, 'internals@b', {get: function () {return internals;}});
    a.promise.then(function (status) {
      if (status === 'done') {
        internals.file.md5().then(function (md5) {
          internals.md5 = md5;
          a.event.emit('md5', md5);
          internals.file.flush().catch((e) => a.reject(e));
        }, (e) => a.reject(e));
      }
      if (status === 'error' && internals.file) {
        internals.file.remove();
      }
      return status;
    });
    return a;
  }
  /* handling speed measurement */
  function cget (obj) {
    let b = bget(obj), id, stats = [0];
    obj.update = obj.update || 1000;

    function done () {
      app.timer.clearInterval(id);
      update();
    }
    function speed () {
      return stats.reduce((p, c) => p + c, 0) / stats.length / obj.update * 1000;
    }
    function update () {
      b.event.emit('speed', speed());
      stats.push(0);
      stats = stats.slice(-5);
    }
    function start () {
      app.timer.clearInterval(id);
      id = app.timer.setInterval(update, obj.update);
    }
    b.event.on('progress', function (d, obj) {
      stats[stats.length - 1] += obj.length;
    });
    b.event.on('pause', function () {
      stats = [0];
      done();
    });
    b.event.on('resume', start);
    start();
    b.promise.then(
      (a) => {done(); return a;},
      (e) => {done(); throw e;}
    );
    Object.defineProperty(b, 'speed', {
      get: function () {
        return speed();
      }
    });
    return b;
  }
  //listeners clean up
  function vget (obj) {
    let c = cget(obj);
    c.promise.then(
      (a) => {app.timer.setTimeout(() => c.event.removeAllListeners(), 5000); return a;},
      (e) => {app.timer.setTimeout(() => c.event.removeAllListeners(), 5000); throw e;}
    );
    return c;
  }
  wget.download = vget;
})();
