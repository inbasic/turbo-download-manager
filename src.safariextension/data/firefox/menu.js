/* global self */
'use strict';

self.on('click', function (node) {
  while ((
    node.tagName.toLowerCase() !== 'a' &&
    node.tagName.toLowerCase() !== 'img' &&
    node.tagName.toLowerCase() !== 'audio' &&
    node.tagName.toLowerCase() !== 'video'
  ) && node.parentNode) {
    node = node.parentNode;
  }
  if (node) {
    var url = node.href || node.src;
    if (node.tagName.toLowerCase() === 'img' && node.parentNode && node.parentNode.tagName.toLowerCase() === 'a') {
      url = node.parentNode.href || url;
    }
    if (node.tagName.toLowerCase() === 'video' || node.tagName.toLowerCase() === 'audio') {
      url = node.src || node.querySelector('source').src;
    }
    self.postMessage({
      url: url,
      referrer: document.location.href
    });
  }
});
