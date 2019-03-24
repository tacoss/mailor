const {
  resolve,
  basename,
} = require('path');

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
    if (!files.includes(file) && evt === 'add' || evt === 'change') {
      files.push(resolve(file));
      update();
    }
  });

  const liveServer = require('live-server');

  const devPort = opts.port || 1081;

  liveServer.start({
    logLevel: 0,
    port: devPort,
    root: opts.destDir,
    open: opts.open !== false,
    mount: [
      ['/', resolve(__dirname, '../public')],
      ['/vendor', resolve(require.resolve('somedom'), '..')],
    ],
    middleware: [(req, res, next) => {
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

  process.on('exit', () => {
    ee.close();
    maildev.close();
    liveServer.shutdown();
  });
};
