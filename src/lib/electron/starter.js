'use strict';
// electron
var electron = require('electron');
var BrowserWindow = electron.BrowserWindow;
var ipcMain = require('electron').ipcMain;
// node
var path = require('path');
// community libs
var optimist = require('optimist');
var windowState = require('electron-window-state');
var storage = require('node-persist');

var mainWindow;

global.constants = {
  userData: electron.app.getPath('userData'),
  downloads: electron.app.getPath('downloads'),
  storage: path.join(electron.app.getPath('userData'), 'node-persist'),
};
// local shortcuts
(function (register, release) {
  electron.app.on('ready', register);
  electron.app.on('will-quit', release);
  electron.app.on('browser-window-blur', release);
  electron.app.on('browser-window-focus', register);
})(
  () => electron.globalShortcut.register('CmdOrCtrl+Shift+J', () => mainWindow.webContents.toggleDevTools()),
  () => electron.globalShortcut.unregisterAll()
);

// syncing storage
storage.initSync({dir: global.constants.storage});

ipcMain.on('developer', () => mainWindow.webContents.toggleDevTools());
ipcMain.on('proxy', function (e, proxyRules) {
  mainWindow.webContents.session.setProxy({proxyRules}, function () {
    console.error(`proxyRules is changed to "${proxyRules}"`);
  });
});
ipcMain.once('arguments', () => mainWindow.webContents.send('command-line', optimist.parse(process.argv)));

/* internals */
var contextmenu = (function () {
  let edit = (flags, link) => [
    {label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:', enabled: flags.canUndo},
    {label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:', enabled: flags.canRedo},
    {type: 'separator'},
    {label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:', enabled: flags.canCut},
    {label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:', enabled: flags.canCopy},
    {label: 'Copy Link Location', visible: !!link, click () {
      electron.clipboard.writeText(link);
    }},
    {label: 'Download Link', visible: !!link, click () {
      mainWindow.webContents.send('download', link);
    }},
    {label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:', enabled: flags.canPate},
    {label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:', enabled: flags.canSelectAll}
  ];
  let application = [
    {label: 'About Application', click: () => mainWindow.webContents.send('open', 'about')},
    {label: 'Check for Updates...', click: () => mainWindow.webContents.send('open', 'releases')},
    {type: 'separator'},
    {label: 'Adjust Triggers', click: () => mainWindow.webContents.send('open', 'triggers')},
    {label: 'Configuration Editor', click: () => mainWindow.webContents.send('open', 'config')},
    {label: 'Developer Tools', accelerator: 'CmdOrCtrl+Shift+J', click: () => mainWindow.webContents.send('open', 'developer')},
    {type: 'separator'},
    {label: 'Quit', accelerator: 'Command+Q', click: function () {
      electron.app.quit();
    }}
  ];
  let help = [
    {label: 'Open FAQs Page', click: () => mainWindow.webContents.send('open', 'faq')},
    {label: 'Open Bug Reporter', click: () => mainWindow.webContents.send('open', 'bug')}
  ];

  return {
    app: () => electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate([
      {label: 'Turbo Download Manager', submenu: application},
      {label: 'Edit', submenu: edit({})},
      {label: 'Help', submenu: help}
    ])),
    edit: (win) => win.webContents.on('context-menu', function (e, props) {
      electron.Menu.buildFromTemplate(edit(props.editFlags, props.linkURL)).popup(mainWindow);
    })
  };
})();

function createWindow () {
  // single instance
  let iShouldQuit = electron.app.makeSingleInstance(function (commandLine) {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('command-line', optimist.parse(commandLine));
    }
    else {
      ipcMain.once('arguments', () => mainWindow.webContents.send('command-line', optimist.parse(commandLine)));
      createWindow();
    }
    return true;
  }) && !optimist.parse(process.argv).forced;

  if (iShouldQuit) {
    electron.app.quit();
  }
  else {
    let state = windowState({
      defaultWidth: 800,
      defaultHeight: 700
    });
    mainWindow = new BrowserWindow({
      width: state.width,
      height: state.height,
      x: state.x,
      y: state.y,
      webPreferences: {
        // disable the same-origin policy
        webSecurity: false,
        // For security purpose, webview can only be used in BrowserWindows that have nodeIntegration enabled.
        nodeIntegration: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    let props = {};
    let userAgent = storage.getItem('pref.electron.user-agent');
    if (userAgent) {
      props.userAgent = userAgent;
    }
    mainWindow.loadURL('file://' + __dirname + '/background.html', props);
    mainWindow.on('closed', () => mainWindow = null);
    state.manage(mainWindow);
  }
}

electron.app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

electron.app.on('browser-window-created', (e, win) => contextmenu.edit(win));
// do not allow redirection of the background page
electron.app.on('browser-window-created', (e, win) => win.webContents.on('will-navigate',function (e) {
  e.preventDefault();
  return false;
}));
// supporting referer
electron.app.on('browser-window-created', (e, win) => win.webContents.session.webRequest.onBeforeSendHeaders(
  {urls: ['https://*', 'http://*']},
  (details, callback) => {
    let referer = details.requestHeaders['X-Referer'] || details.requestHeaders['x-referer'];
    if (referer) {
      details.requestHeaders.referer = referer;
      delete details.requestHeaders['X-Referer'];
      delete details.requestHeaders['x-referer'];
    }
    callback({requestHeaders: details.requestHeaders});
  }
));

// Chrome Command Line Switches
electron.app.on('ready', () => {
  createWindow();
  if (process.platform === 'darwin') {
    contextmenu.app();
  }
});

electron.app.on('window-all-closed', function () {
  // synchronizing storage
  storage.initSync({dir: global.constants.storage});
  if (storage.getItem('pref.electron.exit-on-close') !== false) {
    electron.app.quit();
  }
});
