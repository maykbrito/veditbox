const fs = require('fs')
const path = require('path')
const { ipcRenderer } = require('electron')

const { ELEMENTS } = require('../../utils/elements')
const { CONSTANTS } = require('../../utils/constants')
const { showStatus } = require('../../utils/show-status')
const { setTab } = require('../../utils/set-tab')

const mainArea = ELEMENTS.mainArea

const CATEGORIES = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg'],
  gif: ['.gif'],
  video: ['.mp4', '.webm', '.mov'],
  audio: ['.wav', '.mp3', '.m4a'],
}

const categoryOf = (file) => {
  const ext = path.extname(file).toLowerCase()
  return Object.keys(CATEGORIES).find((c) => CATEGORIES[c].includes(ext))
}

// Lê a pasta a cada abertura — ponytail: sem watcher, sem cache, a pasta é pequena
function listFiles(tab) {
  return fs
    .readdirSync(CONSTANTS.destDownloadFolder)
    .map((name) => ({ name, category: categoryOf(name) }))
    .filter(({ category }) => category && (tab === 'download' || category === tab))
    .map((item) => ({ ...item, filePath: path.join(CONSTANTS.destDownloadFolder, item.name) }))
    .sort((a, b) => b.name.localeCompare(a.name)) // nome é timestamp: mais novo primeiro
}

function createThumb({ category, filePath }) {
  if (category === 'audio') {
    const el = document.createElement('div')
    el.className = 'library-audio'
    el.textContent = '♪'
    return el
  }

  if (category === 'video') {
    const el = document.createElement('video')
    el.src = `file://${filePath}`
    el.muted = true
    el.preload = 'metadata'
    el.onmouseenter = () => el.play()
    el.onmouseleave = () => el.pause()
    return el
  }

  const el = new Image()
  el.src = `file://${filePath}`
  el.loading = 'lazy'
  return el
}

function showLibrary(tab) {
  setTab(tab)
  window.activeThing.dispose()
  window.activeThing = { dispose: () => {} }
  mainArea.innerHTML = ''

  const files = listFiles(tab)

  if (!files.length) {
    mainArea.innerHTML = '<p class="library-empty">Nada aqui ainda. Cole um link ou grave algo.</p>'
    showStatus('Paste image, url or use shortcuts do record audio/video')
    return
  }

  const grid = document.createElement('div')
  grid.className = 'library-grid'

  files.forEach((file) => {
    const item = document.createElement('div')
    item.className = 'library-item'
    item.draggable = true
    item.title = file.name
    item.appendChild(createThumb(file))
    item.ondragstart = (event) => {
      event.preventDefault()
      ipcRenderer.send('dragfile', file.filePath)
    }
    item.onclick = () => showPreview(file, tab)
    grid.appendChild(item)
  })

  mainArea.appendChild(grid)
  showStatus(`${files.length} arquivo(s) em ${CONSTANTS.destDownloadFolder}`)
}

// Logo = voltar pra home (tela vazia de paste), nenhuma aba ativa
function showHome() {
  window.activeThing.dispose()
  window.activeThing = { dispose: () => {} }
  mainArea.innerHTML = ''
  setTab(null)
  showStatus('Paste image, url or use shortcuts do record audio/video')
}

document.querySelector('#menu h2').onclick = showHome

document.querySelectorAll('#menu li').forEach((li) => {
  li.onclick = () => showLibrary(li.dataset.tab)
})

function createPlayer({ category, filePath }) {
  const src = `file://${filePath}`

  if (category === 'audio') {
    const el = document.createElement('audio')
    el.src = src
    el.controls = true
    return el
  }

  if (category === 'video') {
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

function showPreview(file, tab) {
  window.activeThing.dispose()
  window.activeThing = { dispose: () => {} }
  mainArea.innerHTML = ''

  const back = document.createElement('button')
  back.className = 'library-back'
  back.textContent = '\u2190 voltar'
  back.onclick = () => showLibrary(tab)

  const player = createPlayer(file)
  player.draggable = true
  player.ondragstart = (event) => {
    event.preventDefault()
    ipcRenderer.send('dragfile', file.filePath)
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'library-preview'
  wrapper.append(back, player)
  mainArea.appendChild(wrapper)

  showStatus(`${file.name} — arraste pra fora ou volte pra lista`)
}

module.exports = { showLibrary, showHome }
