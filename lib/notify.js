const request = require('request');
const MailParser = require('mailparser').MailParser;

module.exports = {
  send: function(eml) {
    const parser = new MailParser();

    parser.on('end', function(mail) {
      const data = {
        channel: 'test',
        username: 'To: ' + mail.to.map(x => `${x.name} <${x.address}>`).join(', '),
        icon_emoji: ':envelope:',
        attachments: [{
          fallback: mail.text,
          pretext: mail.text,
          fields: [{
            title: 'To',
            value: mail.to.map(x => `${x.name} <${x.address}>`).join(', '),
            short: true
          }, {
            title: 'Subject',
            value: mail.subject,
            short: true
          }]
        }]
      };

      request.post('https://hooks.slack.com/services/{KEY_GOES_HERE}', {
        form: {
          payload: JSON.stringify(data)
        }
      });
    });

    parser.write(eml);
    parser.end();
  }
};
