# Turbo Download Manager (itdmanager)
a multi-browser download manager with multi-threading support
![screen shot 2016-01-30 at 11 11 42](https://cloud.githubusercontent.com/assets/351062/12694533/2dbefc40-c746-11e5-9037-5eb7df72a040.png)

For FAQs and discussions around this project visit:
http://add0n.com/turbo-download-manager.html

### Downloads (released versions):
1. Firefox: https://addons.mozilla.org/firefox/addon/turbo-download-manager/
2. Chrome: https://chrome.google.com/webstore/detail/turbo-download-manager/kemfccojgjoilhfmcblgimbggikekjip
3. Opera: https://addons.opera.com/extensions/details/turbo-download-manager/
4. Safari: not ready
5. Android: https://play.google.com/store/apps/details?id=com.add0n.tdm
6. Windows: https://sourceforge.net/projects/turbo-download-manager/
7. Mac: https://sourceforge.net/projects/turbo-download-manager/

### Downloads (developer builds):
1. Firefox: https://github.com/inbasic/turbo-download-manager/blob/master/builds/packed/firefox.xpi?raw=true
2. Chrome: https://github.com/inbasic/turbo-download-manager/blob/master/builds/packed/chrome.zip?raw=true
3. Opera: https://github.com/inbasic/turbo-download-manager/blob/master/builds/packed/opera.zip?raw=true
4. Safari: not ready
5. Android: https://github.com/inbasic/turbo-download-manager/blob/master/builds/packed/android.zip?raw=true
6. Electron (for Windows, Linux and Mac): https://github.com/inbasic/turbo-download-manager/blob/master/builds/packed/electron.zip?raw=true


### Compile itdmanager project:

1. Firefox: `gulp firefox`
2. Google Chrome: `gulp chrome`
3. Opera: `gulp opera`
4. Android:
  1. Preparing project: `gulp android`
  2. Preparing plugins:
    1. `cca plugin remove plugin-name`
    2. `cca plugin add path-to-plugin`
  3. Creating a new project: `cca create TDM --link-to=path/to/manifest.json`
  4. Installing to a device: `cca run android --device` or `cca run android --emulator`
  5. Android submission:
    1. `cca build android --release --webview=crosswalk`
    2. `cca build android --release --webview=system --android-minSdkVersion=21`
5. Electron:
  1. Mac: `electron-packager . "Turbo Download Manager" --platform=darwin --arch=x64 --version=0.36.7 --icon ../512.icns --overwrite`
  2. Windows: `electron-packager . "Turbo Download Manager" --platform=win32 --arch=x64 --version=0.36.7 --icon ../512.ico --overwrite`

### Technical notes:

  1. To inspect the webkit related projects use [chrome://inspect/#devices](chrome://inspect/#devices)
  2. These plugins are required for the Android build:
    1. https://github.com/VersoSolutions/CordovaClipboard
    2. /plugins/android/*
  3. To prevent screen splashes on Android version change the background color of `/plugins/cordova-plugin-chrome-apps-bootstrap/www/chromeapp.html` to `#FFF`
  4. To start a local non-threaded server to test the downloader performance use: `sudo php -S 127.0.0.1:80 -t .`
  5. To start a local threaded server to test the downloader performance use: `node server server.js path-to-a-file`

