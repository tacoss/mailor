const MailDev = require('maildev');

module.exports = relayOptions => {
  const maildev = new MailDev({
    // FIXME: there is an scenario where we want this disabled?
    // disableWeb: process.env.NODE_ENV === 'test',
    noOpen: true,
    silent: process.env.CI === 'true',
    autoRelay: relayOptions ? relayOptions.to : undefined,
    outgoingHost: relayOptions ? relayOptions.host : undefined,
    outgoingUser: relayOptions ? relayOptions.user : undefined,
    outgoingPass: relayOptions ? relayOptions.pass : undefined,
    outgoingSecure: relayOptions ? relayOptions.secure : undefined,
  });

  // appearently, Maildev instances use a shared EE?
  maildev.removeAllListeners('new');
  maildev.on('new', email => {
    process.stdout.write(`\r[maildev] "${email.subject}" ${email.envelope.from.address || 'N/A'} -> ${email.to[0].address} ${email.date}\n`);
  });

  return maildev;
};
