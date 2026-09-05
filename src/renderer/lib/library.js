const { ipcRenderer } = require('electron')

const { ELEMENTS } = require('../../utils/elements')
const { CONSTANTS } = require('../../utils/constants')
const { showStatus } = require('../../utils/show-status')
const { setTab } = require('../../utils/set-tab')
const mediaIndex = require('./media-index')
const { getThumb } = require('./thumbs')

const mainArea = ELEMENTS.mainArea

// §6: ~60 por vez. Sem virtualizacao — o carregamento incremental resolve com
// fracao da complexidade, e a costura fica pronta se um dia doer (§11).
const LOTE = 60

// Gancho de extensao (§10). Roda uma vez por celula, logo apos ela entrar no DOM.
// Fase 2 empurra o checkbox de selecao; Fase 3 empurra os pills de tag.
// Array em vez de callback unico porque ja sao dois consumidores conhecidos.
const cellHooks = []

// Estado do grid montado. getRenderedItems() expoe isto pras fases 2 e 3.
let renderedItems = new Map()
let abaAtual = null
let observer = null
let hoverEl = null

const getRenderedItems = () => renderedItems

function pararObserver() {
  if (observer) observer.disconnect()
  observer = null
}

// §6: um <video> por vez, so no item sob o cursor. Sair do hover descarta o
// decoder — e o que impede o grid de voltar a ter N decoders vivos.
function descartarHover() {
  if (!hoverEl) return
  hoverEl.pause()
  hoverEl.removeAttribute('src')
  hoverEl.load()
  hoverEl.remove()
  hoverEl = null
}

function ligarHover(el, item) {
  if (item.category !== 'video') return

  el.onmouseenter = () => {
    descartarHover()
    const video = document.createElement('video')
    video.className = 'library-hover'
    video.muted = true
    video.loop = true
    video.src = `file://${item.filePath}`
    el.appendChild(video)
    hoverEl = video
    // .mp4 de 0 byte (bug antigo do yt-dlp, §7) rejeita aqui. Deixa quebrar
    // bonito: nao ha caso especial, a cura e o delete da Fase 2.
    video.play().catch(() => {})
  }

  el.onmouseleave = descartarHover
}

function criarCelula(item) {
  const el = document.createElement('div')
  el.className = 'library-item'
  el.dataset.name = item.name
  el.draggable = true
  el.title = item.name

  if (item.category === 'audio') {
    const icone = document.createElement('div')
    icone.className = 'library-audio'
    icone.textContent = '\u266a'
    el.appendChild(icone)
  } else {
    // §6: toda celula e <img>, inclusive video. Um tipo de elemento, zero
    // decodificacao no grid. O src so entra quando o thumb fica pronto.
    const img = new Image()
    img.className = 'library-thumb'
    el.appendChild(img)
  }

  el.ondragstart = (event) => {
    event.preventDefault()
    ipcRenderer.send('dragfile', item.filePath)
  }
  el.onclick = () => showPreview(item)

  ligarHover(el, item)

  renderedItems.set(item.name, { el, item })
  cellHooks.forEach((hook) => hook(el, item))
  return el
}

function renderGrid(items, tab) {
  pararObserver()
  descartarHover()
  resetActiveThing()
  mainArea.innerHTML = ''
  renderedItems = new Map()
  abaAtual = tab

  if (!items.length) {
    mainArea.innerHTML =
      '<p class="library-empty">Nada aqui ainda. Cole um link ou grave algo.</p>'
    showStatus('Paste image, url or use shortcuts do record audio/video')
    return
  }

  const grid = document.createElement('div')
  grid.className = 'library-grid'

  const sentinela = document.createElement('div')
  sentinela.className = 'library-sentinel'

  mainArea.appendChild(grid)
  grid.appendChild(sentinela)

  let proximo = 0

  // §6: UM observer so. A sentinela pede o proximo lote, a celula pede o
  // thumbnail. Uma peca, duas necessidades.
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return

        if (entry.target === sentinela) {
          montarLote()
          return
        }

        // thumb e uma vez so por celula: para de observar assim que pede
        observer.unobserve(entry.target)
        const registro = renderedItems.get(entry.target.dataset.name)
        if (!registro || registro.item.category === 'audio') return

        getThumb(registro.item).then((caminho) => {
          const img = registro.el.querySelector('.library-thumb')
          // a aba pode ter trocado enquanto o ffmpeg rodava
          if (img && caminho && img.isConnected) img.src = `file://${caminho}`
        })
      })
    },
    { root: grid, rootMargin: '200px' },
  )

  function montarLote() {
    const fatia = items.slice(proximo, proximo + LOTE)
    proximo += fatia.length

    fatia.forEach((item) => {
      const el = criarCelula(item)
      grid.insertBefore(el, sentinela)
      observer.observe(el)
    })

    // acabou: para de observar a sentinela pra nao disparar a toa
    if (proximo >= items.length) observer.unobserve(sentinela)
  }

  observer.observe(sentinela)
  montarLote()

  showStatus(`${items.length} arquivo(s) em ${CONSTANTS.destDownloadFolder}`)
}

function showLibrary(tab) {
  setTab(tab)
  const items = mediaIndex
    .getAll()
    .filter((item) => tab === 'download' || item.category === tab)
  renderGrid(items, tab)
}

// remonta a aba atual preservando o scroll (Fase 2 chama depois de apagar)
function refresh() {
  const anterior = mainArea.querySelector('.library-grid')
  const scroll = anterior ? anterior.scrollTop : 0
  showLibrary(abaAtual)
  const grid = mainArea.querySelector('.library-grid')
  if (grid) grid.scrollTop = scroll
}

// Logo = voltar pra home (tela vazia de paste), nenhuma aba ativa
function showHome() {
  pararObserver()
  descartarHover()
  resetActiveThing()
  mainArea.innerHTML = ''
  setTab(null)
  abaAtual = null
  renderedItems = new Map()
  showStatus('Paste image, url or use shortcuts do record audio/video')
}

document.querySelector('#menu h2').onclick = showHome

document.querySelectorAll('#menu li').forEach((li) => {
  li.onclick = () => showLibrary(li.dataset.tab)
})

function createPlayer(item) {
  const src = `file://${item.filePath}`

  if (item.category === 'audio') {
    const el = document.createElement('audio')
    el.src = src
    el.controls = true
    return el
  }

  if (item.category === 'video') {
    const el = document.createElement('video')
    el.src = src
    el.controls = true
    el.autoplay = true
    el.loop = true
    return el
  }

  const el = new Image()
  el.src = src
  return el
}

function showPreview(item) {
  const tab = abaAtual
  pararObserver()
  descartarHover()
  resetActiveThing()
  mainArea.innerHTML = ''

  const back = document.createElement('button')
  back.className = 'library-back'
  back.textContent = '\u2190 voltar'
  back.onclick = () => showLibrary(tab)

  const player = createPlayer(item)
  player.draggable = true
  player.ondragstart = (event) => {
    event.preventDefault()
    ipcRenderer.send('dragfile', item.filePath)
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'library-preview'
  wrapper.append(back, player)
  mainArea.appendChild(wrapper)

  showStatus(`${item.name} — arraste pra fora ou volte pra lista`)
}

module.exports = {
  showLibrary,
  showHome,
  showPreview,
  renderGrid,
  getRenderedItems,
  refresh,
  cellHooks,
}
