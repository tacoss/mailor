const glob = require('glob');
const chokidar = require('chokidar');

const {
  readdirSync, readFileSync, existsSync,
} = require('fs');

const {
  join, resolve, relative, basename, dirname,
} = require('path');

const Mailer = require('../lib/mailer');

const { toArray, fetchTags } = require('./util');

module.exports = async (templates, opts) => {
  async function run(srcFiles) {
    try {
      await require('../lib/compiler')(srcFiles, opts);
    } catch (e) {
      process.stderr.write(`\x1b[31m${e.message}\x1b[0m\n`);
    }
  }

  /* istanbul ignore else */
  if (opts.build !== false) {
    await run(templates);
  }

  let files = [];
  let interval;

  function update() {
    clearTimeout(interval);
    interval = setTimeout(async () => {
      await run(files);
      files = [];
    }, opts.timeout || 200);
  }

  const watching = toArray(opts.watch);
  const sources = opts.srcDir
    .reduce((prev, cur) => prev.concat(cur.includes('*') ? glob.sync(cur) : cur), [])
    .concat(watching.map(x => resolve(x)));

  process.stdout.write(`\rWatching: ${sources.map(x => relative(opts.cwd, x)).join(', ')}\n`);

  const watcher = chokidar.watch(sources, {
    ignored: /(^|[/\\])\../,
    ignoreInitial: false,
    persistent: true,
  });

  watcher
    .on('all', (type, file) => {
      const src = relative(opts.cwd, file);

      /* istanbul ignore else */
      if (existsSync(file) && type !== 'addDir') {
        /* istanbul ignore else */
        if (type === 'add' && src.includes('.pug') && !templates.includes(src)) {
          templates.push(src);
        }

        /* istanbul ignore else */
        if (
          ((!files.includes(src) && type === 'add') || type === 'change')
          && (!watching.some(dir => src.indexOf(dir) === 0))
        ) {
          /* istanbul ignore else */
          if (type === 'add') process.stdout.write(`Added ${src}\n`);
          files.push(src);
          update();
        }
      } else if (templates.includes(src)) {
        templates = templates.filter(x => x !== src);
        process.stdout.write(`Removed ${src}\n`);
      }
    });

  const liveServer = require('live-server');

  const publicDir = resolve(__dirname, '../public');
  const devPort = opts.port || process.env.PORT || 1081;

  const watchingDirs = [opts.destDir, publicDir]
    .concat(opts.jsonfile ? opts.jsonfile : []);

  let maildev;

  liveServer.start({
    logLevel: 0,
    cors: true,
    port: devPort,
    root: publicDir,
    watch: watchingDirs,
    open: opts.open !== false,
    ignore: 'generated_templates',
    mount: [
      ['/vendor', resolve(__dirname, '../dist')],
    ],
    middleware: [(req, res, next) => {
      /* istanbul ignore else */
      if (req.url.indexOf('/generated_templates/') === 0) {
        const [base, query] = req.url.substr(21).split('?');

        let data = {};

        try {
          data = JSON.parse(decodeURIComponent(query));
        } catch (e) {
          // ignore
        }

        Mailer.render(join(opts.destDir, base), data)
          .catch(e => e.message)
          .then(x => res.end(x));
        return;
      }

      /* istanbul ignore else */
      if (req.url.indexOf('/send_template/') === 0) {
        const [base, query] = req.url.substr(15).split('?');
        const parts = query.split(',');

        let data = {};

        try {
          data = JSON.parse(decodeURIComponent(parts.pop()));
        } catch (e) {
          // ignore
        }

        require('./send')([join(opts.destDir, base)], {
          subject: `[TEST] ${base}`,
          address: parts.join(','),
          locals: data,
        }).then(() => {
          res.end(`Email was successfully sent to: ${parts.join(', ')}`);
        }).catch(e => {
          res.end(e.message);
        });
        return;
      }

      /* istanbul ignore else */
      if (req.url.indexOf('/recipients.json') === 0) {
        if (req.method === 'DELETE') {
          const emailId = req.url.split('?')[1];

          if (emailId) {
            maildev.deleteEmail(emailId, () => res.end(`The email ${emailId} was deleted`));
          } else {
            maildev.deleteAllEmail(() => res.end('All email was deleted successfully'));
          }
        } else {
          res.setHeader('content-type', 'application/json');
          maildev.getAllEmail((err, emails) => {
            res.end(JSON.stringify(emails.reverse()));
          });
        }
        return;
      }

      /* istanbul ignore else */
      if (req.url === '/variables.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(readdirSync(opts.destDir).reduce((prev, cur) => {
          const fileContent = readFileSync(join(opts.destDir, cur)).toString();

          prev[cur.replace('.html', '')] = fetchTags(fileContent);
          return prev;
        }, {})));
        return;
      }

      /* istanbul ignore else */
      if (req.url === '/templates.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(templates.filter(src => {
          return src.includes('.pug') && basename(src).charAt() !== '_' && dirname(src).charAt() !== '_';
        }).map(x => basename(x, '.pug'))));
        return;
      }

      /* istanbul ignore else */
      if (req.url === '/defaults.json') {
        const srcFile = resolve(opts.jsonfile);

        delete require.cache[srcFile];

        res.setHeader('content-type', 'application/json');

        /* istanbul ignore else */
        if (!existsSync(opts.jsonfile)) {
          res.end('{}');
          return;
        }

        const check = require(srcFile);

        Promise.resolve()
          .then(() => (typeof check === 'function' ? check() : check))
          .then(result => res.end(JSON.stringify(result)))
          .catch(() => res.end('{}'));
      }

      next();
    }],
  });

  process.stdout.write(`\rPreview your email templates at http://0.0.0.0:${devPort}\n`); // eslint-disable-line

  /* istanbul ignore else */
  if (opts.server !== false) {
    maildev = require('../lib/maildev')(opts.relayOptions, opts.noFormat);
    maildev.listen();
  }

  process.on('exit', () => {
    liveServer.shutdown();

    /* istanbul ignore else */
    if (maildev) maildev.close();
  });
};
