const MailDev = require('maildev');

module.exports = (relayOptions, noFormat) => {
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
    if (!noFormat) {
      process.stdout.write(`\r[maildev] ${email.subject} <from:${email.envelope.from.address || 'N/A'}> <to:${email.to[0].address}> ${email.date}\n`);
    } else {
      process.stdout.write(`${JSON.stringify({
        name: email.subject,
        time: email.date,
        level: 'MAILDEV',
        from: email.envelope.from.address || 'N/A',
        to: email.to.map(x => x.address),
      })}\n`);
    }
  });

  return maildev;
};
