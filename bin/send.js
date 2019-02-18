const Mailer = require('../lib/mailer');

module.exports = (templates, { subject, address, locals }) => {
  if (!templates.length) {
    throw new Error('Missing templates to send');
  }

  process.nextTick(() => {
    process.stdout.write(`\rSending ${templates.length} e-mail${templates.length === 1 ? '' : 's'}...`);
  });

  const mailer = Mailer.getMailer({
    maildev: true,
  });

  return Promise.all(templates.map(tpl => mailer.sendMail({
    template: tpl,
    data: locals,
    email: address || 'test@example.com',
    subject: subject || 'This is just a test',
  }))).then(() => {
    process.stdout.write(' OK\n');
  });
};
