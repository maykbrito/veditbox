const fs = require('fs')
const { ipcRenderer } = require('electron')
const { ELEMENTS } = require('../../../utils/elements')
const mainArea = ELEMENTS.mainArea

const { CONSTANTS } = require('../../../utils/constants')

class ImageFile {
  /**
   * @param {string} urlOrFile - image url or File Object
   * @param {string} fileType - image type
   */
  constructor(urlOrFile) {
    this.url = typeof urlOrFile === 'string' ? urlOrFile : null
    this.file = this.url ? null : urlOrFile
    this.el = new Image()
  }

  async generate() {
    this.file = this.file || (await this.createFile())
    this.fileType = this.fileType || 'png'
    this.name = CONSTANTS.imageFilePath(this.fileType)
    this.arrayBuffer = await this.file.arrayBuffer()
    // grava ja aqui, senao o arquivo so existiria ao arrastar e nao apareceria na biblioteca
    fs.writeFileSync(this.name, Buffer.from(this.arrayBuffer))
    // src por ultimo: onload le name/arrayBuffer, entao eles precisam existir antes
    this.el.src = URL.createObjectURL(this.file)
    return this
  }

  async createFile() {
    let response = await fetch(this.url)
    let data = await response.blob()
    this.fileType = data.type.split('/').at(-1)
    let metadata = {
      type: 'image/' + this.fileType,
    }
    return new File([data], 'image.' + this.fileType, metadata)
  }

  setEvents(showStatus) {
    this.el.onload = () => {
      showStatus(
        `Image ${this.name.split('/').at(-1)} loaded [${this.el.width}x${this.el.height}] [${(
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

module.exports = ImageFile
