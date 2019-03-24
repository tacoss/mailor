const nodemailer = require('nodemailer');
const Mustache = require('mustache');
const path = require('path');
const fs = require('fs');

const RE_DASH = /-([a-z])/;

class Mailor {
  constructor({ internalErrors, transport, maildev, ...options } = {}) {
    this.isMaildev = maildev || false;
    this.transporter = transport;
    this.options = options || {};
    this.internalErrors = internalErrors || [];

    if (!this.transporter) {
      throw new Error('Transport must be provided');
    }

    if (maildev) {
      process.nextTick(() => {
        this._maildev = require('./maildev');
      });
    }
  }

  _shouldSkip() {
    return process.env.CI && process.env.NODE_ENV !== 'test';
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

  close() {
    return this._maildev && this._maildev.close();
  }

  static buildMailer(baseDir, options) {
    const mailer = Mailor.getMailer(options);

    return fs.readdirSync(baseDir).filter(x => x.includes('.html')).reduce((prev, cur) => {
      const tplName = cur.replace('.html', '').replace(RE_DASH, (_, $1) => $1.toUpperCase());

      prev[tplName] = opts => mailer.sendMail({
        ...opts,
        template: path.join(baseDir, cur),
        subject: (opts && opts.subject) || tplName,
      });

      return prev;
    }, {});
  }

  static getMailer({ internalErrors, transport, maildev, ...options } = {}) {
    if (!Mailor._instance) {
      if (maildev) {
        transport = nodemailer.createTransport({
          port: 1025,
          ignoreTLS: true,
        });
      }

      Mailor._instance = new Mailor({ internalErrors, transport, maildev, ...options });
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

    const { defaultOptions, defaultData } = this.options;

    const mailOptions = {
      ...defaultOptions,
    };

    let info;

    mailOptions.to = email;
    mailOptions.subject = subject;
    mailOptions.html = this._render(template, { ...defaultData, ...data });

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
