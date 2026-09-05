const { showStatus } = require('../../../utils/show-status')
const { setTab } = require('../../../utils/set-tab')
const { getHandlers } = require('./handlers.js')

const { ELEMENTS } = require('../../../utils/elements')
const mainArea = ELEMENTS.mainArea

// Ordem importa: o primeiro match vence.
// [regex da url, nome do handler em handlers.js, aba do menu]
const ROUTES = [
  [/giphy\.com/i, 'giphy', 'gif'],
  [/\.gif(\?|$)/i, 'image', 'gif'],
  [/\.(png|jpe?g|webp|avif|svg)(\?|$)/i, 'image', 'image'],
  [/\.(mp4|webm|mov)(\?|$)/i, 'mp4', 'video'],
  // pexels serve mp4 sem extensao na url, e o yt-dlp nao tem extractor pra ele
  [/pexels\.com/i, 'pexels', 'video'],
  // Resto: entrega pro yt-dlp, que cobre ~1800 sites. Listar dominio a dominio
  // so consertava um site por vez (era o caso do facebook).
  [/^https?:\/\//i, 'ytDlp', 'video'],
]

// Paste content from clipboard
document.onpaste = async (e) => {
  e.preventDefault()
  const text = (e.clipboardData || window.clipboardData).getData('text')
  handlePaste(text || e.clipboardData.files[0])
}

async function handlePaste(urlOrFile) {
  // Sem url = é um arquivo colado
  if (typeof urlOrFile !== 'string') {
    setTab('image')
    await processHandler(getHandlers(null).image(urlOrFile))
    return
  }

  const url = urlOrFile.trim()
  const route = ROUTES.find(([pattern]) => pattern.test(url))

  if (!route) {
    showStatus(`Não reconheci esse link: ${url}`, 'orange')
    return
  }

  const [, handlerName, tab] = route

  try {
    setTab('download')
    showStatus('Baixando...')
    await processHandler(await getHandlers(url)[handlerName]())
    setTab(tab)
  } catch (error) {
    setTab('download')
    showStatus(error.message || String(error), 'red')
  }
}

function processHandler({ message, handle }) {
  showStatus(message)
  window.activeThing.dispose()
  mainArea.innerHTML = ''
  handle.setEvents(showStatus)
  return handle.generate()
}
