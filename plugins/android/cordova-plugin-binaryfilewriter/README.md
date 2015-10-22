BinaryFileWriter
==============

Binary File Writer for android for Cordova / PhoneGap.

```
function writeFile = function (fileName, data, next) {

  function gotFileWriter(writer) {
    writer.onwriteend = function () {
      next();
    };
    
    writer.writeBinaryArray(data);
  }
  
  function failFileWriter(error) {
    next('FileWritter fail : ' + error.code);
  }
  
  function gotFileEntry(fileEntry) {
    fileEntry.createWriter(gotFileWriter, failFileWriter);
  }
  
  function failFileEntry(error) {
    next('FileEntry fail : ' + error.code);
  }

  function gotDirectoryEntry(directoryEntry) {
    directoryEntry.getFile(fileName, {create: true, exclusive: false}, gotFileEntry, failFileEntry);
  }
  
  function failDirectoryEntry(error) {
    next('DirectoryEntry fail : ' + error.code);
  }

  function gotFileSystem(fileSystem) {
    fileSystem.root.getDirectory(
      'Android/data/com.yourcompanyname.yourprojectname', 
      {create: true, exclusive: false}, 
      gotDirectoryEntry, 
      failDirectoryEntry
    );
  }
  
  function failFileSystem(error) {
    next('FileSystem fail : ' + error.code);
  }

  window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, gotFileSystem, failFileSystem);

};

function copyFile(sourceFilePath, destinatonFileName, next) {
  // Read file from local system
  var reader = new FileReader();
  reader.onload = function (evt) {
    var array = new Uint8Array(evt.target.result);
    var data = Array.prototype.slice.call(array);
    writeFile(fileName, data, function (err, modificationTime) {
      next();
    });
  };

  reader.onerror = function (evt) {
    if (evt.target.error.name == "NotReadableError") {
      // The file could not be read
    }
    next(evt.target.error.name);
  };

  reader.readAsArrayBuffer(file);
}

document.addEventListener(
  "deviceready", 
  function() {
    copyFile(sourceFilePath, destinationFileName, function(err) {
      if (!err) {
        console.log('success');
      } else { 
        console.log(err);
      }
    });         
  }, 
  false
  );
```
### Supported Platforms

- Android only
