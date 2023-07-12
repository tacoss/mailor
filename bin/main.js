const glob = require('glob');

const {
  existsSync,
  ensureDirSync,
} = require('fs-extra');

const build = require('./build');
const watch = require('./watch');
const send = require('./send');

function configure(opts) {
  if (opts.engine) {
    require('../lib/mailer').setEngine(opts.engine);
  }

  ensureDirSync(opts.destDir);

  const pugs = opts.srcDir.reduce((prev, cur) => prev.concat(glob.sync(`${cur}/*.pug`)), []);
  const htmls = opts.srcDir.filter(x => existsSync(x) || x.includes(`.${opts.extname}`));

  return {
    build: () => build(pugs, opts),
    watch: () => watch(pugs, opts),
    send: () => send(htmls, opts),
  };
}

module.exports = {
  configure,
};
