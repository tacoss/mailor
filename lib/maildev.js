const MailDev = require('maildev');

const maildev = new MailDev({
  // FIXME: there is an scenario where we want this disabled?
  // disableWeb: process.env.NODE_ENV === 'test',
  noOpen: true,
});

// appearently, Maildev instances use a shared EE?
maildev.removeAllListeners('new');
maildev.on('new', email => {
  process.stdout.write(`\r---> MAIL: "${email.subject}" ${email.envelope.from.address || 'N/A'} -> ${email.to[0].address} ${email.date}\n`);
});

module.exports = maildev;
