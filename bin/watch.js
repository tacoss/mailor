const nsfw = require('nsfw');

const {
  readdirSync, readFileSync, statSync, existsSync,
} = require('fs');

const {
  join, resolve, relative, basename,
} = require('path');

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

  let files = [];
  let interval;

  function update() {
    clearTimeout(interval);
    interval = setTimeout(async () => {
      await run(files);
      files = [];
    }, opts.timeout || 200);
  }

  const watchers = await Promise.all(opts.srcDir.map(baseDir => {
    return nsfw(baseDir, evts => {
      evts.forEach(evt => {
        const fullpath = join(evt.newDirectory || evt.directory, evt.newFile || evt.file);

        if (existsSync(fullpath) && statSync(fullpath).isFile()) {
          let type = (evt.action === 1 || evt.action === 2)
            ? 'changed'
            : null;

          type = type || (evt.action === 0 ? 'add' : null);
          type = type || (evt.action === 3 ? 'unlink' : null);

          const file = relative(opts.cwd, fullpath);

          if ((!files.includes(file) && type === 'add') || type === 'changed') {
            files.push(fullpath);
            update();
          }
        }
      });
    }).then(watcher => {
      watcher.start();
      return watcher;
    });
  }));

  const liveServer = require('live-server');

  const devPort = opts.port || 1081;

  let maildev;

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
        });

        res.end();
        return;
      }

      if (req.url === '/variables.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(readdirSync(opts.destDir).reduce((prev, cur) => {
          prev[cur.replace('.html', '')] = readFileSync(join(opts.destDir, cur)).toString().match(/\{\{(\w+?)\}\}/g);
          return prev;
        }, {})));
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

  if (opts.server !== false) {
    maildev = require('../lib/maildev')(opts.relayOptions);
    maildev.listen();
  }

  process.on('exit', () => {
    watchers.forEach(watcher => {
      watcher.stop();
    });

    liveServer.shutdown();

    if (maildev) {
      maildev.close();
    }
  });
};
