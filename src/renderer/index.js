// create directory if not exists
require('../utils/create-download-directory').create()

// globals
require('../utils/globals')

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
