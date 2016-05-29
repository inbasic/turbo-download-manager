Turbo Download Manager (itdmanager) [![Build Status](https://travis-ci.org/inbasic/turbo-download-manager.svg?branch=master)](https://travis-ci.org/inbasic/turbo-download-manager)
===

TDM is an open-source multi-platform download manager with multi-threading support

![screen shot](https://cloud.githubusercontent.com/assets/351062/15116089/28ab9f5e-1617-11e6-8ceb-82c0e604593c.png)

For FAQs and discussions around this project visit:
http://add0n.com/turbo-download-manager.html

### Downloads (released versions):
1. [Firefox](https://addons.mozilla.org/firefox/addon/turbo-download-manager/)
2. [Chrome](https://chrome.google.com/webstore/detail/turbo-download-manager/kemfccojgjoilhfmcblgimbggikekjip)
3. [Opera](https://addons.opera.com/extensions/details/turbo-download-manager/)
5. [Android](https://play.google.com/store/apps/details?id=com.add0n.downloader)
6. Windows: [SourceForge; only-releases](https://sourceforge.net/projects/turbo-download-manager/) or [GitHub; releases and pre-releases](https://github.com/inbasic/turbo-download-manager/releases)
7. Mac: [SourceForge; only-releases](https://sourceforge.net/projects/turbo-download-manager/) or [GitHub; releases and pre-releases](https://github.com/inbasic/turbo-download-manager/releases)
8. Linux [SourceForge; only-releases](https://sourceforge.net/projects/turbo-download-manager/) or [GitHub; releases and pre-releases](https://github.com/inbasic/turbo-download-manager/releases)

### Downloads (developer builds):
[Firefox](https://github.com/inbasic/turbo-download-manager/releases), [Chrome](https://github.com/inbasic/turbo-download-manager/releases), [Opera](https://github.com/inbasic/turbo-download-manager/releases), [Android](https://github.com/inbasic/turbo-download-manager/releases), and [Electron (for Windows, Linux and Mac)](https://github.com/inbasic/turbo-download-manager/releases)

### Compile itdmanager project:
itdmanager uses [GulpJS](http://gulpjs.com/) to build executable files for all platforms. For more info about how to compile this project take a look at `./.travis.yml` file. A log file of the latest [released or pre-released](https://github.com/inbasic/turbo-download-manager/releases) version is available at [travis-ci.org](https://travis-ci.org/inbasic/turbo-download-manager)

1. Firefox: `gulp firefox`
2. Google Chrome: `gulp chrome`
3. Opera: `gulp opera`
4. Android:
  1. Preparing project: `gulp android`
  2. Preparing plugins:
    1. `cca plugin remove plugin-name`
    2. `cca plugin add path-to-plugin`
    3.  `../../plugins/android/Toast-PhoneGap-Plugin-master/`, `cordova-plugin-admobpro`, `../../plugins/android/cordova-plugin-binaryfilewriter`, `https://github.com/VersoSolutions/CordovaClipboard`, `https://github.com/fastrde/phonegap-md5.git`, `https://github.com/whiteoctober/cordova-plugin-app-version.git`, `cordova-plugin-fileopener`
  3. Creating a new project: `cca create TDM --link-to=path/to/manifest.json`
  4. Installing to a device: `cca run android --device` or `cca run android --emulator`
  5. Android submission:
    1. `cca build android --release --webview=crosswalk`
    2. `cca build android --release --webview=system --android-minSdkVersion=21`
    3. In case of errors run `cca platform remove android` followed by `cca platform add android`
5. Electron:
  1. Mac:
    1. `electron-packager . "Turbo Download Manager" --platform=darwin --arch=x64 --version=0.37.7 --icon mac.icns --overwrite`
  2. Windows:
    1. `electron-packager . "Turbo Download Manager" --platform=win32 --arch=x64 --version=0.37.7 --icon ../512.ico --overwrite`
    1. `electron-packager . "Turbo Download Manager" --platform=win32 --arch=ia32 --version=0.37.7 --icon ../512.ico --overwrite`
  2. Linux:
    1. `electron-packager . "Turbo Download Manager" --platform=linux --arch=x64 --version=0.37.7 --overwrite`
    2. `electron-packager . "Turbo Download Manager" --platform=linux --arch=ia32 --version=0.37.7 --overwrite`

### Technical notes:

  1. To inspect the webkit related projects use [chrome://inspect/#devices](chrome://inspect/#devices)
  2. These plugins are required for the Android build:
    1. https://github.com/VersoSolutions/CordovaClipboard
    2. /plugins/android/*
  3. To prevent screen splashes on Android version change the background color of `/plugins/cordova-plugin-chrome-apps-bootstrap/www/chromeapp.html` to `#FFF`
  4. To start a local non-threaded server to test the downloader performance use: `sudo php -S 127.0.0.1:80 -t .`
  5. To start a local threaded server to test the downloader performance use: `node server server.js path-to-a-file`

