/* globals electron, app, config */
'use strict';

app.globals.browser = 'electron';
app.globals.referrer = false;
app.globals.open = true;

app.storage = (function () {
  let callbacks = {};
  return {
    read: (id) => electron.storage.getItem(id),
    write: (id, data) => {
      if (electron.storage.getItem(id) !== data) {
        electron.storage.setItem(id, data);
        (callbacks[id] || []).forEach(c => c(data));
      }
    },
    on: function (id, callback) {
      callbacks[id] = callbacks[id] || [];
      callbacks[id].push(callback);
    }
  };
})();

app.tab.open = electron.shell.openExternal;

app.version = () => Promise.resolve(electron.self.version);

app.platform = () => `io.js ${electron.process.version} & Electron ${electron.process.versions.electron} on ${electron.process.platform}`;

app.startup = (c) => document.addEventListener('load', c);

app.OS = {
  clipboard: {
    get: () => Promise.resolve(electron.clipboard.readText())
  }
};

app.download = (obj) => electron.shell.openExternal(obj.url);

app.developer = {
  console: electron.developer
};

app.notification = (body) => new window.Notification('Turbo Download Manager', {
  body,
  icon: '../../data/icons/128.png'
});

app.disk.browse = function () {
  return new Promise(function (resolve, reject) {
    let dirs = electron.dialog();
    if (dirs && dirs.length) {
      resolve(dirs[0]);
    }
    else {
      reject();
    }
  });
};

app.fileSystem = {
  file: {
    exists: (root, name) => new Promise((resolve) => electron.fs.exists(electron.path.join(root, name), resolve)),
    create: (root, name) => new Promise(function (resolve) {
      // 'wx+' - Open file for reading and writing. It fails if path exists.
      let url = electron.path.join(root, name);
      electron.fs.open(url, 'wx+', function (err, fd) {
        if (err) {
          throw err;
        }
        resolve({fd, name, root, path: url});
      });
    }),
    truncate: () => Promise.resolve(),
    write: function (file, offset, arr) {
      function write (offset, ab) {
        let buffer = electron.Buffer.from(ab);
        return new Promise(function (resolve, reject) {
          electron.fs.write(file.fd, buffer, 0, buffer.length, offset, function (err, written, buffer) {
            if (err) {
              throw err;
            }
            if (written !== buffer.length) {
              return reject(new Error('written length does not match to the actual buffer size'));
            }
            resolve();
          });
        });
      }
      let m = [];
      let c = offset;
      for (let i = 0; i < arr.length; i++) {
        m.push(write(c, arr[i]));
        c += arr[i].length;
      }
      return Promise.all(m);
    },
    md5: (file) => new Promise(function (resolve) {
      electron.fs.readFile(file.fd, function (err, buf) {
        if (err) {
          throw err;
        }
        let hash = electron.crypt.createHash('md5');
        hash.update(buf);
        resolve(hash.digest('hex'));
      });
    }),
    rename: (file, root, name) => new Promise(function (resolve) {
      let url = electron.path.join(root, name);
      electron.fs.rename(file.path, url, (err) => {
        if (err) {
          throw err;
        }
        electron.fs.open(electron.path.join(root, name), 'r+', function (err, fd) {
          if (err) {
            throw err;
          }
          resolve({fd, name, root, path: url});
          electron.fs.close(file.fd);
        });
      });
    }),
    remove: (file) => new Promise(function (resolve) {
      electron.fs.unlink(file.path, function (err) {
        if (err) {
          throw err;
        }
        resolve();
      });
    }),
    launch: (file) => Promise.resolve(electron.shell.openItem(file.path)),
    reveal: (file) => Promise.resolve(electron.shell.showItemInFolder(file.path)),
    close: (file) => new Promise(function (resolve) {
      electron.fs.close(file.fd, function (err) {
        if (err) {
          throw err;
        }
      });
      resolve();
    }),
    toURL: (file) => Promise.resolve(file.path)
  },
  root: {
    internal: () => new Promise.reject(),
    external: (bytes, url) => new Promise(function (resolve, reject) {
      let root = url ? url : electron.constants.downloads;
      electron.diskspace.check(electron.path.parse(root).root, function (err, total, free) {
        if (err) {
          throw err;
        }
        if (free < bytes) {
          return reject(new Error(`cannot allocate space; available: ${free}, required: ${bytes}`));
        }
        resolve(root);
      });
    })
  }
};

app.sandbox = function (url, options) {
  let d = Promise.defer();
  let webview = document.createElement('webview');
  webview.setAttribute('style', 'display:inline-flex; flex: 0 1; width: 0px; height: 0px;');
  document.body.appendChild(webview);

  function destroy () {
    if (webview) {
      webview.parentNode.removeChild(webview);
      webview = null;
    }
  }

  let id = window.setTimeout(d.reject, options['no-response'], null);
  webview.addEventListener('did-get-redirect-request', function (e) {
    if (e.isMainFrame) {
      window.clearTimeout(id);
      destroy();
      d.resolve(e.newURL);
    }
  });
  webview.addEventListener('crashed', () => {
    destroy();
    d.reject();
  });
  webview.setAttribute('src', url);
  console.error(url);

  return d.promise;
};

app.arguments = function (c) {
  let callback = c || function () {};
  callback(electron.arguments);
  app.on('command-line', (argv) => callback(argv));
};
/* proxy */
app.storage.on('pref.network.proxy-server', electron.proxy);
electron.proxy(config.network['proxy-server']);

/* check for updates */
window.setTimeout(function () {
  let req = new XMLHttpRequest();
  req.open('GET', config.urls.api.list, true);
  req.responseType = 'json';
  req.onload = function () {
    let versions = req.response
      .filter(obj => obj.prerelease === false || config.electron.update === 'prerelease')
      .map(o => o.tag_name)
      .filter(v => electron.semver.compare(v, electron.self.version) > 0);

    if (versions.length) {
      let version = versions.shift();
      let url = `${config.urls.releases}download/${version}/tdm-${electron.process.platform}-${electron.os.arch()}.7z`;
      app.manager.send('electron:update', {
        title: `New version of "Turbo Download Manager" is available (${version}). Would you like to update?`,
        url,
        referrer: config.urls.releases
      });
    }
  };
  req.send();
}, 10000);
