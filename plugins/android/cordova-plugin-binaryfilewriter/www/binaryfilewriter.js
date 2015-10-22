/* globals FileWriter, FileError, ProgressEvent, cordova */
/**
 * PhoneGap BinaryFileWriter plugin
 *
 * @author Antonio Hernández <ahernandez@emergya.com>
 *
 */

'use strict';

document.addEventListener('deviceready', function () {
  /**
   * Write the contents of a binary array to a file.
   *
   * @param binaryArray	The contents of the file (Array of bytes).
   */
  FileWriter.prototype.writeBinaryArray = function (binaryArray) {

    // Throw an exception if we are already writing a file
    if (this.readyState === FileWriter.WRITING) {
      throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // WRITING state
    this.readyState = FileWriter.WRITING;

    var me = this;

    // If onwritestart callback
    if (typeof me.onwritestart === 'function') {
      me.onwritestart(new ProgressEvent('writestart', {'target': me}));
    }

    //cordova.exec()
    //PhoneGap.exec()
    // Write file

    window.resolveLocalFileSystemURL(this.localURL, function (entry) {
      cordova.exec(
        // Success callback
        function (r) {
          // If DONE (cancelled), then don't do anything
          if (me.readyState === FileWriter.DONE) {
            return;
          }

          // position always increases by bytes written because file would be extended
          me.position += r;
          me.loaded = binaryArray.length;

          // DONE state
          me.readyState = FileWriter.DONE;

          // If onwrite callback
          if (typeof me.onwrite === 'function') {
            me.onwrite(new ProgressEvent('write', {'target': me}));
          }

          // If onwriteend callback
          if (typeof me.onwriteend === 'function') {
            me.onwriteend(new ProgressEvent('writeend', {'target': me}));
          }
        },
        // Error callback
        function (e) {
          // If DONE (cancelled), then don't do anything
          if (me.readyState === FileWriter.DONE) {
            return;
          }

          // DONE state
          me.readyState = FileWriter.DONE;

          // Save error
          me.error = new FileError(e);

          // If onerror callback
          if (typeof me.onerror === 'function') {
            me.onerror(new ProgressEvent('error', {'target': me}));
          }

          // If onwriteend callback
          if (typeof me.onwriteend === 'function') {
            me.onwriteend(new ProgressEvent('writeend', {'target': me}));
          }
        },
        'BinaryFileWriter',
        'writeBinaryArray',
        [entry.toURL(), binaryArray, me.position]
      );
    });
  };

}, false);
