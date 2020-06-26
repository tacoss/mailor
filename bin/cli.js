const argv = require('wargs')(process.argv.slice(2), {
  boolean: ['o', 'O', 'B', 'S', 'relay-secure'],
  string: ['p', 'd', 't', 's', 'a', 'f', 'relay-to', 'relay-host', 'relay-user', 'relay-pass'],
  alias: {
    p: 'port',
    o: 'open',
    d: 'dest',
    t: 'timeout',
    s: 'subject',
    a: 'address',
    f: 'filename',
    O: 'no-open',
    B: 'no-build',
    S: 'no-server',
  },
});

const {
  existsSync,
} = require('fs');

const {
  resolve,
} = require('path');

const glob = require('glob');

const action = argv._[0] || 'help';

const options = {
  cwd: process.cwd(),
  port: argv.flags.port,
  open: argv.flags.open,
  build: argv.flags.build,
  server: argv.flags.server,
  timeout: argv.flags.timeout,
  subject: argv.flags.subject,
  address: argv.flags.address,
  filename: argv.flags.filename,
  relayOptions: {
    to: argv.flags.relayTo,
    host: argv.flags.relayHost,
    user: argv.flags.relayUser,
    pass: argv.flags.relayPass,
    secure: argv.flags.relaySecure,
  },
  srcDir: argv._.slice(1).map(x => resolve(x)),
  destDir: resolve(argv.flags.dest || './generated'),
};

const thisPkg = require('../package.json');

const thisBin = Object.keys(thisPkg.bin)[0];

const USAGE_INFO = `
Usage:
  ${thisBin} watch|build [...]
  ${thisBin} send [...]

Options:
  -p, --port       # Custom port for preview page
  -o, --open       # Often open or --no-open (-O) the browser
  -d, --dest       # Output destination for generated files
  -t, --timeout    # Destination for generated templates
  -s, --subject    # Subject for the message sent
  -a, --address    # Used address for sending e-mails
  -f, --filename   # Used when sending emails from a directory

When using the send command you MUST have already started in watch mode, to disable
the maildev server (if already running) just add --no-server (-S) in your options

Try adding --no-build (-B) for faster startups during development

`;

async function main() {
  const opts = { ...options, locals: argv.data };

  try {
    switch (action) {
      case 'build':
      case 'watch':
        process.nextTick(() => {
          process.stdout.write('\rLoading templates...\r');
        });

        await require(`./${action}`)(options.srcDir.reduce((prev, cur) => prev.concat(glob.sync(`${cur}/*.pug`)), []), opts);
        break;

      case 'send':
        await require(`./${action}`)(options.srcDir.filter(x => existsSync(x) || x.includes('.html')), opts);
        break;

      case 'help':
        process.stdout.write(USAGE_INFO);
        break;

      default:
        throw new Error(`Unknown ${action} action`);
    }
  } catch (e) {
    process.stderr.write(`\x1b[31m${e.stack}\x1b[0m\n`);
    process.exit(1);
  }
}

process.on('SIGINT', () => process.exit());
process.on('exit', () => {
  process.stdout.write('\r\x1b[K');
});

main();
