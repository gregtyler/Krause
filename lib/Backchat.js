const net = require('net');
const BackchatChannel = require('./BackchatChannel');

module.exports = function Backchat(config) {
  'use strict';

  // Set config
  config = Object.assign({}, {
    errorCallback: null,
    host: '127.0.0.1',
    port: 1234,
    debug: false,
    terminator: "\r\n" // eslint-disable-line
  }, config);

  // Init the responses object
  const responses = {};
  let initCallback;

  // Create the server
  const server = net.createServer(function(socket) {
    socket.setEncoding('ascii');

    const channel = new BackchatChannel(socket, config, responses);

    if (typeof initCallback === 'function') {
      initCallback.call(channel, channel);
    }
  });

  // Start the server
  function start() {
    server.listen(config.port, config.host, () => {
      console.log(`Server listening on ${config.host}:${config.port}`);
    });
  }

  function init(callback) {
    initCallback = callback;
  }

  function respond(command, callback) {
    responses[command] = callback;
  }

  return {
    start: start,
    init: init,
    respond: respond
  };
};
