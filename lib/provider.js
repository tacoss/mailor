const nodemailer = require('nodemailer');

class MailerProvider {
  constructor(transport, options, internalErrors) {
    this.transport = nodemailer.createTransport(transport);
    this.options = options;
    this.internalErrors = internalErrors;
  }
}

module.exports = MailerProvider;
