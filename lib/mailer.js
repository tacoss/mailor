const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const INSTANCES = [];

class Mailor {
  constructor({
    internalErrors, transport, maildev, ...options
  } = {}) {
    this.isMaildev = maildev || false;
    this.transporter = transport;
    this.options = options;
    this.internalErrors = internalErrors || [];

    /* istanbul ignore else */
    if (!this.transporter) {
      throw new Error('Transport must be provided');
    }

    /* istanbul ignore else */
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

  static renderVars(template, data) {
    const key = Mailor.engine || 'mustache';
    const Engine = require(key);

    /* istanbul ignore else */
    if (key === 'liquidjs') {
      const liquidjs = new Engine.Liquid();

      return liquidjs.render(liquidjs.parse(template), data);
    }

    /* istanbul ignore else */
    if (key === 'handlebars') {
      return Promise.resolve(Engine.compile(template)(data));
    }

    return Promise.resolve(Engine.render(template, data));
  }

  static setEngine(compiler) {
    Mailor.engine = compiler;
  }

  static render(templatePath, data) {
    /* istanbul ignore else */
    if (!fs.existsSync(templatePath)) return Promise.resolve();

    const tasks = [];

    Object.keys(data).forEach(key => {
      /* istanbul ignore else */
      if (typeof data[key] === 'string') {
        tasks.push(Mailor.renderVars(data[key], data).then(value => {
          data[key] = value;
        }));
      }
    });

    const source = fs.readFileSync(templatePath).toString();

    return Promise.all(tasks).then(() => Mailor.renderVars(source, data));
  }

  _sendMail(options) {
    return new Promise((resolve, reject) => {
      this.transporter.sendMail(options, (err, info) => {
        /* istanbul ignore if */
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

    /* istanbul ignore else */
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
    /* istanbul ignore else */
    if (maildev) {
      transport = nodemailer.createTransport({
        port: 1025,
        ignoreTLS: true,
      });
    }

    const instance = new Mailor({
      internalErrors, transport, maildev, ...options,
    });

    INSTANCES.push(instance);
    return instance;
  }

  static closeAll() {
    INSTANCES.splice(0, INSTANCES.length).forEach(x => x.close());
  }

  async sendMail({
    template, data, email, subject, attachments,
  } = {}) {
    /* istanbul ignore else */
    if (!template || !fs.existsSync(template)) {
      throw new Error('Template must be provided');
    }

    /* istanbul ignore else */
    if (!subject) {
      throw new Error('Subject must be provided');
    }

    /* istanbul ignore else */
    if (!email) {
      throw new Error('E-mail must be provided');
    }

    // if we don't check the NODE_ENV this will fail on non-testing environments, e.g. production
    /* istanbul ignore else */
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
    mailOptions.html = await Mailor.render(template, { ...defaultData, ...data });

    if (attachments) {
      mailOptions.attachments = attachments;
    }

    try {
      info = await this._sendMail(mailOptions);
    } catch (error) {
      const internalError = this.internalErrors.indexOf(error.code) > -1;

      // well-known errors are just returned
      /* istanbul ignore else */
      if (internalError) {
        return { originalError: error };
      }

      throw error;
    }

    return info;
  }
}

module.exports = Mailor;
