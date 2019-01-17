const nodemailer = require('nodemailer');
const MailerProvider = require('./provider');
const Logger = require('/var/lib/core/js/log');
const log = new Logger(module);
const fs = require('fs');
const Mustache = require('mustache');
const config = require('../../config/config');

class Mailer {
  constructor(provider) {
    /* istanbul ignore next */
    if (!(provider instanceof MailerProvider)) {
      throw new Error('provider must be an instance of MailerProvider');
    }

    /* istanbul ignore next */
    if ([ 'staging', 'production' ].includes(config.env) || !process.env.MAILDEV) {
      this.transporter = nodemailer.createTransport(provider.transport);
    } else {
      this.transporter = nodemailer.createTransport({
        port: 1025,
        ignoreTLS: true
      });
    }

    this.options = provider.options;
    this.internalErrors = provider.internalErrors || [];
  }

  shouldSkip() {
    return process.env.AWS_SM_ENV === 'circle' && config.env !== 'test';
  }

  /* istanbul ignore next */
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

  /* istanbul ignore next */
  _render(templatePath, data) {
    return Mustache.render(fs.readFileSync(`${__dirname}/generated/${templatePath}`).toString(), data);
  }

  async sendMail({ template, data, email, subject }, guid = '') {
    data.apiBaseUrl = config.apiBaseUrl;
    data.webBaseUrl = config.webBaseUrl;

    if (!template) {
      const error = {
        errors: [ {
          path: 'Mailer',
          message: 'Template not found'
        } ]
      };

      throw error;
    }

    // if we don't check the NODE_ENV this will fail on non-testing environments, e.g. production
    /* istanbul ignore next */
    if (this.shouldSkip() && !process.env.MAILDEV) {
      return {};
    }

    const mailOptions = this.options;
    const templatePath = template + '.html';

    mailOptions.to = email;
    mailOptions.subject = subject;
    mailOptions.html = this._render(templatePath, data);

    let info;

    try {
      info = await this._sendMail(mailOptions);
    } catch (error) {
      log.error('Email service', guid, error);

      // Hard code this for sandbox environments
      const internalError = this.internalErrors.indexOf(error.code) > -1;

      /* istanbul ignore next */
      if (!internalError) {
        return {};
      }

      const err = {
        errors: [ {
          path: 'Email service',
          message: 'There was a problem delivering your message'
        } ]
      };

      throw err;
    }

    log.message('Email sent', info, 'Mailer', guid);

    return info;
  }
}

module.exports = Mailer;
