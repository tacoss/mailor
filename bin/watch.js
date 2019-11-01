const { join, resolve, basename } = require('path');
const Mailer = require('../lib/mailer');

module.exports = async (templates, opts) => {
  async function run(srcFiles) {
    try {
      await require('../lib/compiler')(srcFiles, opts);
    } catch (e) {
      process.stderr.write(`\x1b[31m${e.message}\x1b[0m\n`);
    }
  }

  if (opts.build !== false) {
    await run(templates);
  }

  const ee = require('chokidar').watch(templates, {
    cwd: opts.cwd,
    ignored: [],
    persistent: true,
    ignoreInitial: true,
    ignorePermissionErrors: true,
    followSymlinks: false,
  });

  let files = [];
  let interval;

  function update() {
    clearTimeout(interval);
    interval = setTimeout(async () => {
      await run(files);
      files = [];
    }, opts.timeout || 200);
  }

  ee.on('all', (evt, file) => {
    if ((!files.includes(file) && evt === 'add') || evt === 'change') {
      files.push(resolve(file));
      update();
    }
  });

  const liveServer = require('live-server');

  const devPort = opts.port || 1081;

  liveServer.start({
    logLevel: 0,
    port: devPort,
    open: opts.open !== false,
    ignore: 'generated_templates',
    root: resolve(__dirname, '../public'),
    mount: [
      ['/vendor', resolve(__dirname, '../dist')],
    ],
    middleware: [(req, res, next) => {
      if (req.url.indexOf('/generated_templates/') === 0) {
        const [base, query] = req.url.substr(21).split('?');

        let data = {};

        try {
          data = JSON.parse(decodeURIComponent(query));
        } catch (e) {
          // ignore
        }

        res.end(Mailer.render(join(opts.destDir, base), data));
        return;
      }

      if (req.url === '/templates.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(templates.map(x => basename(x, '.pug'))));
      } else {
        next();
      }
    }],
  });

  process.stdout.write(`\rPreview your email templates at http://0.0.0.0:${devPort}\n`); // eslint-disable-line

  const maildev = require('../lib/maildev');

  maildev.listen();

  process.on('exit', () => {
    ee.close();
    maildev.close();
    liveServer.shutdown();
  });
};
