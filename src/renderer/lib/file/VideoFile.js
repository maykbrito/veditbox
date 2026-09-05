const fs = require('fs')
const { ipcRenderer } = require('electron')

const { ELEMENTS } = require('../../../utils/elements')
const mainArea = ELEMENTS.mainArea

const { CONSTANTS } = require('../../../utils/constants')

class VideoFile {
  constructor(url = null) {
    this.url = url
    this.el = document.createElement('video')
    this.el.id = 'videoFile'
    this.el.setAttribute('controls', true)
    this.el.setAttribute('autoplay', true)
    this.el.setAttribute('draggable', true)
    this.el.setAttribute('loop', true)
  }

  async generate(blobFile = null) {
    // yt-dlp e o gravador de tela ja escreveram o arquivo: reaproveita o caminho,
    // senao gravariamos uma segunda copia identica com outro timestamp
    const jaEmDisco = !blobFile && this.url && fs.existsSync(this.url)

    this.file = await this.createFile(blobFile)
    this.name = jaEmDisco ? this.url : CONSTANTS.videoFilePath()
    this.arrayBuffer = await this.file.arrayBuffer()

    // grava so quando a origem e remota, senao o arquivo
    // so existiria ao arrastar e nao apareceria na biblioteca
    if (!jaEmDisco) fs.writeFileSync(this.name, Buffer.from(this.arrayBuffer))

    // src por ultimo: onloadeddata le arrayBuffer, entao ele precisa existir antes
    this.el.src = URL.createObjectURL(this.file)
    return this
  }

  async createFile(blobFile = null) {
    let data = blobFile

    if (!blobFile) {
      let response = await fetch(this.url)
      data = await response.blob()
    }

    let metadata = {
      type: 'image/mp4',
    }

    return new File([data], 'video.mp4', metadata)
  }

  setEvents(showStatus) {
    this.el.onloadeddata = () => {
      showStatus(
        `Video loaded [${this.el.videoWidth}x${this.el.videoHeight}] [${(
          this.arrayBuffer.byteLength / 1024
        ).toFixed(1)}kb]`,
      )
      mainArea.appendChild(this.el)
      window.activeThing = { dispose: () => {} }
    }

    this.el.ondragstart = (event) => {
      event.preventDefault()
      ipcRenderer.send('dragfile', this.name)
    }
  }
}

module.exports = VideoFile
