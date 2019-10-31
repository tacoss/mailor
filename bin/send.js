const { join } = require('path');

const Mailer = require('../lib/mailer');

module.exports = (templates, {
  filename, subject, address, locals,
}) => {
  if (!templates.length) {
    throw new Error('Missing templates to send');
  }

  process.nextTick(() => {
    process.stdout.write(`\rSending ${templates.length} e-mail${templates.length === 1 ? '' : 's'}...`);
  });

  const mailer = Mailer.getMailer({
    maildev: true,
  });

  return Promise.all(templates.map(x => {
    if (filename && typeof filename === 'string') {
      return join(x, `${filename}.html`);
    }

    return x;
  }).map(tpl => mailer.sendMail({
    template: tpl,
    data: locals,
    email: address || 'test@example.com',
    subject: subject || 'This is just a test',
  }))).then(result => {
    result.forEach(x => {
      if (x.originalError) {
        throw x.originalError;
      }
    });

    process.stdout.write(' OK\n');
  });
};
