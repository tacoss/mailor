const { Readable } = require('stream');
const { exec } = require('child_process');
const { relative, basename, join } = require('path');

function write(text) {
  const stream = new Readable();

  stream._read = () => {};
  stream.push(text);
  stream.push(null);

  return stream;
}

module.exports = (templates, { cwd, destDir, locals }) => {
  process.stdout.write(`\rProcessing ${templates.length} file${templates.length === 1 ? '' : 's'}:\n`);

  return Promise.all(templates.map(x => {
    // use multiple workers to enable concurrency, prior this change using Promise.all()
    // was not an option, and using a reduce() chain tunred it inneficient...
    return new Promise((resolve, reject) => {
      const src = require('pug').renderFile(x, {
        ...locals,
        filename: x,
        pretty: true,
        cache: false,
      });

      const destFile = join(destDir, `${basename(x, '.pug')}.html`);

      const child = exec(`node "${join(__dirname, 'worker.js')}" "${relative(process.cwd(), x)}" "${destFile}"`, (err, stdout, stderr) => {
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
    process.stdout.write(`\r\x1b[KDone, ${templates.length} template${templates.length === 1 ? '' : 's'} rendered.\n`);
  });
};
