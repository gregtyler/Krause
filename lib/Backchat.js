const net = require('net');
const BackchatChannel = require('./BackchatChannel');

module.exports = function Backchat(port, config) {
  'use strict';

  // Set config
  config = Object.assign({}, {
    errorCallback: function(a) { return a; },
    host: '0.0.0.0',
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
    server.listen(port, config.host, () => {
      console.log(`Server listening on ${config.host}:${port}`);
    });
  }

  function init(callback) {
    initCallback = callback;
  }

  function respond(command, callback) {
    responses[command] = callback;
  }

  function missingResponse(callback) {
    responses._catch = callback;
  }

  function getHost() {
    return config.host;
  }

  return {
    start: start,
    init: init,
    respond: respond,
    missingResponse: missingResponse,
    getHost: getHost
  };
};
