var nodemailer = require('nodemailer');

// create reusable transporter object using the default SMTP transport
var transporter = nodemailer.createTransport({
    host: '127.0.0.1',
    port: 25,
    secure: false, // use SSL
    auth: {
        user: 'user@rome.lh',
        pass: 'elephant'
    }
});

// setup e-mail data with unicode symbols
var mailOptions = {
    from: '"Fred Foo ??" <foo@blurdybloop.com>', // sender address
    to: 'bar@blurdybloop.com, baz@blurdybloop.com', // list of receivers
    subject: 'Hello ?', // Subject line
    text: 'Hello world ??', // plaintext body
    html: '<b>Hello world ??</b>' // html body
};

// send mail with defined transport object
transporter.sendMail(mailOptions, function(error, info){
    if(error){
        return console.log(error);
    }
    console.log('Message sent: ' + info.response);
});