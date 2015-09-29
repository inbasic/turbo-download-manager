/* global background */
'use strict';

var connect = function (elem) {
  var att = 'value';
  if (elem) {
    if (elem.type === 'checkbox') {
      att = 'checked';
    }
    if (elem.localName === 'select') {
      att = 'selectedIndex';
    }
    if (elem.localName === 'span') {
      att = 'textContent';
    }
    var pref = elem.getAttribute('data-pref');
    background.send('get', pref);
    elem.addEventListener('change', function () {
      background.send('changed', {
        pref: pref,
        value: this[att]
      });
    });
  }
  return {
    get value () {
      return elem[att];
    },
    set value (val) {
      if (elem.type === 'file') {
        return;
      }
      elem[att] = val;
    }
  };
};

background.receive('set', function (o) {
  if (window[o.pref]) {
    window[o.pref].value = o.value;
  }
});

var prefs = document.querySelectorAll('*[data-pref]');
[].forEach.call(prefs, function (elem) {
  var pref = elem.getAttribute('data-pref');
  window[pref] = connect(elem, pref);
});

background.receive('info', function (obj) {
  document.querySelector('span[type=title]').textContent = obj.title;
  document.querySelector('span[type=inshort]').textContent = obj.inshort;
  document.title = 'Options - ' + obj.title;
});
background.send('info');
