const argv = require('wargs')(process.argv.slice(2), {
  alias: {
    p: 'port',
    o: 'output',
    t: 'timeout',
  },
});

const {
  readdirSync, statSync, existsSync,
} = require('fs');

const {
  resolve, join,
} = require('path');

const action = argv._[0] || 'help';

const options = {
  cwd: process.cwd(),
  port: argv.flags.port,
  open: argv.flags.open,
  timeout: argv.flags.timeout,
  srcDir: argv._.slice(1).map(x => resolve(x)),
  destDir: resolve(argv.flags.output || './generated'),
};

const thisPkg = require('../package.json');

const USAGE_INFO = `
Usage:
  ${Object.keys(thisPkg.bin)[0]} watch|build [SRC] [DEST]

`;

async function main() {
  try {
    switch (action) {
      case 'build':
      case 'watch':
        const templates = options.srcDir.reduce((prev, cur) => {
          const isFile = existsSync(cur) && statSync(cur).isFile();

          const sources = isFile ? [cur] : readdirSync(cur)
            .map(x => join(cur, x))
            .filter(x => {
              if (statSync(x).isFile() && x.indexOf('.pug') !== -1) {
                return true;
              }

              return false;
            });

          prev.push(...sources);

          return prev;
        }, []);

        await require(`./${action}`)(templates, options);
        break;

      case 'help':
        process.stdout.write(USAGE_INFO);
        break;

      default:
        throw new Error(`Unknown ${action} action`);
    }
  } catch (e) {
    process.stdout.write(`${e.message}\n`);
    process.exit(1);
  }
}

main();
