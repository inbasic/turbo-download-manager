/* global self */
'use strict';

function click (node) {
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
    return {
      url: url,
      referrer: node.ownerDocument.location.href
    };
  }
}
if (typeof self !== 'undefined') {
  self.on('click', (node) => self.postMessage(click(node)));
}
if (typeof exports !== 'undefined') {
  exports.click = click;
}
