'use strict';

var http = require('http');
var path = require('path');
var send = require('send');
var url = require('url');
var os = require('os');
var ifaces = os.networkInterfaces();

function getUserHome() {
  return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
}

var root = path.join(getUserHome(), 'Desktop');
console.error(`Mirroring ${root} to ${ifaces.en0.map(o => `http://${o.address}:3000`).join(', ')}`);

http.createServer(function (req, res) {
  // your custom error-handling logic:
  function error(err) {
    res.statusCode = err.status || 500;
    res.end(err.message);
  }

  // your custom headers
  function headers(res) {
    // serve all files for download
    res.setHeader('Content-Disposition', 'attachment');
  }

  // your custom directory handling logic:
  function redirect() {
    res.statusCode = 301;
    res.setHeader('Location', req.url + '/');
    res.end('Redirecting to ' + req.url + '/');
  }

  // transfer arbitrary files from within
  // /www/example.com/public/*
  send(req, url.parse(req.url).pathname, {root: root})
  .on('error', error)
  .on('directory', redirect)
  .on('headers', headers)
  .pipe(res);
}).listen(3000);
