'use strict';

var app = app || require('./firefox/firefox');
var io = typeof exports === 'undefined' ? {} : exports;

io.File = function (obj) {
  this.root = null;
  this.file = null;
  this.name = obj.name || 'unknown';
  this.length = obj.length;
  this.path = obj.path;
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
    function check (index) {
      if (index) {
        name = me.name.replace(/((\.[^\.]{1,3}){0,1}\.[^\.]+)$/, '-' + index + '$1');
      }
      return app.fileSystem.file.exists(root, name).then(function (bol) {
        if (bol) {
          return check((index || 0) + 1);
        }
        else {
          me.name = name;
          return app.fileSystem.file.create(root, me.name);
        }
      });
    }
    return check();
  })
  .then((file) => me.file = file)
  .then(() => app.fileSystem.file.truncate(me.file, me.length))
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
  return app.fileSystem.file.launch(this.file).then().catch(app.notification);
};
io.File.prototype.reveal = function () {
  return app.fileSystem.file.reveal(this.file).then().catch(app.notification);
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

