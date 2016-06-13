/* globals app */
'use strict';

// electron
var {clipboard, shell, ipcRenderer, remote} = require('electron');
var storage = require('node-persist');
storage.initSync({
  dir: remote.getGlobal('constants').storage,
});

process.once('loaded', () => {
  global.electron = {
    constants: remote.getGlobal('constants'),
    clipboard: {
      readText: clipboard.readText
    },
    shell,
    process,
    storage,
    arguments: () => ipcRenderer.send('arguments'),
    self: require('../../package.json'),
    fs: require('fs'),
    os: require('os'),
    Buffer: require('buffer').Buffer,
    path: require('path'),
    crypt: require('crypto'),
    diskspace: require('diskspace'),
    semver: require('semver'),
    developer: () => ipcRenderer.send('developer'),
    proxy: (proxyRules) => ipcRenderer.send('proxy', proxyRules || ''),
    dialog: () => remote.dialog.showOpenDialog({
      properties: ['openDirectory']
    })
  };
});

ipcRenderer.on('open', (event, cmd) => app.emit('open', cmd));
ipcRenderer.on('download', (event, url) => app.emit('download', {url}));
ipcRenderer.on('command-line', (event, obj) => app.emit('command-line', obj));
