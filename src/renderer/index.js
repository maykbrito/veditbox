// icons
require('../utils/lucide-icons')

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

// Library (grid de arquivos baixados)
require('./lib/library.js')

// AI Image Search
// ponytail: fora do boot pra home ficar limpa; remontar quando a aba "image" tiver controles próprios
// require('./lib/ai-image-search/index.js')

// Configure status message
showStatus('Paste image, url or use shortcuts do record audio/video')

// indice de metadados (fase 1) — append-only por §10.1
require('./lib/boot.js')

// busca (Cmd+K), pills de tag e sheet de metadados (fase 3) — append-only por §10.1
require('./lib/search/index.js')

// Selecao, delete e undo (fase 2) — append-only por §10.1
require('./lib/selection')
