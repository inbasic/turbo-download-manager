## compile itdmanager project

  1. Firefox: `gulp firefox`
  2. Google Chrome: `gulp chrome --app`
  3. Opera: `gulp chrome --extension`
  4. Android:
    1. Preparing project: `gulp android`
    2. Preparing plugins:
      1. `sudo cca plugin remove plugin-name`
      2. `sudo cca plugin add path-to-plugin`
    3. Creating a new project: `cca create TDM --link-to=path/to/manifest.json`
    3. Installing to a device: `sudo cca run android --device` or `sudo cca run android --emulator`

## notes

  1. To inspect the webkit related projects use [chrome://inspect/#devices](chrome://inspect/#devices)
  2. These plugins are added manually:
    1. https://github.com/VersoSolutions/CordovaClipboard
    2. /plugins/android/*
  3. If screen splashes change the background color of `/plugins/cordova-plugin-chrome-apps-bootstrap/www/chromeapp.html` to `#FFF`
  4. To start a local server to test downloader use: `sudo php -S 127.0.0.1:80 -t .`
  5. Android submission:
    1. `sudo cca build android --release --webview=crosswalk`
    2. `sudo cca build android --release --webview=system --android-minSdkVersion=21`
