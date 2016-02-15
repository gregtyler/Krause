const fs = require('fs');
const crypto = require('crypto');

module.exports = function(user) {
  'use strict';
  const path = 'mail/' + user + '/';
  const mails = [];
  let size = 0;

  function load() {
    let id = 1;
    return new Promise((resolve, reject) => {
      fs.readdir(path, (err, data) => {
        if (err) console.error(err.message);
        data.forEach(function(name) {
          const mail = new Mail(id++, path + name);
          mails.push(mail);
          size += mail.size;
        });
        resolve();
      });
    });
  }

  function find(id) {
    id = parseInt(id, 10);
    for (const i in mails) {
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
  };
};

function Mail(id, path) {
  // Get the mail contents
  const text = fs.readFileSync(path, 'utf-8');
  const headers = [];

  const rows = text.split('\r\n');
  rows.forEach(function(row) {
    const p = row.indexOf(':');
    headers[row.substr(0, p).trim()] = headers[row.substr(p + 1).trim()];
  });

  // Get a hash of the mail
  const hash = crypto.createHash('sha1');
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
  };
};
