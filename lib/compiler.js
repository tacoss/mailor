const { relative, basename, join } = require('path');
const { readFileSync } = require('fs');
const { exec } = require('child_process');
const { Readable } = require('stream');

const CACHED_DEPS = {};

function write(text) {
  const stream = new Readable();

  stream._read = () => {};
  stream.push(text);
  stream.push(null);

  return stream;
}

module.exports = (templates, { cwd, destDir, locals }) => {
  process.stdout.write(`\rProcessing ${templates.length} file${templates.length === 1 ? '' : 's'}:\n`);

  const sources = templates.reduce((prev, cur) => {
    if (CACHED_DEPS[cur]) {
      CACHED_DEPS[cur].forEach(x => {
        if (prev.indexOf(x) === -1) {
          prev.push(x);
        }
      });

      return prev;
    }

    if (cur.includes('.pug')) {
      prev.push(cur);
      return prev;
    }

    return prev;
  }, []);

  return Promise.all(sources.map(x => {
    // use multiple workers to enable concurrency, prior this change using Promise.all()
    // was not an option, and using a reduce() chain tunred it inneficient...
    return new Promise((resolve, reject) => {
      const tpl = require('pug').compile(readFileSync(x).toString(), {
        filename: x,
        pretty: true,
        cache: false,
      });

      const src = tpl(locals);
      const deps = tpl.dependencies;

      deps.forEach(y => {
        if (!CACHED_DEPS[y]) CACHED_DEPS[y] = [];
        if (CACHED_DEPS[y].indexOf(x) === -1) {
          CACHED_DEPS[y].push(x);
        }
      });

      const destFile = join(destDir, `${basename(x, '.pug')}.html`);

      const child = exec(`node "${join(__dirname, 'worker.js')}" "${relative(cwd, x)}" "${destFile}"`, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });

      child.stdout.pipe(process.stdout);

      write(src).pipe(child.stdin);
    });
  })).then(() => {
    process.stdout.write(`\r\x1b[KDone, ${sources.length} template${sources.length === 1 ? '' : 's'} rendered.\n`);
  });
};
