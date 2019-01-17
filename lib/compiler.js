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
    const src = pug.renderFile(x, { pretty: true });
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
        process.stdout.write(`write ${relative(cwd, destFile)}  (${metadata.size})\n`);

        outputFileSync(destFile, html);

        if (errors.length) {
          console.log(errors); // eslint-disable-line
        }
      }).catch(e => {
        throw new Error(`${e.message}\n  in ${x}`);
      });
  }));
};
