const liveServer = require('live-server');
const chokidar = require('chokidar');

const {
  resolve,
} = require('path');

const compiler = require('../lib/compiler');

module.exports = async (templates, opts) => {
  await compiler(templates, opts);

  const ee = chokidar.watch(templates, {
    cwd: opts.cwd,
    ignored: [],
    persistent: true,
    ignoreInitial: true,
    ignorePermissionErrors: true,
    followSymlinks: false,
  });

  let files = [];
  let interval;

  function update() {
    clearTimeout(interval);
    interval = setTimeout(async () => {
      await compiler(files, opts);
      files = [];
    }, opts.timeout || 200);
  }

  ee.on('all', (evt, file) => {
    if (!files.includes(file) && evt === 'add' || evt === 'change') {
      files.push(resolve(file));
      update();
    }
  });

  liveServer.start({
    logLevel: 0,
    port: opts.port,
    root: opts.destDir,
    open: opts.open !== false,
  });
};
