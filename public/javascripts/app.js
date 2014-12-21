var $URL, $socket;
  
$(function () {
  //var ENV = 'code';
  var ENV = 'dev';
  var $WS;

  if (ENV === 'dev') {
    $URL = 'http://macs.local:8888';
    $WS = $URL;
  } else if (ENV === 'code') {
    $URL = 'http://code.davidawindham.com:8888';
    $WS = 'ws://code.davidawindham.com:8888/';
  }

  $socket = io.connect($WS);
});