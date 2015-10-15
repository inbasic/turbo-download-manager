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
  utils.validate = (function () {
    //https://gist.github.com/dperini/729294
    var weburl = new RegExp(
      '^' +
        '(?:(?:https?|ftp)://)' +
        '(?:\\S+(?::\\S*)?@)?' +
        '(?:' +
          '(?!(?:10|127)(?:\\.\\d{1,3}){3})' +
          '(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})' +
          '(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})' +
          '(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])' +
          '(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}' +
          '(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))' +
        '|' +
          '(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)' +
          '(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*' +
          '(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))' +
        ')' +
        '(?::\\d{2,5})?' +
        '(?:/\\S*)?' +
      '$', 'i'
    );
    return function (url) {
      return weburl.test(url.replace(/ /g, '%20'));
    };
  })();
})();
