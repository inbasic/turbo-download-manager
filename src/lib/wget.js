'use strict';

/**** wrapper (start) ****/
if (typeof require !== 'undefined') {
  var utils = require('./utils');
  var app = require('./firefox/firefox');
  var wget = exports;
}
/**** wrapper (end) ****/

// @param  {[type]} obj.url           [url]
// @param  {[type]} obj.alternatives  [alternative urls]
// @param  {[type]} obj.folder        [folder path to store download link to (Firefox only)]
// @param  {[type]} obj.name          [overwrite suggested file-name]
// @param  {[type]} obj.timeout       [timeout]
// @param  {[type]} obj['auto-pause'] [auto-pause after retrieving file info]
// @param  {[type]} obj.retries       [number of retries; 50]
// @param  {[type]} obj.headers       [headers; {}]
// @param  {[type]} obj.minByteSize   [minimum thread size; 50 KBytes]
// @param  {[type]} obj.maxByteSize   [maximum thread size; 50 MBytes]
// @param  {[type]} obj.pause         [delay in between multiple schedule calls; 100 mSecs]

(function () {
  function xhr (obj) {
    let d = app.Promise.defer(), loaded = 0, active = true;
    let id = app.timer.setTimeout(() => d.reject(Object.assign(new Error('timeout'), {url: obj.urls[0]})), obj.timeout);

    obj.event.on('abort', () => d.reject(new Error('abort')));
    function process (reader) {
      return reader.read().then(function (result) {
        if (!active) {
          return reader.cancel();
        }
        app.timer.clearTimeout(id);
        id = app.timer.setTimeout(() => d.reject(Object.assign(new Error('timeout'), {url: obj.urls[0]})), obj.timeout);

        let chunk = result.value;
        if (chunk) {
          loaded += chunk.byteLength;
          obj.event.emit('progress@xhr', {loaded, chunk, length: chunk.byteLength});
        }
        return result.done ? d.resolve('done') : process(reader);
      });
    }

    app.fetch(obj.urls[0], {headers: obj.headers}).then(function (res) {
      if (!res.ok) {
        throw Error('fetch error');
      }
      return process(res.body.getReader());
    }).catch((e) => d.reject(Object.assign(e, {url: obj.urls[0]})));

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
  /**
   * Get information from a URL
   * @param  {[string]} url    [description]
   * @param  {[boolean]} forced [send 'GET' instead of 'HEAD']
   * @param  {[object]} d      [defer object]
   * @return {[object]}        [information object]
   */
  var head = function (url, forced, d) {
    let req = new app.XMLHttpRequest();
    d = d || app.Promise.defer();

    req.open(forced ? 'GET' : 'HEAD', url, true);
    req.setRequestHeader('Cache-Control', 'max-age=0');

    function analyze () {
      let length = +req.getResponseHeader('Content-Length');
      let contentEncoding = req.getResponseHeader('Content-Encoding');
      let lengthComputable = req.getResponseHeader('Length-Computable');
      //console.error(req.getAllResponseHeaders())
      if (req.getResponseHeader('Content-Length') === null && !forced) {
        head(url, true, d);
      }
      else {
        d.resolve({
          'length': length,
          'encoding': contentEncoding,
          'url': req.responseURL,
          'mime': req.getResponseHeader('Content-Type'),
          'disposition': req.getResponseHeader('Content-Disposition'),
          'can-download': contentEncoding === null && lengthComputable !== 'false',
          'multi-thread': !!length &&
            contentEncoding === null &&
            req.getResponseHeader('Accept-Ranges') === 'bytes' &&
            lengthComputable !== 'false'
        });
      }
    }

    req.onreadystatechange = function () {
      if ((req.readyState === 2 || req.readyState === 3 || req.readyState === 4) && forced) {
        analyze();
        req.abort();
      }
    };
    req.onerror = analyze;
    req.onload = analyze;
    req.onerror = req.ontimeout = (e) => d.reject(e);
    req.timeout = 120000;
    req.send();
    return d.promise;
  };

  function aget (obj) {
    obj.threads = obj.threads || 1;
    obj.retries = obj.retries || 50;
    obj.alternatives = (obj.alternatives || []).filter(url => url);
    obj.urls = [];

    let event = new app.EventEmitter(), d = app.Promise.defer(), info, segments = [], lastCount = 0;
    let internals = {};
    utils.assign(internals, 'status', event).assign(internals, 'retries', event, 0);
    internals.status = 'head';  // 'head', 'download', 'error', 'done', 'pause'

    event.on('status', (s) => event.emit('add-log', `Download status is changed to **${s}**`));

    function count () {
      let c = segments.filter(s => s.status === 'downloading').length;
      lastCount = c;
      event.emit('count', c);
      return c;
    }
    function done (s) {
      internals.status = s || internals.status;
      event.emit('count', 0);
      if (s === 'error') {
        segments.forEach(s => s.event.emit('abort'));
        d.reject();
      }
      else {
        d.resolve(s);
      }
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
        event.emit('add-log', 'Internal Error: \`internals.ranges.length\` is not equal to one', {type: 'error'});
        return done('error');
      }
      if (rngs[0].start < range.start) {
        event.emit('add-log', 'Internal Error: \`rngs[0].start\` is not euqal to range.start', {type: 'error'});
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
      //percent
      let remained = internals.ranges.reduce((p, c) => p += c.end - c.start, 0);
      let percent = parseInt((info.length - remained) / info.length * 100);
      if (isNaN(fix.percent) || fix.percent < percent) {
        event.emit('percent', internals.ranges.reduce((p, c) => p += c.end - c.start, 0), info.length);
      }
      fix.percent = percent;
    }

    function add (obj, range) {
      // rotating mirrors
      obj.urls.push(obj.urls.shift());
      let e = new app.EventEmitter(), progress;
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

      e.on('progress', (function (oldPercent) {
        return function (obj) {
          let percent = parseInt((obj.offset + obj.length) / info.length * 100);
          if (isNaN(oldPercent) || percent > oldPercent || percent === 100) {
            event.emit('progress', tmp, obj);
            oldPercent = percent;
          }
          event.emit('progress-for-speed', tmp, obj);
          progress = obj;
        };
      })());
      e.on('progress-with-buffer', (e) => event.emit('progress-with-buffer', tmp, e));

      function after () {
        // clean up
        e.removeAllListeners();
        // report
        if (progress) {
          event.emit('progress', tmp, progress);
        }
      }
      function omitURL (url) {
        let index = obj.urls.indexOf(url);
        if (index !== -1) {
          obj.urls.splice(index, 1);
          event.emit('add-log', `${url} is removed from url list due to a fetch error`);
        }
      }

      chunk(obj, range, e, range.start !== 0 || range.end !== info.length - 1).then(
        function (status) {
          tmp.status = status;
          after();
          app.timer.setTimeout(schedule, obj.pause || 100);
        },
        function (e) {
          console.error(e)
          tmp.status = e.message;
          after();
          if (e.message === 'abort') {
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
              // should I validate the failed url
              if (obj.urls.length > 1 && e.url) { // check link
                head(e.url).then(function (i) {
                  if (i.length !== info.length) {
                    omitURL(e.url);
                  }
                }, () => omitURL(e.url)).then(schedule);
              }
              else { // there is no alternative mirror; just try with this one
                app.timer.setTimeout(schedule, obj.pause || 100);
              }
            }
            else {
              // message = e.message;
              return event.emit('pause');
            }
          }
        }
      );
    }
    //
    function validateMirrors () {
      return Promise.all(obj.alternatives.map(url => head(url).catch(() => null)))
      .then(arr => arr.filter(a => a))
      .then(arr => arr.filter(i => {
        if (i.length === info.length) {
          event.emit('add-log', `${i.url} is added as a mirror`);
        }
        else {
          event.emit('add-log', `Cannot use ${i.url} as a mirror. Server returns **${i.length}** bytes for file-size`);
        }
        return i.length === info.length;
      }))
      .then(arr => arr.map(i => i.url))
      .then(urls => {
        obj.urls = obj.urls.concat(urls);
      });
    }
    event.on('info', function () {
      if (info.length === 0) {
        event.emit('add-log', 'Internal Error: \`info.length\` is equal to zero', {type: 'error'});
        return done('error');
      }
      if (info.encoding) {
        event.emit('add-log', 'Internal Error: \`info.encoding\` is not null', {type: 'error'});
        return done('error');
      }
      (function (len) {
        len = Math.max(len, obj.minByteSize ||  50 * 1024);
        len = Math.min(len, obj.maxByteSize || 20 * 1024 * 1024);
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
        event.emit('add-log', 'Server does not support multi-threading; file-size is more than **200MB**', {type: 'error'});
        return done('error');
      }
      if (!info['can-download']) {
        event.emit('add-log', 'Server does not support multi-threading; Either file-size is not defined or file is encoded', {type: 'error'});
        return done('error');
      }
      internals.status = 'download';
      if (obj['auto-pause']) {
        event.emit('pause');
        if (internals.ranges.length > 1) {
          validateMirrors();
        }
        if (internals.ranges.length === 1 && obj.alternatives.length) {
          event.emit('add-log', 'I am not going to validate mirrors as this download is single threaded');
        }
      }
      else {
        if (internals.ranges.length === 1 || !obj.alternatives.length) {
          schedule();
          if (obj.alternatives.length) {
            event.emit('add-log', 'I am not going to validate mirrors as this download is single threaded');
          }
        }
        else {
          let tmp = obj.threads;
          obj.threads = 1;
          schedule();
          validateMirrors().then(function () {
            obj.threads = tmp;
            schedule();
          });
        }
      }
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
        internals.status = 'error';
      }
    });
    event.on('name', function (name) {  // used after successful rename of the file
      obj.name = name || obj.name;
    });
    // getting header
    app.Promise.race([obj.url, obj.url, obj.url].map(url => head(url))).then(
      function (i) {
        info = i;
        obj.urls = [info && info.url ? info.url : obj.url]; // bypass redirects
        event.emit('info', info);
        event.emit('add-log', `File mime tpye is **${info.mime}**`);
        event.emit('add-log', `File encoding is **${info.encoding}**`);
        event.emit('add-log', `Server multi-threading support status is **${info['multi-thread']}**`);
        event.emit('add-log', `File length in bytes is **${info.length}**`);
        event.emit('add-log', `Actual downloadable URL is ${obj.urls[0]}`);
      },
      (e) => {
        event.emit('add-log', `Cannot get file information form server; ${e.message}`, {type: 'error'});
        done('error');
      }
    );
    return {
      event: event,
      promise: d.promise,
      resolve: d.resolve,
      reject: d.reject,
      get threads () {return lastCount;},
      get status () {return internals.status;},
      get retries () {return internals.retries;},
      get info () {return info;},
      get internals () {return internals;},
      modify: function (uo) {
        obj.threads = uo.threads || obj.threads;
        obj.timeout = uo.timeout || obj.timeout;
        if (uo.name !== obj.name) {
          event.emit('rename', uo.name.replace(/[\\\/\:\*\?\"\<\>\|\"]/g, '-')); // removing exceptions
        }
        if (uo.url && obj.urls.indexOf(uo.url) === -1) {
          app.Promise.race([uo.url, uo.url, uo.url].map(url => head(url))).then(
            function (i) {
              if (info.length === i.length) {
                if (obj.urls.indexOf(i.url) === -1) {
                  obj.urls = obj.urls.concat(i.url);
                  event.emit('add-log', `[${i.url}](${i.url}) is appeded as a mirror. Total number of downloadable links is **${obj.urls.length}**`);
                }
                else {
                  event.emit('add-log', `[${i.url}](${i.url}) is already in the list`);
                }
              }
              else {
                event.emit('add-log', `Applying the new URL failed. ${uo.url} returns **${i.length}** bytes for file-size`);
              }
            },
            (e) => event.emit('add-log', `Cannot change URL; Cannot access server; ${e.message}.`)
          );
        }
      }
    };
  }
  /* handling IO */
  function bget (obj) {
    let internals = {}, buffers = [];

    function guess (obj) {
      let url = obj.urls[0], name = obj.name, mime = obj.mime, disposition = obj.disposition;
      if (!name && disposition) {
        let tmp = /filename\=([^\;]*)/.exec(disposition);
        if (tmp && tmp.length) {
          name = tmp[1].replace(/[\"\']$/, '').replace(/^[\"\']/, '');
        }
      }
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
      // removing trimming white spaces
      name = name.trim();
      if (se && se.length) {
        return name + se[0];
      }
      // extension
      let extension =  app.mimes()[mime] || '';
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
      internals.name = guess(Object.assign({mime: info.mime, disposition: info.disposition}, obj));
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

      let start = e.offset + o.range.start;
      let end = start + e.buffer.byteLength;

      let match = buffers.filter(o => o.end === start);
      if (match.length) {
        let index = buffers.indexOf(match[0]);
        buffers[index].end = end;
        buffers[index].segments.push(e.buffer);
        if (end - buffers[index].start > obj['write-size'] || 200 * 1024) {
          internals.file.write(buffers[index].start, buffers[index].segments).catch((e) => a.reject(e));
          buffers.splice(index, 1);
        }
      }
      else {
        buffers.push({
          start: start,
          end: end,
          segments: [e.buffer]
        });
      }
    });
    a.event.on('rename', function (name) {
      function okay () {
        internals.name = name || internals.name;
        a.event.emit('name', internals.name);
        a.event.emit('log', `File-name is changed to ${internals.name}`);
      }
      if (internals.file) {
        internals.file.rename(name).then(okay, (e) => a.event.emit('add-log', `**Unsuccesful** renaming; ${e.message}`));
      }
      else {
        okay();
      }
    });
    Object.defineProperty(a, 'internals@b', {get: function () {return internals;}});
    a.promise = a.promise.then(function (status) {
      if (status === 'done') {
        return app.Promise.all(buffers.map(b => internals.file.write(b.start, b.segments)))
          .then(() => buffers = [])
          .then(internals.file.md5)
          .then(function (md5) {
            internals.md5 = md5;
            a.event.emit('md5', md5);
            a.event.emit('add-log', `MD5 checksum is **${md5}**`);
            return internals.file.flush().then(() => status);
          });
      }
      if (status === 'error' && internals.file) {
        return internals.file.remove();
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
    b.event.on('progress-for-speed', function (d, obj) {
      stats[stats.length - 1] += obj.length;
    });
    b.event.on('pause', function () {
      stats = [0];
      done();
    });
    b.event.on('resume', start);
    start();
    b.promise = b.promise.then(
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

    c.promise = c.promise.then(
      (a) => {app.timer.setTimeout(() => c.event.removeAllListeners(), 5000); return a;},
      (e) => {app.timer.setTimeout(() => c.event.removeAllListeners(), 5000); throw e;}
    );
    return c;
  }
  wget.download = vget;
})();
