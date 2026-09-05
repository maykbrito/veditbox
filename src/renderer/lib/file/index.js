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

// yt-dlp joga o stderr inteiro na mensagem, começando com \n, o que deixava a
// barra de status parecendo vazia. So a linha ERROR: interessa.
const resumoErro = (error) => {
  const texto = String(error?.message ?? error ?? '').trim()
  const linha = texto.split('\n').reverse().find((l) => l.includes('ERROR:')) || texto
  return linha.replace(/^ERROR:\s*/, '').trim() || 'erro desconhecido'
}

// Uma colagem por vez: sem isso, colar de novo antes da anterior terminar faz
// os dois fluxos disputarem o mainArea e a aba ativa
let emAndamento = null

// Paste content from clipboard
document.onpaste = async (e) => {
  e.preventDefault()
  const text = (e.clipboardData || window.clipboardData).getData('text')
  const entrada = text || e.clipboardData.files[0]

  emAndamento = Promise.resolve(emAndamento)
    .catch(() => {})
    .then(() => handlePaste(entrada))

  return emAndamento
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
    const result = await getHandlers(url)[handlerName]()
    await processHandler(result)
    // o handler pode corrigir a aba (ex: url de video que na verdade era imagem)
    setTab(result.tab || tab)
  } catch (error) {
    setTab('download')
    showStatus(`Falhou: ${resumoErro(error)}`, 'red')
  }
}

function processHandler({ message, handle }) {
  showStatus(message)
  window.activeThing.dispose()
  mainArea.innerHTML = ''
  handle.setEvents(showStatus)
  return handle.generate()
}
