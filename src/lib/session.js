'use strict';

var app = app || require('./firefox/firefox');
var config = config || require('./config');
var session = typeof exports === 'undefined' ? {} : exports;

app.on('session:error', e => {
  app.notification(e.message || e);
  console.error('error', e, new Error().stack);
});
app.on('session:warning', function () {});

Object.defineProperty(session, 'db', (function () {
  let _db = {
    dummy: true,
    error: () => app.Promise.reject(new Error('session is not yet initialized')),
    inprogress: {
      get clear () {return session.db.error;},
      get toArray () {return session.db.error;},
      get where () {return session.db.error;}
    },
    get failed () {return session.db.inprogress;},
    get completed () {return session.db.inprogress;},
    get delete () {return session.db.inprogress;}
  };
  return {
    enumerable: true,
    configurable: true,
    get: () => _db,
    set: (v) => _db = v
  };
})());

session.init = () => {
  app.crequire('Dexie', ['dexie'], {
    global: {},
    setTimeout: app.timer.setTimeout,
    clearTimeout: app.timer.clearTimeout
  }, function (sandbox) {
    let Dexie = sandbox.Dexie;
    Dexie.dependencies.indexedDB = app.indexedDB;
    Dexie.dependencies.IDBKeyRange = app.IDBKeyRange;
    return Dexie;
  }).then((Dexie) => {
    session.db = new Dexie(config.session.name + '-' + config.session.id);
    session.db.version(config.session.version).stores({
      completed: '++id, date, urls, name, path, size, encoding, mime, threading',
      inprogress: '++id, date, info, obj, internals, file, segments',
      failed: '++id, date, urls, name, size, error'
    });
    session.db.open().then(() => session.db.inprogress.toArray())
      .then(arr => {
        app.emit('session:load', arr);
        // Clean up
        app.Promise.all([
          session.kill.days.failed(config.session.expire.failed),
          session.kill.days.completed(config.session.expire.completed)
        ]).catch(e => console.error('session:error', e));
      })
      .catch((e) => app.emit('session:error', e));
  })
  .catch((e) => app.emit('session:error', e));
};

session.list = {
  inprogress: () => session.db.inprogress.toArray(),
  failed: () => session.db.failed.toArray(),
  completed: () => session.db.completed.toArray()
};

session.kill = (function () {
  function date (days) {
    return new Date((new Date()).getTime() - ((days || 0) * 24 * 60 * 60 * 1000));
  }
  return {
    delete: () => session.db.delete(),
    all: {
      failed: () =>session.db.failed.clear(),
      completed: () => session.db.completed.clear()
    },
    days: {
      failed: (days) => session.db.failed.where('date').below(date(days)).delete(),
      completed: (days) => session.db.completed.where('date').below(date(days)).delete()
    },
    id: {
      failed: (id) => session.db.failed.where('id').equals(id).delete(),
      completed: (id) => session.db.completed.where('id').equals(id).delete()
    }
  };
})();

session.assign = function (wget) {
  if (wget.session) {
    return;
  }
  session.db.inprogress.add({
    'date': new Date(),
    'info': wget.info,
    'stats': wget.stats,
    'obj': wget.obj,
    'internals': {
      ranges: wget.internals.ranges
    },
    'file': {
      name: wget.internals.file.name,
      path: wget.internals.file.path
    },
    'segments': {}
  })
    .then(id => wget.session = id)
    .catch(e => app.emit('session:error', e));
};

session.register = function (wget) {
  if (session.db.dummy) {
    return;
  }
  // assign session id to wget
  if (wget.info) {
    session.assign(wget);
  }
  else {
    wget.event.once('info', () => session.assign(wget));
  }
  // update name
  wget.event.on('name', () => {
    if (wget.session) {
      session.db.inprogress.where('id').equals(wget.session).modify(obj => {
        obj.file.name = wget.internals.file.name;
      }, e => app.emit('session:error', e));
    }
    else {
      app.emit('session:warning', 'wget.session is not yet created');
    }
  });
  wget.event.on('status', (status) => {
    if (status === 'done' || status === 'error') {
      session.db.inprogress.where('id').equals(wget.session).delete().catch(e => app.emit('session:error', e));
      session.db[status === 'done' ? 'completed' : 'failed'].add({
        'date': new Date(),
        'urls': wget.obj.urls,
        'name': wget.internals.file.name,
        'path': wget.internals.file.path || wget.internals.file.root.path,
        'size': wget.info.length,
        'encoding': wget.info.encoding,
        'mime': wget.info.mime,
        'threading': wget.info['multi-thread']
      }).catch(e => app.emit('session:error', e));
    }
    if (status === 'pause') {
      if (wget.session) {
        session.db.inprogress.where('id').equals(wget.session).modify(obj => {
          obj.internals.ranges = wget.internals.ranges;
          obj.stats = wget.stats;
          return obj;
        }).catch(e => app.emit('session:error', e));
      }
      else {
        app.emit('session:warning', 'wget.session is not yet created');
      }
    }
  });
};
