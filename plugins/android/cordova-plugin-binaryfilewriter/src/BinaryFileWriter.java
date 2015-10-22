package com.phonegap.plugins.binaryfilewriter;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import org.apache.cordova.file.FileUtils;
import java.io.*;
import java.net.MalformedURLException;
import java.nio.channels.FileChannel;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.PluginResult;

public class BinaryFileWriter extends CordovaPlugin {
  @Override
  public boolean execute(String action, JSONArray args, CallbackContext callbackContext) {
    try {
      if (action.equals("writeBinaryArray")) {
        long offset = this.writeBinaryArray(args.getString(0), args.getJSONArray(1), args.getInt(2));
        callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.OK, offset));
        return true;
      }
      return false;
    }
    catch (FileNotFoundException e) {
      callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.ERROR, FileUtils.NOT_FOUND_ERR));
      return true;
    }
    catch (JSONException e) {
      callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.ERROR, FileUtils.NO_MODIFICATION_ALLOWED_ERR));
      return true;
    }
    catch (IOException e) {
      callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.ERROR, FileUtils.INVALID_MODIFICATION_ERR));
      return true;
    }
  }
  public long writeBinaryArray(String filename, JSONArray data, int offset) throws FileNotFoundException, IOException, JSONException {
    filename = stripFileProtocol(filename);

    byte[] rawData = new byte[data.length()];
    for (int i = 0; i < data.length(); i++) {
        rawData[i] = (byte)data.getInt(i);
    }

    RandomAccessFile raf = new RandomAccessFile(filename, "rws");
    raf.seek(offset);
    raf.write(rawData);
    raf.close();

    return rawData.length;
  }
  private String stripFileProtocol(String filePath) {
    if (filePath.startsWith("file://")) {
      filePath = filePath.substring(7);
    }
    return filePath;
  }
}
