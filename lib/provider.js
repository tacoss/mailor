const nodemailer = require('nodemailer');

class MailerProvider {
  constructor(transport, options, internalErrors) {
    this.transport = nodemailer.createTransport(transport);
    this.defaultOptions = options;
    this.internalErrors = internalErrors;
  }
}

module.exports = MailerProvider;
