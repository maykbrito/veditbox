const { ipcRenderer } = require('electron')
const FileModel = require('./FileModel')
const { videoFilePath } = require('../utils')

class VideoFile extends FileModel {
  constructor(url = null) {
    super()
    this.url = url
    this.el = document.createElement('video')
    this.el.id = 'videoFile'
    this.el.setAttribute('controls', true)
    this.el.setAttribute('autoplay', true)
    this.el.setAttribute('draggable', true)
    this.el.setAttribute('loop', true)
  }

  async generate(blobFile = null) {
    this.file = await this.createFile(blobFile)
    this.el.src = URL.createObjectURL(this.file)
    this.name = videoFilePath
    this.arrayBuffer = await this.file.arrayBuffer()
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
      const buffer = Buffer.from(this.arrayBuffer)
      ipcRenderer.send('dragstart', { buffer, name: this.name })
    }
  }
}

module.exports = VideoFile
