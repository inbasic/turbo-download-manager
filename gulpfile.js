'use strict';

var gulp = require('gulp');
var change = require('gulp-change');
var babel = require('gulp-babel');
var gulpif = require('gulp-if');
var gulpFilter = require('gulp-filter');
var shell = require('gulp-shell');
var wait = require('gulp-wait');
var clean = require('gulp-clean');
var zip = require('gulp-zip');
var rename = require('gulp-rename');
var util = require('gulp-util');
var runSequence = require('run-sequence');

/* clean */
gulp.task('clean', function () {
  return gulp.src([
    'builds/unpacked/chrome/*',
    'builds/unpacked/opera/*',
    'builds/unpacked/firefox/*',
    'builds/unpacked/electron/*',
    'builds/unpacked/android/*'
  ], {read: false})
    .pipe(clean());
});

function json (clean) {
  let config = require('./package.json');
  let version = config.version;
  if (clean) {
    version = version.replace(/.beta*/, '');
  }
  return gulpif(f => f.relative.endsWith('.json') || f.relative.endsWith('.xml'), change(content => content
    .replace('%title;', config.title)
    .replace('%name;', config.name)
    .replace('%description;', config.description)
    .replace('%license;', config.license)
    .replace('%version;', version)
    .replace('%author;', config.author)
    .replace('%email;', config.email)
    .replace('%homepage;', config.homepage)
    .replace('%repository.url;', config.repository.url)
    .replace('%bugs.url;', config.bugs.url)
    .replace('config.keywords', JSON.stringify(config.keywords))
  ));
}

function shadow (browser) {
  let c1 = `    <script src="${browser}/${browser}.js"></script>\n    <script src="index.js"></script>`;
  let c2 = `    <script src="showdown.js"></script>\n    <script src="${browser}/${browser}.js"></script>\n    <script src="index.js"></script>`;
  let c3 = `    <script src="videojs/video.js"></script>\n    <script src="${browser}/${browser}.js"></script>\n    <script src="index.js"></script>`;
  return gulpif(f => f.relative.endsWith('info/index.html'),
    change(content => content.replace(/.*shadow_index\.js.*/, c2)),
    gulpif(f => f.relative.endsWith('preview/index.html'),
      change(content => content.replace(/.*shadow_index\.js.*/, c3)),
      gulpif(f => f.relative.endsWith('.html'), change(content => content.replace(/.*shadow_index\.js.*/, c1)))
    )
  )
}

/* electron build */
gulp.task('electron-build', function () {
  return gulp.src([
    'src/**/*'
  ])
  .pipe(gulpFilter(function (f) {
    if (f.relative.endsWith('.DS_Store') || f.relative.endsWith('Thumbs.db')) {
      return false;
    }
    if (f.relative.indexOf('firefox') !== -1 || f.relative.indexOf('android') !== -1 || f.relative.indexOf('opera') !== -1) {
      return false;
    }
    if (f.relative.indexOf('chrome') !== -1 && !f.relative.endsWith('electron/chrome-cm.js') && !f.relative.endsWith('electron/chrome-shim.js')) {
      return false;
    }
    if (f.relative.split('/').length === 1) {
      return f.relative === 'package-electron.json';
    }
    return true;
  }))
  .pipe(rename(function (path) {
    if (path.basename === 'package-electron') {
      path.basename = 'package';
    }
    return path;
  }))
  .pipe(json())
  .pipe(gulpif(function (f) {
    return f.path.indexOf('.js') !== -1 && f.path.indexOf('.json') === -1;
  }, change(function (content) {
    return content.replace('firefox/firefox', 'electron/starter');
  })))
  .pipe(shadow('electron'))
  .pipe(gulp.dest('builds/unpacked/electron'))
});
gulp.task('electron-pack', function () {
  return gulp.src([
    'builds/unpacked/electron/**/*'
  ])
  .pipe(zip('electron.zip'))
  .pipe(gulp.dest('builds/packed'));
});
gulp.task('electron-install', function () {
  let keys = Object.keys(gulp.env).filter(key => key !== '_');
  let args = keys.map(key => `--${key}="${gulp.env[key]}"`).join(' ');
  return gulp.src('')
  .pipe(wait(1000))
  .pipe(shell([
    '"/Applications/Electron.app/Contents/MacOS/Electron" `pwd` ' + args + ' &'
  ], {
    cwd: './builds/unpacked/electron'
  }));
});
gulp.task('electron-packager', function () {
  return gulp.src('')
  .pipe(wait(1000))
  .pipe(shell([
    'npm install',
    'electron-packager . "Turbo Download Manager" --platform=darwin --arch=x64 --version=1.2.2 --icon ../../packed/mac.icns',
    'mv "Turbo Download Manager-darwin-x64" tdm-darwin-x64',
    '7z a -mx9 -r tdm-darwin-x64.7z tdm-darwin-x64/*',
    'mv tdm-darwin-x64.7z ../..',
    'rm -r tdm-darwin-x64/',
    'electron-packager . "Turbo Download Manager" --platform=win32 --arch=x64 --version=1.2.2 --icon ../../packed/windows.ico',
    'mv "Turbo Download Manager-win32-x64" tdm-win32-x64',
    '7z a -mx9 -r tdm-win32-x64.7z tdm-win32-x64/*',
    'mv tdm-win32-x64.7z ../..',
    'rm -r tdm-win32-x64/',
    'electron-packager . "Turbo Download Manager" --platform=win32 --arch=ia32 --version=1.2.2 --icon ../../packed/windows.ico',
    'mv "Turbo Download Manager-win32-ia32" tdm-win32-ia32',
    '7z a -mx9 -r tdm-win32-ia32.7z tdm-win32-ia32/*',
    'mv tdm-win32-ia32.7z ../..',
    'rm -r tdm-win32-ia32/',
    'electron-packager . "Turbo Download Manager" --platform=linux --arch=x64 --version=1.2.2',
    'mv "Turbo Download Manager-linux-x64" tdm-linux-x64',
    '7z a -mx9 -r tdm-linux-x64.7z tdm-linux-x64/*',
    'mv tdm-linux-x64.7z ../..',
    'rm -r tdm-linux-x64/',
    'electron-packager . "Turbo Download Manager" --platform=linux --arch=ia32 --version=1.2.2',
    'mv "Turbo Download Manager-linux-ia32" tdm-linux-ia32',
    '7z a -mx9 -r tdm-linux-ia32.7z tdm-linux-ia32/*',
    'mv tdm-linux-ia32.7z ../..',
    'rm -r tdm-linux-ia32/'
  ], {
    cwd: './builds/unpacked/electron'
  }));
});
/* chrome build */
gulp.task('chrome-build', function () {
  return gulp.src([
    'src/**/*'
  ])
  .pipe(gulpFilter(function (f) {
    if (f.relative.endsWith('.DS_Store') || f.relative.endsWith('Thumbs.db')) {
      return false;
    }
    if (f.relative.indexOf('firefox') !== -1 || f.relative.indexOf('opera') !== -1 || f.relative.indexOf('android') !== -1 || f.relative.indexOf('electron') !== -1) {
      return false;
    }
    if (f.relative.split('/').length === 1) {
      return f.relative === 'manifest-app.json';
    }
    return true;
  }))
  .pipe(rename(function (path) {
    if (path.basename === 'manifest-app') {
      path.basename = 'manifest';
    }
    return path;
  }))
  .pipe(json(true))
  .pipe(shadow('chrome'))
  .pipe(gulp.dest('builds/unpacked/chrome'))
  .pipe(zip('chrome.zip'))
  .pipe(gulp.dest('builds/packed'));
});
gulp.task('chrome-install', function () {
  return gulp.src('')
  .pipe(wait(1000))
  .pipe(shell([
    '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --console --load-and-launch-app=`pwd` &'
  ], {
    cwd: './builds/unpacked/chrome'
  }));
});
/* opera build */
gulp.task('opera-build', function () {
  return gulp.src([
    'src/**/*'
  ])
  .pipe(gulpFilter(function (f) {
    if (f.relative.endsWith('.DS_Store') || f.relative.endsWith('Thumbs.db')) {
      return false;
    }
    if (f.relative.indexOf('firefox') !== -1 || f.relative.indexOf('android') !== -1 || f.relative.indexOf('electron') !== -1) {
      return false;
    }
    if (f.relative.indexOf('chrome') !== -1 && f.relative.indexOf('chrome-cm.js') === -1 && f.relative.indexOf('chrome-br.js') === -1) {
      return false;
    }
    if (f.relative.split('/').length === 1) {
      return f.relative === 'manifest-extension.json';
    }
    return true;
  }))
  .pipe(rename(function (path) {
    if (path.basename === 'manifest-extension') {
      path.basename = 'manifest';
    }
    return path;
  }))
  .pipe(json(true))
  .pipe(shadow('opera'))
  .pipe(gulp.dest('builds/unpacked/opera'))
  .pipe(zip('opera.zip'))
  .pipe(gulp.dest('builds/packed'));
});
gulp.task('opera-install', function () {
  gulp.src('')
  .pipe(wait(1000))
  .pipe(shell([
    '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --console --load-and-launch-app=`pwd` &'
  ], {
    cwd: './builds/unpacked/opera'
  }));
});
/* android build */
gulp.task('android-build', function () {
  return gulp.src([
    'src/**/*'
  ])
  .pipe(gulpFilter(function (f) {
    if (f.relative.endsWith('.DS_Store') || f.relative.endsWith('Thumbs.db')) {
      return false;
    }
    if (f.relative.indexOf('firefox') !== -1 || f.relative.indexOf('opera') !== -1 || f.relative.indexOf('electron') !== -1) {
      return false;
    }
    if (f.relative.indexOf('chrome') !== -1 && f.relative.indexOf('android/chrome-cm.js') === -1 && f.relative.indexOf('android/chrome-shim.js') === -1) {
      return false;
    }
    if (f.relative.split('/').length === 1) {
      return f.relative === 'config.xml';
    }
    return true;
  }))
  .pipe(json())
  .pipe(shadow('android'))
  .pipe(gulpif(function (f) {
    return f.path.endsWith('.js') &&
      !f.relative.endsWith('EventEmitter.js') &&
      !f.relative.endsWith('video.js') &&
      !f.relative.endsWith('showdown.js');
  }, babel({
    presets: ['es2015']
  })))
  .pipe(gulp.dest('builds/unpacked/android'))
});
gulp.task('android-pack', function () {
  return gulp.src([
    'builds/unpacked/android/**/*'
  ])
  .pipe(zip('android.zip'))
  .pipe(gulp.dest('builds/packed'));
});
gulp.task('android-apk', function () {
  return gulp.src('')
  .pipe(shell([
    'cordova platform add android',
    'cordova plugin add cordova-plugin-admobpro',
    'cordova plugin add https://github.com/VersoSolutions/CordovaClipboard',
    'cordova plugin add https://github.com/fastrde/phonegap-md5.git',
    'cordova plugin add https://github.com/whiteoctober/cordova-plugin-app-version.git',
    'cordova plugin add ../../plugins/android/cordova-plugin-binaryfilewriter/',
    'cordova plugin add ../../plugins/android/cordova-plugin-customconfig/',
    'cordova plugin add cordova-plugin-intent',
    'cordova plugin add cordova-plugin-x-toast',
    'cordova plugin add cordova-plugin-fileopener',
    'openssl aes-256-cbc -k $ENCRYPTION_PASSWORD -in ../packed/keys.p12.enc -d -a -out platforms/android/keys.p12',
    'printf "storeFile=keys.p12\\nkeyAlias=ReleaseKey\\nkeyPassword=$ENCRYPTION_PASSWORD\\nstorePassword=$ENCRYPTION_PASSWORD" > platforms/android/release-signing.properties',
    'cordova build --release'
  ], {
    cwd: 'builds/TDM'
  }));
});
gulp.task('android-run', function () {
  return gulp.src('')
  .pipe(wait(1000))
  .pipe(shell([
    'pwd & cordova run android'
  ], {
    cwd: 'trash/android/TDM/'
  }));
});

/* firefox build */
gulp.task('firefox-build', function () {
  return gulp.src([
    'src/**/*'
  ])
  .pipe(gulpFilter(function (f) {
    if (f.relative.endsWith('.DS_Store') || f.relative.endsWith('Thumbs.db')) {
      return false;
    }
    if (f.relative.indexOf('chrome') !== -1 &&
      f.relative !== 'chrome.manifest' &&
      f.relative.indexOf('firefox/chrome') === -1
    ) {
      return false;
    }
    if (f.relative.indexOf('opera') !== -1 || f.relative.indexOf('android') !== -1 || f.relative.indexOf('electron') !== -1) {
      return false;
    }
    if (f.relative.split('/').length === 1) {
      return ['package-firefox.json', 'chrome.manifest'].indexOf(f.relative) !== -1;
    }
    return true;
  }))
  .pipe(rename(function (path) {
    if (path.basename === 'package-firefox') {
      path.basename = 'package';
    }
    return path;
  }))
  .pipe(json())
  .pipe(gulpif(function (f) {
    return f.path.indexOf('.html') !== -1;
  }, change(function (content) {
    return content.replace(/\n.*shadow_index\.js.*/, '');
  })))
  .pipe(gulp.dest('builds/unpacked/firefox'));
});
/* firefox pack */
gulp.task('firefox-pack', function () {
  return gulp.src('')
  .pipe(wait(1000))
  .pipe(shell([
    'jpm xpi',
    'mv *.xpi ../../packed/firefox.xpi',
  ], {
    cwd: './builds/unpacked/firefox'
  }))
  .pipe(shell([
    'zip firefox.xpi icon.png icon64.png',
  ], {
    cwd: './builds/packed'
  }));
});
/* firefox install */
gulp.task('firefox-install', function () {
  return gulp.src('')
  .pipe(shell([
    'jpm post --post-url http://localhost:8888/'
  ], {
    cwd: './builds/unpacked/firefox'
  }))
});
/* */
gulp.task('android', (callback) => runSequence('clean', 'android-build', 'android-pack', 'android-run', callback));
gulp.task('android-travis', (callback) => runSequence('clean', 'android-build', 'android-pack', callback));
gulp.task('chrome', (callback) => runSequence('clean', 'chrome-build', 'chrome-install', callback));
gulp.task('chrome-travis', (callback) => runSequence('clean', 'chrome-build', callback));
gulp.task('opera', (callback) => runSequence('clean', 'opera-build', callback));
gulp.task('opera-travis', (callback) => runSequence('clean', 'opera-build', callback));
gulp.task('firefox', (callback) => runSequence('clean', 'firefox-build', 'firefox-pack', 'firefox-install', callback));
gulp.task('firefox-travis', (callback) => runSequence('clean', 'firefox-build', 'firefox-pack', callback));
gulp.task('electron', (callback) => runSequence('clean', 'electron-build', 'electron-pack', 'electron-install', callback));
gulp.task('electron-travis', (callback) => runSequence('clean', 'electron-build', 'electron-pack', callback));
