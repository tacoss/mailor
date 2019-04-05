const MailDev = require('maildev');

process.stdout.write('\r');

const maildev = new MailDev({
  // FIXME: there is an scenario where we want this disabled?
  // disableWeb: process.env.NODE_ENV === 'test',
  noOpen: true,
});

maildev.listen();
maildev.on('new', email => {
  process.stdout.write(`\r---> MAIL: "${email.subject}" ${email.envelope.from.address || 'N/A'} -> ${email.to[0].address} ${email.date}\n`);
});

module.exports = maildev;
