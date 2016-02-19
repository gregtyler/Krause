'use strict';
const Backchat = require('./lib/Backchat');

const PORT_SMTP = 25;

const bc = new Backchat(25);

// At start, send EHLO
bc.init(function(channel) {
  console.log('Incoming connection from ' + channel.socket.remoteAddress);
  channel.setState('state', 'AUTHORIZATION');
  channel.send('220 SMTP Krause server ready');
});

// Client decides to close the connection
bc.respond('QUIT', (channel) => {
  // Close the connection
  channel.close();
});

// Client greets the server
bc.respond('EHLO', (channel) => {
  // Close the connection
  channel.send('250 ' + bc.host);
});
