const tmp = require('tempy');
const juice = require('juice');
const { join } = require('path');
const { outputFileSync, readFileSync } = require('fs-extra');

const Mailer = require('../lib/mailer');

module.exports = (templates, {
  filename, subject, address, locals, inline,
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
    let file;
    if (filename && typeof filename === 'string') {
      file = join(x, `${filename}.html`);
    } else {
      file = x;
    }

    if (inline) {
      const html = readFileSync(file).toString();

      outputFileSync(file = tmp.file(), juice(html));
    }

    return file;
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
