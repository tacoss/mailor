const {
  outputFileSync,
} = require('fs-extra');

const {
  relative, basename, join,
} = require('path');

const pug = require('pug');
const heml = require('heml');

module.exports = (templates, { cwd, destDir }) => {
  return Promise.all(templates.map(x => {
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

    return heml(src, options)
      .then(({ html, metadata, errors }) => {
        process.stdout.write(`  write ${relative(cwd, destFile)}  (${metadata.size})\n`);

        outputFileSync(destFile, html);

        if (errors.length) {
          errors.forEach(e => {
            process.stderr.write(`\x1b[31m${e.name}: ${e.message}\n  in ${x} (${e.selector})\x1b[0m\n`);
          });
        }
      }).catch(e => {
        throw new Error(`${e.message}\n  in ${x}`);
      });
  }));
};