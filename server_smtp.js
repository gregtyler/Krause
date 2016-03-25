'use strict';
const fs = require('fs');
const notify = require('./lib/notify')
const Backchat = require('./lib/Backchat');

const PORT_SMTP = 25;

const ERR = (msg) => '350 ' + msg;

const bc = new Backchat(PORT_SMTP, {
  debug: true,
  errorCallback: ERR
});

// At start, send EHLO
bc.init(function(channel) {
  console.log('Incoming connection from ' + channel.socket.remoteAddress);
  channel.setState('state', 'AUTHORIZATION');
  channel.send('220 SMTP Krause server ready');
});

// Client decides to close the connection
bc.respond('QUIT', (channel) => {
  channel.send('221 ' + bc.getHost() + ' Goodbye!');
  // Close the connection
  channel.close();
});

// Client greets the server
bc.respond('EHLO', (channel) => {
  // Close the connection
  channel.send('250 ' + bc.getHost());
});
bc.respond('HELO', (channel) => {
  // Close the connection
  channel.send('250 ' + bc.getHost());
});

bc.respond('AUTH', (channel, args) => {
  // Bounce out if AUTH has already succeeded
  if (channel.hasState('isAuthed')) {
    channel.send('503 Already authed');
    return;
  }

  return channel.send('235 2.7.0 Authentication successful');
});

bc.respond('MAIL', (channel, args) => {
  // Check the message is formatted properly
  if (args[0].substr(0, 5) !== 'FROM:') {
    channel.send('501 5.1.7 Bad sender address syntax');
    return;
  }

  // Create envelope and set from address
  channel.setState('envelope', {from: args[0].substr(5)});

  channel.send('250 2.1.0 Ok');
});

bc.respond('RCPT', (channel, args) => {
  // Check a sender has been given
  if (typeof channel.getState('envelope').from === 'undefined') {
    channel.send('503 5.5.1 Need MAIL command first');
    return;
  }

  // Check the message is formatted properly
  if (args[0].substr(0, 3) !== 'TO:') {
    channel.send('501 5.1.7 Bad recipient address syntax');
    return;
  }

  // Set to address
  channel.getState('envelope').to = args[0].substr(3);

  channel.send('250 2.1.0 Ok');
});

bc.respond('DATA', (channel, args) => {
  // Check a recipient has been given
  if (typeof channel.getState('envelope').to === 'undefined') {
    channel.send('503 5.5.1 Need RCPT command first');
    return;
  }

  // Start data mode
  channel.setState('STATE', 'DATA');

  channel.send('354 Start sending data');
});

bc.missingResponse((channel, data) => {
  if (channel.getState('STATE') === 'DATA') {
    if (data === '.') {
      channel.setState('STATE', 'LISTENING');
      const envelope = channel.getState('envelope');
      const subject = envelope.data.match(/\r\nSubject:\s*(.*?)\r\n/)[1].replace(/[^0-9a-zA-Z-_ ]/g, '');
      // Save message
      fs.writeFile('mail/euclid/' + subject + '-' + Date.now() + '.eml', envelope.data, 'utf-8', (err) => {
        // Send to Slack
        notify.send(envelope.data);

        if (err) throw err;
        // Return thanks
        channel.send('250 2.1.0 Ok');
      });
    } else {
      const envelope = channel.getState('envelope');
      if (typeof envelope.data === 'undefined') {
        envelope.data = '';
      } else {
        envelope.data += "\r\n"; // eslint-disable-line
      }

      if (envelope.data.trim() === '') {
        envelope.data = '';
      }

      envelope.data += data;
    }
    return;
  }
});

// With our responses prepared, start the server
bc.start();
