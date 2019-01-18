const nodemailer = require('nodemailer');
const Mustache = require('mustache');
const fs = require('fs');

class Mailer {
  constructor({ internalErrors, transport, ...options }) {
    if (!transport) {
      throw new Error('transport must be provided');
    }

    this.transporter = transport;
    this.options = options || {};
    this.internalErrors = internalErrors || [];

    if (!['staging', 'production'].includes(process.env.NODE_ENV) && process.env.MAILDEV) {
      this.transporter = nodemailer.createTransport({
        port: 1025,
        ignoreTLS: true,
      });
    }
  }

  _shouldSkip() {
    return (process.env.AWS_SM_ENV === 'ci' || process.env.CI) && process.env.NODE_ENV !== 'test';
  }

  _sendMail(options) {
    return new Promise((resolve, reject) => {
      this.transporter.sendMail(options, (err, info) => {
        if (err) {
          return reject(err);
        }

        return resolve(info);
      });
    });
  }

  _render(templatePath, data) {
    return Mustache.render(fs.readFileSync(templatePath).toString(), data);
  }

  async sendMail({ template, data, email, subject }, guid = '') {
    if (!template || !fs.existsSync(template)) {
      throw new Error('template must be provided');
    }

    if (!subject) {
      throw new Error('subject must be provided');
    }

    if (!email) {
      throw new Error('email must be provided');
    }

    // if we don't check the NODE_ENV this will fail on non-testing environments, e.g. production
    if (this._shouldSkip() && !process.env.MAILDEV) {
      return {};
    }

    const mailOptions = {
      ...this.options,
    };

    mailOptions.to = email;
    mailOptions.subject = subject;
    mailOptions.html = this._render(template, data);

    let info;

    try {
      info = await this._sendMail(mailOptions);
    } catch (error) {
      const internalError = this.internalErrors.indexOf(error.code) > -1;

      // hardcode this for sandbox environments
      if (!internalError) {
        return {};
      }

      throw new Error('there was a problem delivering your message');
    }

    return info;
  }
}

module.exports = Mailer;
