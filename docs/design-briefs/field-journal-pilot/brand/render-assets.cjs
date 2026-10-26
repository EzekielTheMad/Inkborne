// Rasterize generated SVGs with the existing bundled runtime; no package install.
const fs = require('fs');
const path = require('path');
const runtimeModules = process.env.INKBORNE_NODE_MODULES || 'C:/Users/kaios/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sharp = require(path.join(runtimeModules, 'sharp'));
const directory = __dirname;
const jobs = JSON.parse(fs.readFileSync(path.join(directory, '.raster-jobs.json'), 'utf8'));
(async () => {
  for (const job of jobs) {
    await sharp(Buffer.from(job.svg)).resize(job.width, job.height).png().toFile(path.join(directory, job.file));
  }
  process.stdout.write(`Rendered ${jobs.length} PNG exports.\n`);
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exit(1); });
