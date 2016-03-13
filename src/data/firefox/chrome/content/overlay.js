/* globals dialog */
'use strict';

var itdmanager = {
  url: null,
  referrer: null,
  name: null,
  radio: null,
  number: null,
  mode: null,
  pointer: null,
  connect: Components.utils.import(
    'resource://jid0-dsq67mf5kjjhiiju2dfb6kk8dfw-at-jetpack/data/firefox/shared/connect.jsm'
  ),

  initialize: function () {
    this.mode = document.getElementById('mode');
    this.url = dialog.mLauncher.source.spec;
    this.name = dialog.mLauncher.suggestedFileName;
    try {
      this.referrer = dialog.mContext.QueryInterface(Components.interfaces.nsIWebNavigation).currentURI.spec;
    }
    catch (e) {}

    this.pointer = dialog.onOK;
    dialog.onOK = this.accept.bind(itdmanager);

    let observer = new MutationObserver(function () {
      itdmanager.attach();
      observer.disconnect();
    });
    observer.observe(this.mode, {
      childList: true
    });
    // make sure normal mode is displayed
    new MutationObserver(function () {
      itdmanager.forceNormal();
    }).observe(document.getElementById('normalBox'), {
      attributes: true
    });
  },
  /* make sure normal mode is active (from FlashGot) */
  forceNormal: function () {
    let basicBox = document.getElementById('basicBox');
    let normalBox = document.getElementById('normalBox');
    if (normalBox && basicBox) {
      if (normalBox.collapsed) {
        let e = document.getElementById('open');
        e.parentNode.collapsed = true;
        e.disabled = true;

        let nodes = normalBox.getElementsByTagName('separator');
        for (let j = nodes.length; j-- > 0;) {
          nodes[j].collapsed = true;
        }

        basicBox.collapsed = true;
        normalBox.collapsed = false;
      }
      window.sizeToContent();
    }
  },
  attach: function () {
    this.radio = document.getElementById('itdmanager-radio');
    this.number = document.getElementById('itdmanager-number');
    if (this.url.indexOf('http') === 0) {
      this.radio.removeAttribute('disabled');
    }
    this.number.addEventListener('change', () => {
      document.querySelector('radiogroup').selectedItem = this.radio;
    }, true);
    this.forceNormal();
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
    this.threads = (function (val) {
      val = val < 1 ? 1 : val;
      val = val > 10 ? 10 : val;
      return val;
    })(this.number.value);
    this.connect.remote.download(this);

    window.close();
    return true;
  },
  detach: function () {
    window.removeEventListener('message', this.message, false);
    let elem = this.radio.parentNode;
    if (elem && elem.parentNode) {
      elem.parentNode.removeChild(elem);
    }
    window.sizeToContent();
    dialog.onOK = this.pointer;
  }
};
itdmanager.initialize();
window.addEventListener('message', itdmanager.message.bind(itdmanager), false);
