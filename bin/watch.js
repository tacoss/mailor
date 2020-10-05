const nsfw = require('nsfw');
const glob = require('glob');

const {
  readdirSync, readFileSync, statSync, existsSync,
} = require('fs');

const {
  join, resolve, relative, basename,
} = require('path');

const Mailer = require('../lib/mailer');

function toArray(value) {
  return (!Array.isArray(value) && value) ? [value] : value || [];
}

function fetchTags(template) {
  const info = {
    input: [],
  };

  /* istanbul ignore else */
  if (template.indexOf('{{') === -1 || template.indexOf('}}') === -1) {
    return info;
  }

  /* istanbul ignore else */
  if (template.indexOf('{{#') !== -1) {
    const matches = template.match(/\{\{[#^]([^#{}]+)\}\}([\s\S]+?)\{\{\/\1\}\}/g);

    info.input = (matches || []).reduce((memo, x) => {
      const prop = x.match(/\{\{[#^]\w+\}\}/)[0];
      const fixedKey = prop.substr(3, prop.length - 5);

      template = template.replace(x, '');

      if (!memo.find(x => x.key === fixedKey)) {
        return memo.concat({
          key: fixedKey,
          falsy: prop.substr(2, 1) === '^',
          ...fetchTags(x.substr(prop.length, x.length - (prop.length * 2))),
        });
      }

      return memo;
    }, []);
  }

  const matches = template.match(/\{\{[^{#}]+\}\}/g) || [];

  matches.forEach(match => {
    const fixedKey = match.substr(2, match.length - 4).split(' ').pop();

    if (!info.input.find(x => x.key === fixedKey)) {
      info.input.push({
        key: fixedKey,
        input: [],
      });
    }
  });

  return info;
}

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

  const sources = opts.srcDir
    .reduce((prev, cur) => prev.concat(cur.includes('*') ? glob.sync(cur) : cur), [])
    .concat(toArray(opts.watch).map(x => resolve(x)));

  process.stdout.write(`\rWatching: ${sources.map(x => relative(opts.cwd, x)).join(', ')}\n`);

  const watchers = await Promise.all(sources.map(baseDir => {
    return nsfw(baseDir, evts => {
      evts.forEach(evt => {
        const filename = evt.newFile || evt.file;
        const fullpath = join(evt.newDirectory || evt.directory, filename);

        const file = relative(opts.cwd, fullpath);

        if (existsSync(fullpath) && statSync(fullpath).isFile()) {
          let type = (evt.action === 1 || evt.action === 2)
            ? 'changed'
            : null;

          type = type || (evt.action === 0 ? 'add' : null);
          type = type || (evt.action === 3 ? 'unlink' : null);

          if (type === 'add' && filename.includes('.pug') && !templates.includes(fullpath)) {
            templates.push(fullpath);
          }

          if ((!files.includes(file) && type === 'add') || type === 'changed') {
            if (type === 'add') process.stdout.write(`Added ${file}\n`);
            files.push(fullpath);
            update();
          }
        } else if (templates.includes(fullpath)) {
          templates = templates.filter(x => x !== fullpath);
          process.stdout.write(`Removed ${file}\n`);
        }
      });
    }).then(watcher => {
      watcher.start();
      return watcher;
    });
  }));

  const liveServer = require('live-server');

  const publicDir = resolve(__dirname, '../public');
  const devPort = opts.port || 1081;

  const watchingDirs = [opts.destDir, publicDir]
    .concat(opts.jsonfile ? opts.jsonfile : []);

  let maildev;

  liveServer.start({
    logLevel: 0,
    port: devPort,
    root: publicDir,
    watch: watchingDirs,
    open: opts.open !== false,
    ignore: 'generated_templates',
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
        }).then(() => {
          res.end('Email was successfully sent');
        }).catch(e => {
          res.end(e.message);
        });
        return;
      }

      if (req.url === '/variables.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(readdirSync(opts.destDir).reduce((prev, cur) => {
          const fileContent = readFileSync(join(opts.destDir, cur)).toString();

          prev[cur.replace('.html', '')] = fetchTags(fileContent);
          return prev;
        }, {})));
        return;
      }

      if (req.url === '/templates.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(templates.map(x => basename(x, '.pug'))));
        return;
      }

      if (req.url === '/defaults.json') {
        const srcFile = resolve(opts.jsonfile);

        delete require.cache[srcFile];

        res.setHeader('content-type', 'application/json');
        res.end(existsSync(opts.jsonfile) ? JSON.stringify(require(srcFile)) : '{}');
        return;
      }

      next();
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
