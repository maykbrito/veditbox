// create directory if not exists
const fs = require('fs');
const homedir = require('os').homedir();
const dir = globalThis.destDownloadFolder = homedir + '/veditbox';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

// ----
let { showStatus } = require('./lib/utils.js')

require('./lib/control-window.js')
require('./lib/modal.js')

// file input
require('./lib/file/index.js')

// Screen recorder
require('./lib/recorder/screen/index.js')

// Audio Recorder
require('./lib/recorder/audio/index.js')

// Configure status message
showStatus('Paste image, url or use shortcuts do record audio/video')
