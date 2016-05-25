/* globals background */
'use strict';
'use strict';

var url = /url\=([^\&]+)/.exec(document.location.search);
if (url && url.length) {
  url = decodeURIComponent(url[1]);
}
var mime = /mime\=([^\&]+)/.exec(document.location.search);
if (mime && mime.length) {
  mime = decodeURIComponent(mime[1]);
}
console.error(url, mime, document.location.search);
