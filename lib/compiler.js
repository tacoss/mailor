const {
  outputFileSync,
} = require('fs-extra');

const {
  relative, basename, join,
} = require('path');

const pug = require('pug');
const heml = require('heml');

module.exports = (templates, { cwd, destDir }) => {
  process.stdout.write(`\rProcessing ${templates.length} files:\n`);

  return templates.reduce((prev, x) => prev.then(() => {
    const start = Date.now();

    const src = pug.renderFile(x, {
      filename: x,
      pretty: true,
    });

    const destFile = join(destDir, `${basename(x, '.pug')}.html`);

    const options = {
      validate: 'soft',
      cheerio: {},
      juice: {},
      beautify: {},
      elements: []
    };

    process.stdout.write(`\rrendering ${relative(cwd, x)} ...`);

    return heml(src, options)
      .then(({ html, metadata, errors }) => {
        process.stdout.write(`\r  write ${relative(cwd, destFile)}  (${metadata.size}) in ${(Date.now() - start) / 1000}s\n`);

        outputFileSync(destFile, html);

        if (errors.length) {
          errors.forEach(e => {
            process.stderr.write(`\r\x1b[31m${e.name}: ${e.message}\n  in ${x} (${e.selector})\x1b[0m\n`);
          });
        }
      }).catch(e => {
        process.stderr.write(`\r\x1b[31m${e.name}: ${e.stack}\n  in ${x}\x1b[0m\n`);
      });
  }), Promise.resolve());
};
