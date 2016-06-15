'use strict';

var app = app || require('./firefox/firefox');
var config = config || require('./config');
var mwget = mwget || require('./mwget');
var utils = utils || require('./utils');

/* button */
app.button.onCommand(function () {
  app.tab.list().then(function (tabs) {
    tabs = tabs.filter(t => t && t.url.indexOf(app.getURL('manager/index.html')) === 0);
    if (tabs.length) {
      app.tab.activate(tabs[0]);
    }
    else {
      app.tab.open(app.getURL('./manager/index.html'));
    }
  });
});

/* - */
var actions = {};
actions.download = function (obj) {
  obj.threads = obj.threads || config.wget.threads;
  obj.timeout = obj.timeout * 1000 || config.wget.timeout * 1000;
  obj.update = obj.update * 1000 || config.wget.update * 1000;
  obj.pause = obj.pause || config.wget.pause;
  obj['short-pause'] = obj['short-pause'] || config.wget['short-pause'];
  obj['use-native'] = obj['use-native'] || false;
  obj['write-size'] = obj['write-size'] || config.wget['write-size'];
  obj['max-size-md5'] = obj['max-size-md5'] || config.wget['max-size-md5'];
  obj.retries = obj.retries || config.wget.retries;
  obj.folder = obj.folder || config.wget.directory;
  obj['min-segment-size'] = obj['min-segment-size'] || config.wget['min-segment-size'];
  obj['max-segment-size'] = obj['max-segment-size'] || config.wget['max-segment-size'];

  // pause trigger
  obj['auto-pause'] = obj['auto-pause'] ||
    (config.triggers.pause.enabled && mwget.count() >= config.triggers.pause.value);

  // on Android and Opera, there is no directory selection
  if (!obj.folder && config.wget['notice-download'] && app.globals.folder) {
    app.notification('Saving in the default download directory. Add a new job from manager to change the directory.');
    config.wget['notice-download'] = false;
  }
  mwget.download(obj);
};
actions.open = {
  bug: () => app.tab.open(config.urls.bug),
  faq: () => app.tab.open(config.urls.faq),
  helper: () => app.tab.open(config.urls.helper),
  sourceforge: () => app.tab.open(config.urls.sourceforge),
  releases: () => app.tab.open(config.urls.releases),
  developer: () => app.developer.console(),
  triggers: () => app.manager.send('triggers'),
  extract: (url) => app.manager.send('extract', url),
  preview: (obj) => app.manager.send('preview', obj),
  config: () => app.manager.send('config'),
  about: () => app.manager.send('about')
};
actions.update = (function () {
  function fetch (url) {
    return new app.Promise(function (resolve, reject) {
      let req = new app.XMLHttpRequest();
      req.open('GET', url, true);
      req.onload = () => resolve(JSON.parse(req.responseText));
      req.onerror = (e) => reject(e);
      req.send();
    });
  }
  return {
    release: () => fetch(config.urls.api.latest),
    latest: () => fetch(config.urls.api.list).then(response => response[0])
  };
})();

// supporting comma separated or array of urls
(function (pointer) {
  actions.download = function (obj) {
    let urls = obj.url;
    if (typeof urls === 'string') {
      urls = urls.replace(/\s*\,\s*http/g, String.fromCharCode(0) + 'http').split(String.fromCharCode(0));
    }
    if (urls.length > 1) {
      obj.alternatives = [];
      obj.name = '';
    }
    urls.map(url => Object.assign({}, obj, {url})).forEach(pointer);
  };
})(actions.download);
app.on('open', function (cmd) {
  if (cmd in actions.open) {
    actions.open[cmd]();
  }
});
/* connect */
app.on('download', actions.download);

/* context menu */
(function (arr) {
  if (app.globals.browser !== 'opera') {
    arr.push(
      ['Bypass page redirection then download', (obj) => actions.download(Object.assign(obj, {
        'use-native': true
      }))],
      ['Bypass page redirection then pause', (obj) => actions.download(Object.assign(obj, {
        'use-native': true,
        'auto-pause': true
      }))]
    );
  }
  app.menu.bind(app, 'Turbo Download Manager').apply(app, arr);
})([
  ['Download now', actions.download],
  ['Download later', (obj) => actions.download(Object.assign(obj, {
    'auto-pause': true
  }))]
]);

/* manager */
mwget.addEventListener('done', (id, status) => app.manager.send('status', {id, status}));
mwget.addEventListener('add', (id) => app.manager.send('new', id));
mwget.addEventListener('details', function (id, type, value) {
  if (type === 'name') {
    app.manager.send('name', {id, name: value});
  }
  if (type === 'mime') {
    app.manager.send('mime', {id, mime: value});
  }
  if (type === 'status') {
    app.manager.send('status', {id, status: value});
    app.info.send('status', {id, status: value});
  }
  // start trigger
  if (type === 'status' && config.triggers.start.enabled) {
    if (value === 'error' || value === 'pause' || value === 'done') {
      if (mwget.count() < config.triggers.start.value) {
        let instance = mwget.list().filter(i => i.status === 'pause' && i.internals.available).shift();
        if (instance) {
          mwget.resume(mwget.id(instance));
        }
      }
    }
  }
  // success trigger
  if (type === 'status' && value === 'done' && config.triggers.success.enabled) {
    app.timer.setTimeout(mwget.remove, config.triggers.success.value * 60 * 1000, id);
  }
  // fail trigger
  if (type === 'status' && value === 'error' && config.triggers.fail.enabled) {
    app.timer.setTimeout(mwget.remove, config.triggers.fail.value * 60 * 1000, id);
  }
  // play-single trigger
  if (type === 'status' && value === 'done' && config.triggers['play-single'].enabled) {
    app.play('sounds/1.ogg');
  }
  // play-combined trigger
  if (type === 'status' && value === 'done' && config.triggers['play-combined'].enabled) {
    if (!config.triggers['play-single'].enabled && mwget.count() === 0) {
      app.play('sounds/1.ogg');
    }
  }
  if (type === 'count') {
    app.manager.send('count', {id, count: value});
  }
  if (type === 'info') {
    app.manager.send('size', {id, size: value.length});
    app.manager.send('chunkable', {id, chunkable: value['multi-thread']});
  }
  if (type === 'retries') {
    app.manager.send('retries', {id, retries: value});
  }
});
mwget.addEventListener('percent', function (id, remained, length) {
  let tmp = (length - remained) / length * 100;
  app.manager.send('percent', {id, percent: tmp});
});
mwget.addEventListener('total-percent', (percent) => app.manager.send('total-percent', percent));
mwget.addEventListener('speed', (id, speed, remained) => {
  app.manager.send('speed', {id, speed, time: remained / speed});
});
mwget.addEventListener('progress', (id, stat) => app.manager.send('progress', {id, stat}));
mwget.addEventListener('logs', (id, log) => app.info.send('log', {id, log: [log]}));
app.manager.receive('init', function () {
  let instances = mwget.list();
  instances.forEach(function (instance, id) {
    app.manager.send('add', {
      'id': id,
      'name': instance.internals.name,
      'mime': instance.info ? instance.info.mime : '',
      'size': instance.info ? instance.info.length : 0,
      'percent': instance.info ? (instance.info.length - instance.remained) / instance.info.length * 100 : 0,
      'chunkable': instance.info ? instance.info['multi-thread'] : false,
      'stats': mwget.stats(id),
      'status': instance.status,
      'speed': instance.speed,
      'threads': instance.threads,
      'retries': instance.retries
    });
  });
});
app.manager.receive('cmd', function (obj) {
  if (obj.cmd === 'pause') {
    mwget.pause(obj.id);
  }
  if (obj.cmd === 'resume') {
    mwget.resume(obj.id);
  }
  if (obj.cmd === 'trash') {
    mwget.remove(obj.id);
  }
  if (obj.cmd === 'cancel') {
    mwget.cancel(obj.id);
  }
  if (obj.cmd === 'info') {
    app.manager.send('info', obj.id);
  }
  if (obj.cmd === 'modify') {
    app.manager.send('modify', obj.id);
  }
  if (obj.cmd === 'native') {
    let instance = mwget.get(obj.id);
    app.download({
      url: instance.info ? instance.info.url : instance.obj.url,
      name: instance.internals.name,
      path: instance.obj.folder
    });
  }
  if (obj.cmd === 'use-native') {
    let instance = mwget.get(obj.id);
    actions.download(Object.assign(instance.obj, {
      'use-native': true
    }));
  }
  if (obj.cmd === 'open') {
    let instance = mwget.get(obj.id);
    let file = instance.internals.file;
    if (!file) {
      return app.notification('Preview is not available. Please try again later.');
    }
    if (instance.status === 'done' && app.globals.open && config.manager['launch-if-done']) {
      return instance.internals.file.launch();
    }
    if (instance.status !== 'error') {
      let mime = instance.info.mime;
      let type = mime.split('/')[0];
      if (['audio', 'video', 'image'].indexOf(type) !== -1) {
        let path = config.preview.external[type].path;
        if (path) {
          let args = config.preview.external[type].args.split(/\s+/).filter(a => a);
          return app.process(path, file, args).catch(e => app.notification(e.message || e));
        }
      }
      file.toURL().then(
        url => actions.open.preview({url, mime}),
        (e) => app.notification(e.message)
      );
    }
  }
  if (obj.cmd === 'reveal') {
    let instance = mwget.get(obj.id);
    if (app.globals.reveal) {
      return instance.internals.file.reveal();
    }
    app.notification('Opening container folder is not supported in this platform');
  }
  if (obj.cmd === 'download') {
    actions.download(obj);
  }
});
app.manager.receive('open', app.emit.bind(app, 'open'));
/* add ui */
app.add.receive('download', function (obj) {
  app.manager.send('hide');
  if (obj.threads) {
    config.wget.threads = obj.threads;
  }
  if (obj.timeout) {
    config.wget.timeout = obj.timeout;
  }
  actions.download(obj);
});
app.add.receive('cmd', function (obj) {
  if (obj.cmd === 'browse') {
    app.disk.browse().then(function (directory) {
      config.wget.directory = directory;
      app.add.send('folder', directory);
    }, function () {});
  }
  if (obj.cmd === 'empty') {
    config.wget.directory = '';
  }
});
app.add.receive('init', function () {
  app.OS.clipboard.get().then(function (clipboard) {
    // is clipboard a comma separated array of urls
    let isValid = clipboard.split(/\s*\,\s*/).map(utils.validate).reduce((p, c) => p && c, true);
    app.add.send('init', {
      settings: {
        threads: config.wget.threads,
        timeout: config.wget.timeout,
        folder: config.wget.directory
      },
      clipboard: isValid ? clipboard : ''
    });
  });
});
app.add.receive('no-folder', () => app.notification('Please select the destination folder using the "browse" button'));
/* info ui */
app.info.receive('init', function (id) {
  app.info.send('log', {
    id,
    log: mwget.log(id)
  });
  app.info.send('status', {
    id: id,
    status: mwget.get(id).status
  });
});
app.info.receive('cmd', function (obj) {
  if (obj.cmd === 'folder') {
    mwget.get(obj.id).internals.file.reveal();
  }
  if (obj.cmd === 'file') {
    mwget.get(obj.id).internals.file.launch();
  }
  if (obj.cmd === 'remove') {
    mwget.remove(obj.id);
    app.manager.send('hide');
  }
});
app.info.receive('open', app.tab.open);
/* modify ui */
app.modify.receive('init', function (id) {
  let instance = mwget.get(id);
  if (instance) {
    app.modify.send('init', {
      url: instance.info ? instance.info.url : instance.obj.url,
      name: instance.internals.name,
      threads: instance.obj.threads,
      timeout: instance.obj.timeout / 1000
    });
  }
});
app.modify.receive('modified', function (obj) {
  app.manager.send('hide');
  let instance = mwget.get(obj.id);
  if (instance) {
    instance.modify(obj);
  }
});
/* triggers ui */
app.triggers.receive('init', function () {
  app.triggers.send('init', {
    pause: {
      enabled: config.triggers.pause.enabled,
      value: config.triggers.pause.value
    },
    start: {
      enabled: config.triggers.start.enabled,
      value: config.triggers.start.value
    },
    fail: {
      enabled: config.triggers.fail.enabled,
      value: config.triggers.fail.value
    },
    success: {
      enabled: config.triggers.success.enabled,
      value: config.triggers.success.value
    },
    'play-single': {
      enabled: config.triggers['play-single'].enabled
    },
    'play-combined': {
      enabled: config.triggers['play-combined'].enabled
    }
  });
});
app.triggers.receive('change', function (obj) {
  config.triggers[obj.id].value = obj.value;
  config.triggers[obj.id].enabled = obj.enabled;
  app.triggers.send('change', {
    name: obj.id,
    settings: {
      enabled: config.triggers[obj.id].enabled,
      value: config.triggers[obj.id].value
    }
  });
});
/* about ui */
app.about.receive('init', function () {
  app.version().then(version => app.about.send('init', {
    version,
    platform: app.platform()
  }));
  actions.update.release().then(obj => app.about.send('release', obj));
  actions.update.latest().then(obj => app.about.send('latest', obj));
});
app.about.receive('open', url => app.tab.open(url));
/* extract ui */
if (app.webRequest) {
  app.webRequest.media(obj => app.extract.send('media', obj));
}
/* config ui */
app.config.receive('init', function () {
  app.config.send('init', config.list());
});
app.config.receive('pref', function (obj) {
  try {
    config.set(obj.name, obj.value);
  }
  catch (e) {
    app.notification(e.message);
  }
  app.config.send('pref', {
    name: obj.name,
    value: config.get(obj.name)
  });
});
app.config.receive('reset', function (name) {
  config.reset(name);
  app.config.send('pref', {
    name,
    value: config.get(name)
  });
});
/* preview ui */
app.preview.receive('open', url => app.tab.open(url));
/* startup */
app.startup(function () {
  // FAQs page
  let version = config.welcome.version;
  app.version().then(function (v) {
    if (v !== version) {
      app.timer.setTimeout(function () {
        app.tab.open(
          config.urls.faq + '?v=' + v +
          (version ? '&p=' + version + '&type=upgrade' : '&type=install')
        );
        config.welcome.version = v;
      }, config.welcome.timeout);
    }
  });
});

/* command line */
app.arguments(function (argv) {
  // Download on init (currently only for electron build)
  if (argv && argv.url) {
    actions.download(argv);
  }
});
