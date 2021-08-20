let { showStatus } = require('./lib/utils.js')
require('./lib/control-window.js')

// Configure status message
showStatus('Paste image, url or press R to start record audio')

// file input
require('./lib/file/index.js')

// Screen recorder
require('./lib/recorder/screen/index.js')

// Audio Recorder
require('./lib/recorder/audio/index.js')
