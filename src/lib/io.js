'use strict';

var app = app || require('./firefox/firefox');
var io = typeof exports === 'undefined' ? {} : exports;

io.File = function (obj) {
  this.root = null;
  this.file = null;
  this.name = obj.name || 'unknown';
  this.length = obj.length;
  this.path = obj.path;
  this.append = obj.append;
  this.internal = false;
  this.writers = 0;
  this.flushed = null;
};
io.File.prototype.open = function () {
  let me = this;
  return app.fileSystem.root.external(this.length, this.path).then(
    function (root) {
      me.internal = false;
      return root;
    },
    () => app.fileSystem.root.internal(this.length, this.path).then(function (root) {
      me.internal = true;
      return root;
    })
  ).then(function (root) {
    me.root = root;
    let name = me.name;
    let ext = [].concat.apply([], Object.values(app.mimes))
      .filter(e => name.endsWith(e))
      // longest one
      .sort((a, b) => b.length - a.length)[0] || '';
    if (ext) {
      ext = '.' + ext;
    }
    else {
      let tmp = /\.[^\.]+$/.exec(name);
      if (tmp && tmp.length) {
        ext = tmp[0];
      }
    }

    function check (index, ignore) {
      if (index) {
        name = me.name.replace(ext, '') + '-' + index + ext;
      }
      return app.fileSystem.file.exists(root, name).then(function (bol) {
        if (bol && !ignore) {
          return check((index || 0) + 1);
        }
        else {
          me.name = name;
          return app.fileSystem.file.create(root, me.name);
        }
      });
    }
    return check(null, me.append);
  })
  .then((file) => me.file = file)
  .then(() => me.append ? null : app.fileSystem.file.truncate(me.file, me.length))
  .then(() => me.name);
};
io.File.prototype.write = function (offset, arr) {
  this.writers += 1;
  let me = this;
  return app.fileSystem.file.write(this.file, offset, arr).then(function () {
    me.writers -= 1;
    if (me.writers === 0 && me.flushed) {
      me.flush();
    }
  });
};
io.File.prototype.md5 = function () {
  return app.fileSystem.file.md5(this.file, this.length);
};
io.File.prototype.flush = function () {
  let d = this.flushed || app.Promise.defer();
  if (this.writers) {
    this.flushed = d;
  }
  else {
    if (this.internal) {
      let me = this;
      this.file.file(function (file) {
        let link = document.createElement('a');
        link.download = me.name;
        link.href = URL.createObjectURL(file);
        link.dispatchEvent(new MouseEvent('click'));
        d.resolve();
        // wait for 2 minutes and then remove the temporary file
        window.setTimeout(() => me.file.remove(function () {}, function () {}), 2 * 60 * 1000);
      }, (e) => d.reject(e));
    }
    else {
      return app.Promise.resolve();
    }
  }
  return d.promise;
};
io.File.prototype.launch = function () {
  app.fileSystem.file.launch(this.file).then().catch(e => app.notification(e.message || e));
};
io.File.prototype.reveal = function () {
  app.fileSystem.file.reveal(this.file).then().catch(e => app.notification(e.message || e));
};
io.File.prototype.rename = function (name) {
  let me = this;
  return app.fileSystem.file.exists(this.root, name).then(function (bol) {
    if (bol) {
      throw new Error('a file with the same name already exists');
    }
    return app.fileSystem.file.rename(me.file, me.root, name).then(function (fe) {
      me.name = name;
      me.file = fe;
      return name;
    });
  });
};
io.File.prototype.remove = function () {
  return app.fileSystem.file.remove(this.file);
};
io.File.prototype.close = function () {
  return app.fileSystem.file.close(this.file);
};
io.File.prototype.toURL = function () {
  return app.fileSystem.file.toURL(this.file);
};

