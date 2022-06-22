const argv = require('wargs')(process.argv.slice(2), {
  boolean: ['V', 'o', 'O', 'B', 'S', 'T', 'relay-secure'],
  string: ['e', 'w', 'c', 'p', 'd', 't', 's', 'a', 'f', 'j', 'relay-to', 'relay-host', 'relay-user', 'relay-pass'],
  alias: {
    p: 'port',
    o: 'open',
    d: 'dest',
    y: 'types',
    w: 'watch',
    c: 'config',
    e: 'engine',
    V: 'verbose',
    t: 'timeout',
    s: 'subject',
    a: 'address',
    j: 'jsonfile',
    f: 'filename',
    O: 'no-open',
    B: 'no-build',
    S: 'no-server',
    T: 'no-format',
  },
});

const {
  copySync,
  mkdirSync,
  existsSync,
  ensureDirSync,
} = require('fs-extra');

const {
  join,
  resolve,
  relative,
} = require('path');

const glob = require('glob');

const _cwd = process.cwd();
const action = argv._[0] || 'help';

const options = {
  cwd: _cwd,
  port: argv.flags.port,
  open: argv.flags.open,
  build: argv.flags.build,
  watch: argv.flags.watch,
  types: argv.flags.types,
  inline: argv.flags.inline,
  server: argv.flags.server,
  engine: argv.flags.engine,
  timeout: argv.flags.timeout,
  subject: argv.flags.subject,
  address: argv.flags.address,
  jsonfile: argv.flags.jsonfile,
  filename: argv.flags.filename,
  noFormat: argv.flags.format === false,
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

if (existsSync(argv.flags.config)) {
  Object.assign(options.relayOptions, require(resolve(argv.flags.config)));
}

const thisPkg = require('../package.json');

const thisBin = Object.keys(thisPkg.bin)[0];

const USAGE_INFO = `
Usage:
  ${thisBin} watch|build [...]
  ${thisBin} send [...]
  ${thisBin} init

Options:
  -x, --ext        # Custom filename extension
  -p, --port       # Custom port for preview page
  -o, --open       # Often open or --no-open (-O) the browser
  -d, --dest       # Output destination for generated files
  -y, --types      # Write out .d.ts declaration from template names
  -w, --watch      # Additional directories to watch for changes
  -i, --inline     # Inline stylesheets before sending mails
  -c, --config     # Configuration file for relay-options
  -e, --engine     # Use handlebars or liquidjs, default is mustache
  -t, --timeout    # Destination for generated templates
  -s, --subject    # Subject for the message sent
  -a, --address    # Used address for sending e-mails
  -j, --jsonfile   # JSON file with default placeholders
  -f, --filename   # Used when sending emails from a directory
  -T, --no-format  # Output a JSON object instead of formatted info

The init task will create the templates directory if does not already exists

The jsonfile can be also a javascript module, you can return a function to generates your values!

When using the send command you MUST have already started in watch mode, to disable
the maildev server (if already running) just add --no-server (-S) in your options

Try adding --no-build (-B) for faster startups during development

`;

function init() {
  const tplDir = join(_cwd, argv._[1] || 'mailer');
  const baseDir = relative(_cwd, tplDir);

  if (existsSync(tplDir)) {
    throw new Error(`Directory ${relative(_cwd, tplDir)} already exists`);
  }

  mkdirSync(tplDir);
  copySync(join(__dirname, 'example'), tplDir);

  process.stdout.write(`\rDirectory ${baseDir} created\n`);
  process.stdout.write('\rExecute the following command to start watching:\n');
  process.stdout.write(`\r  ${thisBin} watch ${baseDir}/templates -j ${baseDir}/defaults.json -d ${baseDir}/generated\n`);
}

async function main() {
  const opts = { ...options, locals: argv.data, extname: argv.flags.ext || 'html' };

  if (opts.engine) {
    require('../lib/mailer').setEngine(opts.engine);
  }

  ensureDirSync(opts.destDir);

  try {
    switch (action) {
      case 'build':
      case 'watch':
        process.nextTick(() => {
          process.stdout.write(`\r\x1b[KLoading ${opts.engine || 'mustache'} templates...\r`);
        });

        await require(`./${action}`)(options.srcDir.reduce((prev, cur) => prev.concat(glob.sync(`${cur}/*.pug`)), []), opts);
        break;

      case 'send':
        await require(`./${action}`)(options.srcDir.filter(x => existsSync(x) || x.includes(`.${opts.extname}`)), opts);
        break;

      case 'help':
        process.stdout.write(USAGE_INFO);
        break;

      case 'init':
        init();
        break;

      default:
        throw new Error(`Unknown ${action} action`);
    }
  } catch (e) {
    process.stderr.write(`\x1b[31m${e[argv.flags.verbose ? 'stack' : 'message']}\x1b[0m\n`);
    process.exit(1);
  }
}

process.on('SIGINT', () => process.exit());
process.on('exit', () => {
  process.stdout.write('\r\x1b[K');
});

main();
