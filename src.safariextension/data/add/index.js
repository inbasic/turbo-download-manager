/* globals background */
'use strict';
document.querySelector('#add input[type=button]').addEventListener('click', function () {
  background.send('download', {
    url: document.querySelector('[data-id=url]').value,
    description: document.querySelector('[data-id=description]').value,
    timeout: +document.querySelector('[data-id=timeout]').value,
    threads: +document.querySelector('[data-id=threads]').value
  });
});
