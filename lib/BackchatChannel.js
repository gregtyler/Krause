module.exports = function BackchatChannel(socket, config, responses) {
  'use strict';

  // Command history
  let history = [];

  // A channel can have multiple states
  let states = {};

  // Scope channel
  const channel = this;

  // Check if the channel has a certain state or, if a value
  // is provided, check whether it's equal to that
  function hasState(code, value) {
    if (typeof value === 'undefined') {
      return typeof states[code] !== 'undefined';
    } else {
      return states[code] !== value;
    }
  }

  // Get a state value from the channel
  function getState(code) {
    return states[code];
  }

  // Sets a state value for the channel
  function setState(code, value) {
    states[code] = value;
  }

  // Respond to a message sent by the client
  function receive(data) {
    if (data.indexOf(config.terminator) > -1) {
      data = data.substr(0, data.indexOf(config.terminator));
    }

    // Add a log to the channel history
    history.push({
      by: 'client',
      message: data.trim()
    });

    // Get the sent data
    var args = data.trim().split(' ');
    var command = args.shift().toUpperCase();

    if (typeof responses[command] === 'function') {
      try {
        responses[command].call(channel, channel, args);
      } catch (err) {
        send(config.errorCallback, err.message);
      }
    } else if (typeof config.errorCallback === 'function') {
      send(config.errorCallback, `unknown command ${command}`);
    } else {
      send('Error: didn\'t know what to do with command ' + command);
    }
  }

  // Send a message back to the client
  function send(parser, msg) {
    if (typeof parser === 'string') {
      msg = parser + config.terminator;
    } else {
      msg = parser.call(channel, msg) + config.terminator;
    }

    // Add a log to the channel history
    history.push({
      by: 'server',
      message: msg
    });

    // Write the message to the client
    socket.write(msg);
  }

  // Close the connection
  function close() {
    socket.end();
  }

  // When data is sent, respond to it
  socket.on('data', receive);

  // On error, log it
  socket.on('error', (e) => {
    if (e.code === 'ECONNRESET') {
      socket.end();
    } else {
      console.log(e.message);
    }
  });

  // Expose the public object
  this.socket = socket;
  this.hasState = hasState;
  this.getState = getState;
  this.setState = setState;
  this.send = send;
  this.close = close;
}
