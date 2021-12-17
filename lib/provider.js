const nodemailer = require('nodemailer');

class MailerProvider {
  constructor(transport, options, defaults, internalErrors) {
    if (Array.isArray(defaults)) {
      internalErrors = defaults;
      defaults = undefined;
    }

    this.transport = nodemailer.createTransport(transport);
    this.defaultData = defaults;
    this.defaultOptions = options;
    this.internalErrors = internalErrors;
  }
}

module.exports = MailerProvider;
