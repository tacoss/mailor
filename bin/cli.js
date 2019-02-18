const argv = require('wargs')(process.argv.slice(2), {
  alias: {
    p: 'port',
    O: 'open',
    o: 'output',
    t: 'timeout',
    s: 'subject',
    a: 'address',
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
  subject: argv.flags.subject,
  address: argv.flags.address,
  srcDir: argv._.slice(1).map(x => resolve(x)),
  destDir: resolve(argv.flags.output || './generated'),
};

const thisPkg = require('../package.json');
const thisBin = Object.keys(thisPkg.bin)[0];

const USAGE_INFO = `
Usage:
  ${thisBin} watch|build [...]
  ${thisBin} send [...]

Options:
  -p, --port     # Custom port for preview page
  -o, --open     # Often open or --no-open the browser
  -t, --timeout  # Destination for generated templates
  -s, --subject  # Subject for the message sent
  -a, --address  # Used address for sending e-mails

When using the send command you MUST have already started in watch mode

`;

async function main() {
  try {
    switch (action) {
      case 'build':
      case 'watch':
        process.nextTick(() => {
          process.stdout.write(`\rLoading sources...`);
        });

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

        await require(`./${action}`)(templates, { ...options, locals: argv.data });
        break;

      case 'send':
        await require(`./${action}`)(options.srcDir.filter(x => existsSync(x) && x.includes('.html')), { ...options, locals: argv.data });
        break;

      case 'help':
        process.stdout.write(USAGE_INFO);
        break;

      default:
        throw new Error(`Unknown ${action} action`);
    }
  } catch (e) {
    process.stderr.write(`\x1b[31m${e.message}\x1b[0m\n`);
    process.exit(1);
  }
}

process.on('SIGINT', () => process.exit());
process.on('exit', () => {
  process.stdout.write('\r\x1b[K');
});

main();
