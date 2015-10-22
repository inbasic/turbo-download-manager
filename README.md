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
