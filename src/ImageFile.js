const FileModel = require('./FileModel')

class ImageFile extends FileModel {
  /**
   * @param {string} urlOrFile - image url or File Object
   * @param {string} fileType - image type
   */
  constructor(urlOrFile, fileType = 'png') {
    super()
    this.url = typeof urlOrFile === 'string' ? urlOrFile : null
    this.file = this.url ? null : urlOrFile
    this.el = new Image()
    this.fileType = fileType
  }

  async generate() {
    this.file = this.file || (await this.createFile())
    this.el.src = URL.createObjectURL(this.file)
    this.name = `${new Date().toJSON().replace(/\W/g, '')}.${this.fileType}`
    this.arrayBuffer = await this.file.arrayBuffer()
    return this
  }

  async createFile() {
    let response = await fetch(this.url)
    let data = await response.blob()
    let metadata = {
      type: 'image/' + this.fileType,
    }
    return new File([data], 'image.' + this.fileType, metadata)
  }

  setEvents(showStatus, mainArea, activeThing, ipcRenderer) {
    this.el.onload = () => {
      showStatus(
        `Image loaded [${this.el.width}x${this.el.height}] [${(
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

module.exports = ImageFile
