const { expect } = require('chai');
const fs = require('fs-extra');
const path = require('path');
const stdMocks = require('std-mocks');
const stdinMock = require('mock-stdin');

/* global beforeEach, afterEach, describe, it */

describe('Mailor', () => {
  const Mailor = require('../lib/mailer');

  async function failure(tpl, ...args) {
    let e;

    try {
      await tpl(...args);
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

  it('should validate input', async () => {
    expect(() => Mailor.buildMailer(undefined, { transport: true })).to.throw(/Invalid directory/);
    expect(typeof Mailor.buildMailer(path.join(__dirname, 'fixtures'), { transport: true }).template).to.eql('function');
  });

  // FIXME: unit testing for these methods?
  // console.log(Mailor.shouldSkip);
  // console.log(Mailor.render);
  // console.log(mailer._sendMail);
  // console.log(mailer.sendMail);
  // console.log(mailer.close);

  it('should be able to invoke templates', async () => {
    stdMocks.use();

    const mailer = Mailor.buildMailer(path.join(__dirname, 'fixtures'), { maildev: true });
    const maildev = require('../lib/maildev');

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

        const { stdout } = stdMocks.flush();

        expect(stdout[stdout.length - 1]).to.match(/---> MAIL: "template" N\/A -> user@email.com/);
        expect(emails.length).to.eql(1);
        expect(emails[0].html).to.eql('It works!\n');
        expect(emails[0].subject).to.eql('template');
        expect(emails[0].to).to.eql([{ address: 'user@email.com', name: '' }]);
        // FIXME: it should have return value?
        // console.log({ result });
        ok();
      }, 50);
    });
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
        '\rProcessing 0 files:\n',
        '\r\u001b[KDone, 0 templates rendered.\n',
      ]);
    });
  });

  describe('maildev', () => {
    it('should start maildev server', async () => {
      stdMocks.use();

      const maildev = require('../lib/maildev');

      await maildev.listen();

      await new Promise(ok => {
        setTimeout(() => {
          maildev.close();
          stdMocks.restore();

          const { stdout } = stdMocks.flush();

          expect(stdout).to.eql([
            'MailDev SMTP Server running at 0.0.0.0:1025\n',
          ]);

          ok();
        }, 1000);
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
      stdMocks.use();

      const input = stdinMock.stdin();

      require('../lib/worker');
      input.send('OSOMS');
      input.send(null);

      await new Promise(ok => {
        setTimeout(() => {
          stdMocks.restore();

          const { stdout } = stdMocks.flush();

          expect(stdout).to.eql([
            '\r\u001b[31mTypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string.'
            + ' Received type undefined\n  in undefined\u001b[0m\n',
          ]);
          input.end();
          ok();
        }, 100);
      });
    });

    it('should write to file', async () => {
      stdMocks.use();

      const input = stdinMock.stdin();

      process.argv[2] = '/tmp/x';

      require('../lib/worker');
      input.send('OSOMS');
      input.send(null);

      await new Promise(ok => {
        setTimeout(() => {
          stdMocks.restore();

          const { stdout } = stdMocks.flush();

          expect(fs.readFileSync('/tmp/x').toString()).to.eql('OSOMS');
          expect(stdout).to.eql([]);
          input.end();
          ok();
        }, 100);
      });
    });
  });
});
