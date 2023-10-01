const { ipcRenderer } = require('electron')
const FileModel = require('./FileModel')
const magick = require('imagemagick');
const { imageFilePath } = require('../utils')

class ImageFile extends FileModel {
  /**
   * @param {string} urlOrFile - image url or File Object
   * @param {string} fileType - image type
   */
  constructor(urlOrFile) {
    super()
    this.url = typeof urlOrFile === 'string' ? urlOrFile : null
    this.file = this.url ? null : urlOrFile
    this.el = new Image()
  }

  async generate() {
    this.file = this.file || (await this.createFile())
    this.el.src = URL.createObjectURL(this.file)
    this.fileType = this.fileType || 'png'
    this.name = imageFilePath(this.fileType)
    this.arrayBuffer = await this.file.arrayBuffer()
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

    this.el.ondragstart = async (event) => {
      event.preventDefault()
      const buffer = Buffer.from(this.arrayBuffer)
      ipcRenderer.send('dragstart', { buffer, name: this.name})
    }
  }

  async webpToGif() {
    if(this.fileType != 'webp') return

    return new Promise(resolve => {
      // magick convert -format gif My_anim.webp animation.gif
      magick.convert([this.name, '-format',  'gif', this.name + '.gif'], (err, stdout) => {
        if (err) throw err;
        console.log('stdout:', stdout);
        resolve(this.name + '.gif')
      })
    })
  }
}

module.exports = ImageFile
