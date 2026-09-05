const VideoFile = require('./VideoFile.js')
const ImageFile = require('./ImageFile.js')
const { VideoDownloader } = require('../video-downloader.js')

// Le as meta tags OpenGraph da pagina. E padrao web, entao serve pra qualquer
// site que publique imagem/video, nao so pro pinterest.
async function findPageMedia(pageUrl) {
  try {
    const html = await (await fetch(pageUrl)).text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const meta = (prop) =>
      doc.querySelector(`meta[property="${prop}"]`)?.getAttribute('content')

    const video = meta('og:video:secure_url') || meta('og:video')
    if (video) return { url: video, isVideo: true }

    const image = meta('og:image')
    if (image) return { url: image, isVideo: false }
  } catch (error) {
    // pagina inacessivel: deixa o erro original do yt-dlp valer
  }
  return null
}

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
  async ytDlp() {
    try {
      const filePath = await VideoDownloader(url)
      return this.mp4(filePath)
    } catch (error) {
      // yt-dlp so lida com video. Pin de imagem no pinterest e afins caem aqui.
      const media = await findPageMedia(url)
      if (!media) throw error

      return media.isVideo
        ? { ...this.mp4(media.url), tab: 'video' }
        : { ...this.image(media.url), tab: 'image' }
    }
  },
})
