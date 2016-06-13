/*global cordova, module*/
'use strict';

module.exports = {
    set: function (details, successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'SocksProxy', 'set', [details]);
    },
    clear: function (successCallback, errorCallback) {
        cordova.exec(successCallback, errorCallback, 'SocksProxy', 'clear', []);
    }
};
