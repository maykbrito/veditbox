const VideoFile = require('./VideoFile.js')
const ImageFile = require('./ImageFile.js')
const { VideoDownloader } = require('../video-downloader.js')

module.exports.getHandlers = (url) => ({
  giphy() {
    const giphyPureUrl = url.replace(/media\./g, 'i.')
    const giphy = new ImageFile(giphyPureUrl)
    return { message: 'Giphy pasted — reading it...', handle: giphy }
  },
  pexels() {
    return this.mp4()
  },
  mp4(customUrl = null) {
    const link = customUrl || url
    const video = new VideoFile(link)
    return { message: 'Video pasted — reading it...', handle: video }
  },
  image(file) {
    const urlOrFile = file || url
    const image = new ImageFile(urlOrFile)
    return { message: 'Image pasted — reading it...', handle: image }
  },
  async customSocialDownloader() {
    const filePath = await VideoDownloader(url)
    return this.mp4(filePath)
  },
})
