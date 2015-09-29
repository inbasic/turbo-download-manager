/* globals dialog */
'use strict';

var itdmanager = {
  url: null,
  referrer: null,
  name: null,
  radio: null,
  mode: null,
  pointer: null,
  connect: Components.utils.import(
    'resource://jid0-dsq67mf5kjjhiiju2dfb6kk8dfw-at-jetpack/itdmanager/data/firefox/shared/connect.jsm'
  ),

  initialize: function () {
    this.mode = document.getElementById('mode');
    this.url = dialog.mLauncher.source.spec;
    this.name = dialog.mLauncher.suggestedFileName;
    try {
      this.referrer = dialog.mContext.QueryInterface(Components.interfaces.nsIWebNavigation).currentURI.spec;
    }
    catch (e) {
    }
    this.pointer = dialog.onOK;
    dialog.onOK = this.accept.bind(itdmanager);

    var observer = new MutationObserver(function(mutations) {
      itdmanager.attach();
      observer.disconnect();
    });
    observer.observe(this.mode, { childList: true });
  },
  attach: function () {
    this.radio = document.getElementById('itdmanager-radio');
    if (true || this.url.indexOf('http') === 0) {
      this.radio.removeAttribute('disabled');
    }
    window.sizeToContent();
  },
  message: function (e) {
    if (e.data === 'detach') {
      this.detach();
    }
  },
  accept: function () {
    if (this.mode.selectedItem.id !== 'itdmanager-radio') {
      return this.pointer.apply(dialog, arguments);
    }
    this.connect.remote.download(this);

    window.close();
    return true;
  },
  detach: function () {
    window.removeEventListener('message', this.message, false);
    var elem = this.radio.parentNode;
    if (elem && elem.parentNode) {
      elem.parentNode.removeChild(elem);
    }
    window.sizeToContent();
    dialog.onOK = this.pointer;
  }
};
itdmanager.initialize();
window.addEventListener('message', itdmanager.message.bind(itdmanager), false);
