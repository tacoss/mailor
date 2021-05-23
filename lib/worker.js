const mjml2html = require('mjml');
const { Transform } = require('stream');
const { outputFile } = require('fs-extra');

module.exports = () => process.stdin.pipe(new Transform({
  transform(entry, enc, callback) {
    const source = Buffer.from(entry, enc).toString();
    const srcFile = process.argv.slice(2)[0];
    const destFile = process.argv.slice(2)[1];

    try {
      const { html, errors } = mjml2html(source, {
        filePath: srcFile,
      });

      errors.forEach(e => {
        process.stdout.write(`\r\x1b[31m${e.tagName}: ${e.message}\x1b[0m\n`);
      });

      outputFile(destFile, html, callback);
    } catch (e) {
      process.stdout.write(`\r\x1b[31m${e.name}: ${e.stack}\x1b[0m\n`);
    }
  },
})).pipe(process.stdout);

if (require.main === module) {
  module.exports();
}
