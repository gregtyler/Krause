const fs = require('fs');
const crypto = require('crypto');

module.exports = function(user) {
  var path = 'mail/' + user + '/';
  var mails = [];
  var size = 0;


  function load() {
    var id = 1;
    return new Promise((resolve, reject) => {
      fs.readdir(path, (err, data) => {
        data.forEach(function(name) {
          var mail = new Mail(id++, path + name);
          mails.push(mail);
          size += mail.size;
        });
        resolve();
      });
    });
  }

  function find(id) {
    var id = parseInt(id, 10);
    for (var i in mails) {
      if (mails[i].id === id) {
        return mails[i];
      }
    }
  }

  return {
    find: find,
    load: load,
    mails: mails,
    size: size
  }
}

function Mail(id, path) {
  // Get the mail contents
  var text = fs.readFileSync(path, 'utf-8');
  var headers = [];

  var rows = text.split('\r\n');
  rows.forEach(function(row) {
    var p = row.indexOf(':');
    headers[row.substr(0, p).trim()] = headers[row.substr(p + 1).trim()];
  });

  // Get a hash of the mail
  var hash = crypto.createHash('sha1');
  hash.setEncoding('hex');
  hash.write(text);
  hash.end();

  function getHeader(id) {
    return headers[id];
  }

  function remove() {
    fs.unlink(path);
  }

  return {
    id: id,
    remove: remove,
    deleted: false,
    getHeader: getHeader,
    size: text.length,
    hash: hash.read(),
    text: text
  }
}