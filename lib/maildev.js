const MailDev = require('maildev');

module.exports = (relayOptions, noFormat) => {
  const maildev = new MailDev({
    // FIXME: there is an scenario where we want this disabled?
    // disableWeb: process.env.NODE_ENV === 'test',
    noOpen: true,
    silent: process.silent || process.env.CI === 'true',
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
      process.stdout.write(`\r\x1b[1mmaildev\x1b[0m: ${email.subject}\n`);
      process.stdout.write(`\r\x1b[35m${email.date}\x1b[0m from: ${email.envelope.from.address || 'N/A'} - to: ${email.to[0].address}\n`);
      process.stdout.write(`\r\x1b[2mhttp://localhost:1080/#/email/${email.id} ${email.source}\x1b[0m\n`);
    } else {
      process.stdout.write(`${JSON.stringify({
        name: email.subject,
        time: email.date,
        level: 'MAILDEV',
        href: `http://localhost:1080/#/email/${email.id}`,
        file: email.source,
        from: email.envelope.from.address || 'N/A',
        to: email.to.map(x => x.address),
      })}\n`);
    }
  });

  return maildev;
};
