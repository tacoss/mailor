const { expect } = require('chai');
const fs = require('fs-extra');
const path = require('path');
const tempfile = require('tempfile');
const td = require('testdouble');
const stdMocks = require('std-mocks');
const stdinMock = require('mock-stdin');
const { fetchTags } = require('../bin/util');

/* global beforeEach, afterEach, describe, it */

describe('Mailor', () => {
  const Mailor = require('../lib/mailer');

  function sendMail(opts, cb) {
    return cb(null, opts);
  }

  async function failure(tpl, ...args) {
    let e;

    try {
      e = await tpl(...args);
    } catch (_e) {
      e = _e;
    }

    return e;
  }

  it('should require a transport', () => {
    expect(() => new Mailor()).to.throw(/Transport must be provided/);
    expect(() => Mailor.getMailer()).to.throw(/Transport must be provided/);
  });

  it('should set transporter otherwise', () => {
    expect(new Mailor({ transport: true }).transporter).to.eql(true);
  });

  it('should validate input', () => {
    expect(() => Mailor.buildMailer(undefined, { transport: true })).to.throw(/Invalid directory/);
    expect(typeof Mailor.buildMailer(path.join(__dirname, 'fixtures'), { transport: true }).template).to.eql('function');
  });

  describe('fetchTags', () => {
    it('should extract variables from mustache tags', () => {
      expect(fetchTags('{{x}}{{#o}}{{ p }}{{/o}}{{^m}}n{{/m}}').input).to.eql([
        { key: 'o', falsy: false, input: [{ key: 'p', input: [] }] },
        { key: 'm', falsy: true, input: [] },
        { key: 'x', input: [] },
      ]);
    });

    it('should extract variables from handlebars tags', () => {
      expect(fetchTags('{{x}}{{#each o}}{{ p }}{{/each}}{{^unless m}}n{{/unless}}').input).to.eql([
        { key: 'o', falsy: false, input: [{ key: 'p', input: [] }] },
        { key: 'm', falsy: true, input: [] },
        { key: 'x', input: [] },
      ]);
    });

    it('should extract variables from liquidjs tags', () => {
      expect(fetchTags('{% if m == "x" %}{{o}}{% endif %}{{ x }}{% for k in foo %}y{{% endfor %}}').input).to.eql([
        { key: 'm', falsy: false, input: [{ key: 'o', input: [] }] },
        { key: 'foo', falsy: false, input: [] },
        { key: 'x', input: [] },
      ]);
    });
  });

  describe('_sendMail', () => {
    it('should invoke any given transporter', async () => {
      const mailer = new Mailor({ transport: { sendMail } });
      const result = await mailer._sendMail({ test: true });

      expect(result).to.eql({ test: true });
    });
  });

  describe('sendMail', () => {
    const template = path.join(__dirname, 'fixtures/template.html');
    const data = { foo: 'bar' };
    const email = 'admin@email.com';
    const subject = 'Just testing out!';

    let mailer;

    beforeEach(() => {
      mailer = new Mailor({
        internalErrors: ['Example'],
        transport: { sendMail },
        maildev: true,
      });
    });

    afterEach(() => {
      td.reset();
    });

    it('should not send mails during testing', async () => {
      td.replace(Mailor, 'shouldSkip', td.func('shouldSkip'));
      td.when(Mailor.shouldSkip()).thenReturn(true);

      const result = await mailer.sendMail({
        template, data, email, subject,
      });

      expect(result).to.eql({ skip: true });
    });

    it('should render mustache from given body', async () => {
      td.replace(Mailor, 'render', td.func('render'));
      td.when(Mailor.render(template, td.matchers.isA(Object))).thenResolve('OK');

      const result = await mailer.sendMail({
        template, data, email, subject,
      });

      expect(result.html).to.eql('OK');
    });

    it('should catch all internalErrors on failure', async () => {
      const e = new Error();

      e.code = 'Example';

      td.replace(mailer, '_sendMail', td.func('_sendMail'));
      td.when(mailer._sendMail(td.matchers.isA(Object))).thenReject(e);

      const result = await mailer.sendMail({
        template, data, email, subject,
      });

      expect(result.originalError).to.eql(e);
    });

    it('should invoke transporter otherwise', async () => {
      const result = await mailer.sendMail({
        template, data, email, subject,
      });

      expect(result).to.eql({
        to: 'admin@email.com',
        html: 'It works! - Value: bar\n',
        subject,
      });
    });
  });

  it('should be able to invoke templates', async () => {
    stdMocks.use();

    const mailer = Mailor.buildMailer(path.join(__dirname, 'fixtures'), { maildev: true });
    const maildev = require('../lib/maildev')();

    await maildev.listen();

    const result = await failure(mailer.template, {
      email: 'user@email.com',
    });

    let emails;

    await new Promise(ok => {
      maildev.getAllEmail((err, _emails) => {
        emails = _emails;
        ok();
      });
    });

    await Promise.all(emails.map(email => new Promise(next => maildev.deleteEmail(email.id, () => next()))));

    await new Promise(ok => {
      setTimeout(() => {
        maildev.close();
        stdMocks.restore();
        ok();

        const { stdout } = stdMocks.flush();

        expect(stdout[stdout.length - 1]).to.match(/---> MAIL: "template" N\/A -> user@email.com/);
        expect(emails.length).to.eql(1);
        expect(emails[0].html).to.eql('It works! - Value: \n');
        expect(emails[0].subject).to.eql('template');
        expect(emails[0].to).to.eql([{ address: 'user@email.com', name: '' }]);
        expect(result.accepted).to.eql(['user@email.com']);
      }, 500);
    });

    expect(typeof mailer.justAnExample).to.eql('function');
  });
});

describe('integration', () => {
  describe('compiler', () => {
    it('should handle no input', async () => {
      const cwd = '.';
      const destDir = '/tmp';
      const locals = { foo: 'bar' };

      stdMocks.use();

      const compiler = require('../lib/compiler');

      await compiler([], { cwd, destDir, locals });

      stdMocks.restore();

      const { stdout } = stdMocks.flush();

      expect(stdout).to.eql([
        '\rProcessing 0 files...\n',
        '\r\u001b[KDone, 0 templates rendered.\n',
      ]);
    });
  });

  describe('maildev', () => {
    it('should start maildev server', async () => {
      stdMocks.use();

      const maildev = require('../lib/maildev')();

      await maildev.listen();

      await new Promise(ok => {
        setTimeout(() => {
          maildev.close();
          stdMocks.restore();
          ok();

          const { stdout } = stdMocks.flush();

          expect(stdout).to.eql([
            'MailDev webapp running at http://0.0.0.0:1080\n',
            'MailDev SMTP Server running at 0.0.0.0:1025\n',
          ]);
        }, 500);
      });
    });
  });

  describe('worker', () => {
    const argv = process.argv.slice();

    beforeEach(() => {
      process.argv = argv.slice(0, 2);
    });

    afterEach(() => {
      process.argv = argv;
    });

    it('should validate input', async () => {
      const input = stdinMock.stdin();

      stdMocks.use();
      require('../lib/worker')();
      input.send('OSOMS');
      input.send(null);

      await new Promise(ok => {
        setTimeout(() => {
          input.end();
          stdMocks.restore();
          ok();

          const { stdout } = stdMocks.flush();

          expect(stdout[0]).to.contains('Error: Parsing failed');
        }, 500);
      });
    });

    it('should write to file', async () => {
      stdMocks.use();

      const input = stdinMock.stdin();
      const tmp = tempfile();

      process.argv[2] = path.join(__dirname, 'fixtures/template.html');
      process.argv[3] = tmp;

      require('../lib/worker')();
      input.send(`
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column>
                <mj-text>
                  OK
                </mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `);
      input.send(null);

      await new Promise(ok => {
        setTimeout(() => {
          input.end();
          stdMocks.restore();
          ok();

          const { stdout } = stdMocks.flush();

          expect(fs.readFileSync(tmp).toString()).to.contains('!doctype html');
          expect(stdout).to.eql([]);
        }, 500);
      });
    });
  });
});
