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
var runSequence = require('run-sequence');

/* clean */
gulp.task('clean', function () {
  return gulp.src('builds/unpacked', {read: false})
    .pipe(clean());
});
/* webapp build */
gulp.task('webapp-build', function () {
  gulp.src([
    'src/**/*'
  ])
  .pipe(gulpFilter(function (f) {
    if (f.relative.indexOf('.DS_Store') !== -1 || f.relative.indexOf('Thumbs.db') !== -1) {
      return false;
    }
    if (f.relative.indexOf('firefox') !== -1) {
      return false;
    }
    if (f.relative.indexOf('chrome') !== -1) {
      return false;
    }
    if (f.relative.indexOf('safari') !== -1) {
      return false;
    }
    if (f.relative.split('/').length === 1) {
      return f.relative === 'manifest.webapp' ? true : false;
    }
    return true;
  }))
  .pipe(gulpif(function (f) {
    return f.path.indexOf('.js') !== -1 && f.path.indexOf('.json') === -1;
  }, change(function (content) {
    return content.replace(/\/\*\*[\s\S]*\\*\*\*\//m, '');
  })))
  .pipe(gulpif(function (f) {
    return f.path.indexOf('.js') !== -1 && f.path.indexOf('.json') === -1 && f.relative.indexOf('EventEmitter.js') === -1;
  }, babel()))
  .pipe(gulp.dest('builds/unpacked/webapp'))
  .pipe(zip('webapp.zip'))
  .pipe(gulp.dest('builds/packed'));
});
/* chrome build */
gulp.task('chrome-build', function () {
  gulp.src([
    'src/**/*'
  ])
  .pipe(gulpFilter(function (f) {
    if (f.relative.indexOf('.DS_Store') !== -1 || f.relative.indexOf('Thumbs.db') !== -1) {
      return false;
    }
    if (f.relative.indexOf('firefox') !== -1) {
      return false;
    }
    if (f.relative.indexOf('webapp') !== -1) {
      return false;
    }
    if (f.relative.indexOf('safari') !== -1) {
      return false;
    }
    if (f.relative.split('/').length === 1) {
      return f.relative === 'manifest.json' ? true : false;
    }
    return true;
  }))
  .pipe(gulpif(function (f) {
    return f.path.indexOf('.js') !== -1 && f.path.indexOf('.json') === -1;
  }, change(function (content) {
    return content.replace(/\/\*\*[\s\S]*\\*\*\*\//m, '');
  })))
  .pipe(gulp.dest('builds/unpacked/chrome'))
  .pipe(zip('chrome.zip'))
  .pipe(gulp.dest('builds/packed'));
});
/* firefox build */
gulp.task('firefox-build', function () {
  gulp.src([
    'src/**/*'
  ])
  .pipe(gulpFilter(function (f) {
    if (f.relative.indexOf('.DS_Store') !== -1 || f.relative.indexOf('Thumbs.db') !== -1) {
      return false;
    }
    if (f.relative.indexOf('chrome') !== -1 && f.relative !== 'chrome.manifest') {
      return false;
    }
    if (f.relative.indexOf('webapp') !== -1) {
      return false;
    }
    if (f.relative.indexOf('safari') !== -1) {
      return false;
    }
    if (f.relative.split('/').length === 1) {
      return ['package.json', 'chrome.manifest'].indexOf(f.relative) !== -1;
    }
    return true;
  }))
  .pipe(gulp.dest('builds/unpacked/firefox'));
});
/* firefox pack */
gulp.task('firefox-pack', function () {
  gulp.src('')
  .pipe(wait(1000))
  .pipe(shell([
    'jpm xpi',
    'mv *.xpi ../../packed/firefox.xpi',
    'jpm post --post-url http://localhost:8888/'
  ], {
    cwd: './builds/unpacked/firefox'
  }));
});
/* */
gulp.task('webapp', function (callback) {
  runSequence('clean', 'webapp-build', callback);
});
gulp.task('chrome', function (callback) {
  runSequence('clean', 'chrome-build', callback);
});
gulp.task('firefox', function (callback) {
  runSequence('clean', 'firefox-build', 'firefox-pack', callback);
});
