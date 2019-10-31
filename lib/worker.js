const { Transform } = require('stream');
const { outputFile } = require('fs-extra');

// FIXME: add more options?
const options = {
  validate: 'soft',
  cheerio: {},
  juice: {},
  beautify: {},
  elements: [],
};

process.stdin.pipe(new Transform({
  transform(entry, enc, callback) {
    const source = Buffer.from(entry, enc).toString();
    const srcFile = process.argv.slice(2)[0];
    const destFile = process.argv.slice(2)[1];

    require('heml')(source, options)
      .then(({ html, errors }) => {
        outputFile(destFile, html, callback);

        if (errors.length) {
          errors.forEach(e => {
            process.stdout.write(`\r\x1b[31m${e.name}: ${e.message}\n  in ${srcFile} (${e.selector})\x1b[0m\n`);
          });
        }
      }).catch(e => {
        process.stdout.write(`\r\x1b[31m${e.name}: ${e.message}\n  in ${srcFile}\x1b[0m\n`);
      });
  },
})).pipe(process.stdout);
