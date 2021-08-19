const FileModel = require('./FileModel')

class Video extends FileModel {
  constructor(url) {
    super()
    this.url = url
    this.el = document.createElement('video')
    this.el.id = 'videoFile'
    this.el.setAttribute('controls', true)
    this.el.setAttribute('autoplay', true)
    this.el.setAttribute('draggable', true)
    this.el.setAttribute('loop', true)
  }

  async generate() {
    this.file = await this.createFile()
    this.el.src = URL.createObjectURL(this.file)
    this.name = `${new Date().toJSON().replace(/\W/g, '')}.mp4`
    this.arrayBuffer = await this.file.arrayBuffer()
    return this
  }

  async createFile() {
    let response = await fetch(this.url)
    let data = await response.blob()
    let metadata = {
      type: 'image/mp4',
    }
    return new File([data], 'video.mp4', metadata)
  }

  setEvents(showStatus, mainArea, activeThing, ipcRenderer) {
    this.el.onloadeddata = () => {
      showStatus(
        `Video loaded [${this.el.videoWidth}x${this.el.videoHeight}] [${(
          this.arrayBuffer.byteLength / 1024
        ).toFixed(1)}kb]`,
      )
      mainArea.appendChild(this.el)
      activeThing = { dispose: () => {} }
    }

    this.el.ondragstart = (event) => {
      event.preventDefault()
      const buffer = Buffer.from(this.arrayBuffer)
      ipcRenderer.send('dragstart', { buffer, name: this.name })
    }
  }
}

module.exports = Video
