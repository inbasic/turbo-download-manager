'use strict';

/**** wrapper (start) ****/
if (typeof require !== 'undefined') {
  var app = require('./firefox/firefox');
  var utils = exports;
}
/**** wrapper (end) ****/

(function () {
  // debounce
  utils.debounce = function (original, limit) {
    let id, wait = false;
    function rtn () {
      if (!wait) {
        app.timer.clearTimeout(id);
        wait = true;
        original.apply(this, arguments);
        id = app.timer.setTimeout(function () {
          wait = false;
        }, limit);
      }
    }
    rtn.now = function () {
      wait = false;
      rtn.apply(this, arguments);
    };
    return rtn;
  };
  // validate
  utils.validate = function (url) {
    try {
      let test = new app.URL(url);
      return !!test.host;
    }
    catch (e) {
      return false;
    }
  };
})();

utils.assign = function (obj, name, event, value) {
  let tmp = value;
  Object.defineProperty(obj, name, {
    get: function () {
      return tmp;
    },
    set: function (val) {
      if (val !== tmp) {
        tmp = val;
        event.emit(name, tmp);
      }
    }
  });
  return utils;
};
