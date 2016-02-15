'use strict';
const Mailbox = require('./lib/Mailbox');
const Backchat = require('./lib/Backchat');

const PORT_POP3 = 110;

const OK = (msg) => '+OK' + ' ' + msg;
const ERR = (msg) => '-ERR' + ' ' + msg;
const TERM = () => '.';

const bc = new Backchat(PORT_POP3, {
  errorCallback: ERR
});

let mailbox;

function getMailbox() {
  if (typeof mailbox === 'undefined') {
    const mb = new Mailbox('euclid');
    return new Promise((resolve, reject) => {
      mb.load().then(function() {
        mailbox = mb;
        resolve(mb);
      });
    });
  } else {
    return Promise.resolve(mailbox);
  }
}

// A shortcut function that ensures the channel is in a TRANSACTION state
function requireInTransaction(channel) {
  if (!channel.hasState('state', 'TRANSACTION')) {
    throw new Error('cannot use this command in TRANSACTION state');
  }
}

// At start, log the connection and ask the client to start sending data
bc.init(function(channel) {
  console.log('Incoming connection from ' + channel.socket.remoteAddress);
  channel.setState('state', 'AUTHORIZATION');
  channel.send(OK, 'POP3 server ready');
});

// Client decides to close the connection
bc.respond('QUIT', (channel) => {
  // When quitting, enter the UPDATE state
  channel.setState('state', 'UPDATE');

  // Delete any emails that need deleting
  getMailbox().then(() => {
    mailbox.mails.forEach((mail) => {
      if (mail.deleted) {
        mail.remove();
      }
    });

    // Close the connection
    channel.close();
  });
});

// Client provides a username
bc.respond('USER', (channel, args) => {
  // User is trying to log in. Collect their username and ask for a password.
  channel.setState('user', args[0]);
  channel.send(OK, 'send PASS');
});

// Client provides a password
bc.respond('PASS', (channel, args) => {
  // Require username first
  if (!channel.hasState('user')) {
    throw new Error('must provide username first');
  }

  // Verify the password is correct
  if (args[0] === 'elephant') {
    // If it's correct, let the user in the system and enter TRANSACTION state
    channel.setState('state', 'TRANSACTION');
    channel.send(OK);
  } else {
    // If it's wrong, return an error
    channel.send(ERR, '[AUTH] Username and password not accepted.');
  }
});

// Get some basic mail statistics
bc.respond('STAT', (channel) => {
  // Require transaction state
  requireInTransaction(channel);

  // Find the mailbox and get to work
  getMailbox().then((mailbox) => {
    channel.send(OK, `${mailbox.mails.length} ${mailbox.size}`);
  });
});

// List the messages on the server
bc.respond('LIST', (channel, args) => {
  // Require transaction state
  requireInTransaction(channel);

  if (typeof args[0] === 'undefined') {
    // If no argument provided, list all messages
    channel.send(OK, `${mailbox.mails.length} messages (${mailbox.size} octets)`);
    getMailbox().then((mailbox) => {
      mailbox.mails.forEach(function(mail) {
        channel.send(`${mail.id} ${mail.size}`);
      });
      channel.send(TERM);
    });
  } else {
    // If an argument was provided, detail an individual message
    getMailbox().then((mailbox) => {
      const mail = mailbox.find(args[0]);
      channel.send(OK, `${mail.id} ${mail.size}`);
    });
  }
});

// Retrieve an individual message
bc.respond('RETR', (channel, args) => {
  // Require transaction state
  requireInTransaction(channel);

  if (typeof args[0] === 'undefined') {
    channel.send(ERR, 'no such message');
  } else {
    getMailbox().then((mailbox) => {
      // Check the mail exists and then output it
      const mail = mailbox.find(args[0]);
      if (!mail || mail.deleted) {
        channel.send(ERR, 'no such message');
      } else {
        channel.send(OK);
        channel.send(mail.text);
        channel.send(TERM);
      }
    });
  }
});

// Mark a message for deletion (it will actually be removed at QUIT)
bc.respond('DELE', (channel, args) => {
  // Require transaction state
  requireInTransaction(channel);

  // Check that a message ID was sent
  if (typeof args[0] === 'undefined') {
    channel.send(ERR, 'no such message');
  } else {
    getMailbox().then((mailbox) => {
      // Try to mark a message as deleted
      const mail = mailbox.find(args[0]);

      if (!mail) {
        channel.send(ERR, 'no such message');
      } else if (mail.deleted) {
        channel.send(ERR, `message ${args[0]} already deleted`);
      } else {
        mail.deleted = true;
        channel.send(OK, `message ${args[0]} deleted`);
      }
    });
  }
});

// Perform no operation, just respond in the affirmative
bc.respond('NOOP', (channel) => {
  // Require transaction state
  requireInTransaction(channel);
  channel.send(OK);
});

// Reset deleted messages
bc.respond('RSET', (channel) => {
  // Require transaction state
  requireInTransaction(channel);

  getMailbox().then((mailbox) => {
    let rsets = 0;
    // Unmark all deleted records
    mailbox.mails.forEach((mail) => {
      if (mail.deleted === true) {
        mail.deleted = false;
        rsets++;
      }
    });

    channel.send(OK, `${rsets} messages undeleted`);
  });
});

// List the server's capabilities
bc.respond('CAPA', (channel) => {
  channel.send(OK, 'Capability list follows');
  channel.send('USER');
  channel.send('UIDL');
  channel.send('IMPLEMENTATION Krause');
  channel.send(TERM);
});

// Provide a unique ID for messages
bc.respond('UIDL', (channel, args) => {
  // Require transaction state
  requireInTransaction(channel);

  if (typeof args[0] === 'undefined') {
    // If no argument provided, list all IDs
    getMailbox().then((mailbox) => {
      channel.send(OK, `${mailbox.mails.length} messages (${mailbox.size} octets)`);
      mailbox.mails.forEach(function(mail) {
        channel.send(`${mail.id} ${mail.hash}`);
      });
      channel.send(TERM);
    });
  } else {
    // Provide an ID for a single message
    getMailbox().then((mailbox) => {
      const mail = mailbox.find(args[0]);
      if (!mail || mail.deleted) {
        channel.send(ERR, 'no such message');
      } else {
        channel.send(OK, `poppoppop ${mail.id} ${mail.hash}`);
      }
    });
  }
});

// Extract a header from one or more messages
bc.respond('XTND XLST', (channel, args) => {
  // Require transaction state
  requireInTransaction(channel);

  // Determine the header being extracted
  const header = args[0];
  if (typeof header === 'undefined') {
    throw new Error('no header provided');
  }

  getMailbox().then((mailbox) => {
    // Extract the header from every message
    if (typeof args[1] === 'undefined') {
      channel.send(OK, `header list follows`);
      mailbox.mails.forEach(function(mail) {
        channel.send(`${mail.id} ${header} ` + mail.getHeader(header));
      });
      channel.send(TERM);
      return;
    }

    // Extract a header from a single message
    const mail = mailbox.find(args[0]);
    if (!mail || mail.deleted) {
      channel.send(ERR, 'no such message');
    } else {
      channel.send(OK, `header list follows`);
      channel.send(`${mail.id} ${header} ` + mail.getHeader(header));
      channel.send(TERM);
    }
  });
});

// With our responses prepared, start the server
bc.start();
