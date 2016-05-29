'use strict';

var url = /url\=([^\&]+)/.exec(document.location.search);
if (url && url.length) {
  url = decodeURIComponent(url[1]);
}
var mime = /mime\=([^\&]+)/.exec(document.location.search);
if (mime && mime.length) {
  mime = decodeURIComponent(mime[1]);
}

var aaa;

if (mime.split('/')[0] === 'video' && url) {
  document.getElementById('video').style.display = 'flex';
  window.videojs('video-player', {}, function () {
    //document.body.dataset.fullscreen = this.supportsFullScreen();
    this.src([{
      'type': mime,
      'src': url
    }]);
    aaa = this;
  });
}
else if (mime.split('/')[0] === 'audio' && url) {
  let source = document.createElement('source');
  let audio = document.querySelector('audio');

  source.setAttribute('src', url);
  source.setAttribute('mime', mime);
  audio.appendChild(source);
  document.getElementById('audio').style.display = 'flex';
  audio.play();
}
else if (mime.split('/')[0] === 'image' && url) {
  let image = document.querySelector('img');
  image.src = url;
  document.getElementById('image').style.display = 'flex';
}
else {
  document.getElementById('not-supported').style.display = 'flex';
}
