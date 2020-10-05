const nodemailer = require('nodemailer');
const Mustache = require('mustache');
const path = require('path');
const fs = require('fs');

class Mailor {
  constructor({
    internalErrors, transport, maildev, ...options
  } = {}) {
    this.isMaildev = maildev || false;
    this.transporter = transport;
    this.options = options || {};
    this.internalErrors = internalErrors || [];

    if (!this.transporter) {
      throw new Error('Transport must be provided');
    }

    if (maildev && process.env.MAILDEV === 'YES') {
      process.nextTick(() => {
        this._maildev = require('./maildev')(this.options.relay);
        this._maildev.listen();
      });
    }
  }

  static shouldSkip() {
    return process.env.CI && process.env.NODE_ENV !== 'test';
  }

  static render(templatePath, data) {
    if (!fs.existsSync(templatePath)) return;
    return Mustache.render(fs.readFileSync(templatePath).toString(), data);
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

  close() {
    return this._maildev && this._maildev.close();
  }

  static buildMailer(baseDir, options) {
    const mailer = Mailor.getMailer(options);

    if (!baseDir || !fs.existsSync(baseDir)) {
      throw new Error(`Invalid directory, given '${baseDir}'`);
    }

    return fs.readdirSync(baseDir).filter(x => x.includes('.html')).reduce((prev, cur) => {
      const tplName = cur.replace('.html', '').replace(/-([a-z])/g, (_, $1) => $1.toUpperCase());

      prev[tplName] = opts => mailer.sendMail({
        ...opts,
        template: path.join(baseDir, cur),
        subject: (opts && opts.subject) || tplName,
      });

      return prev;
    }, {});
  }

  static getMailer({
    internalErrors, transport, maildev, ...options
  } = {}) {
    if (maildev) {
      transport = nodemailer.createTransport({
        port: 1025,
        ignoreTLS: true,
      });
    }

    return new Mailor({
      internalErrors, transport, maildev, ...options,
    });
  }

  async sendMail({
    template, data, email, subject,
  } = {}) {
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
    if (Mailor.shouldSkip() && this.isMaildev) {
      return { skip: true };
    }

    const { defaultOptions, defaultData } = this.options;

    const mailOptions = {
      ...defaultOptions,
    };

    let info;

    mailOptions.to = email;
    mailOptions.subject = subject;
    mailOptions.html = Mailor.render(template, { ...defaultData, ...data });

    try {
      info = await this._sendMail(mailOptions);
    } catch (error) {
      const internalError = this.internalErrors.indexOf(error.code) > -1;

      // well-known errors are just returned
      if (internalError) {
        return { originalError: error };
      }

      throw error;
    }

    return info;
  }
}

module.exports = Mailor;
