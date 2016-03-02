/* globals self */
'use strict';

// make sure page url is up-to-date
document.addEventListener('DOMContentLoaded', () => self.port.emit('url', document.location.href));
