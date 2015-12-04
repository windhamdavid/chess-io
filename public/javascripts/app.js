var $URL, $socket;
  
$(function () {
  //var ENV = 'chess';
  //var ENV = 'code';
  //var ENV = 'dev';
  var $WS;

  if (ENV === 'dev') {
    $URL = 'http://127.0.0.1:8181';
    $WS = $URL;
  } else if (ENV === 'code') {
    $URL = 'http://code.davidawindham.com:8888';
    $WS = 'ws://code.davidawindham.com:8888/';
  } else if (ENV === 'chess') {
    $URL = 'http://chess.davidawindham.com:8181';
    $WS = 'ws://chess.davidawindham.com:8181/';
  }

  $socket = io.connect($WS);
});