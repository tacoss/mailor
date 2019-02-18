const nodemailer = require('nodemailer');
const Mustache = require('mustache');
const fs = require('fs');

class Mailor {
  constructor({ internalErrors, transport, maildev, ...options } = {}) {
    this.isMaildev = maildev || false;
    this.transporter = transport;
    this.options = options || {};
    this.internalErrors = internalErrors || [];

    if (!this.transporter) {
      throw new Error('Transport must be provided');
    }
  }

  _shouldSkip() {
    return (process.env.AWS_SM_ENV === 'ci' || process.env.CI) && process.env.NODE_ENV !== 'test';
  }

  _sendMail(options) {
    return new Promise((resolve, reject) => {
      this.transporter.sendMail(options, (err, info) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(info);
      });
    });
  }

  _render(templatePath, data) {
    return Mustache.render(fs.readFileSync(templatePath).toString(), data);
  }

  static getMailer({ internalErrors, transport, maildev, ...options } = {}) {
    if (!Mailor._instance) {
      if (!['staging', 'production'].includes(process.env.NODE_ENV) && maildev) {
        transport = transport || nodemailer.createTransport({
          port: 1025,
          ignoreTLS: true,
        });
      }

      Mailor._instance = new Mailor({ internalErrors, transport, ...options });
    }

    return Mailor._instance;
  }

  async sendMail({ template, data, email, subject }, guid = '') {
    if (!template || !fs.existsSync(template)) {
      throw new Error('Template must be provided');
    }

    if (!subject) {
      throw new Error('Subject must be provided');
    }

    if (!email) {
      throw new Error('E-mail must be provided');
    }

    // if we don't check the NODE_ENV this will fail on non-testing environments, e.g. production
    if (this._shouldSkip() && this.isMaildev) {
      return {};
    }

    const mailOptions = {
      ...this.options,
    };

    mailOptions.to = email;
    mailOptions.subject = subject;
    mailOptions.html = this._render(template, { ...data });

    let info;

    try {
      info = await this._sendMail(mailOptions);
    } catch (error) {
      const internalError = this.internalErrors.indexOf(error.code) > -1;

      // hardcode this for sandbox environments
      if (!internalError) {
        return { originalError: error };
      }

      throw error;
    }

    return info;
  }
}

module.exports = Mailor;
