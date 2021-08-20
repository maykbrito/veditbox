const VideoFile = require('./VideoFile.js')
const ImageFile = require('./ImageFile.js')
const { VideoDownloader } = require('../video-downloader.js')
let { showStatus } = require('../utils.js')

// Paste content from clipboard
document.onpaste = async (e) => {
  e.preventDefault()
  let isUrl = (e.clipboardData || window.clipboardData).getData('text')

  const urlOrFile = !isUrl ? e.clipboardData.files[0] : isUrl

  handlePaste(urlOrFile)
}

async function handlePaste(urlOrFile) {
  const url = typeof urlOrFile === 'string' ? urlOrFile : null

  const custom = ['https://media.giphy', 'mp4', 'pexels']
  const imagesType = ['png', 'gif', 'jpg', 'jpeg', 'webp']
  const customSocialMedia = ['twitter', 'instagram']
  const allowed = [...custom, ...imagesType, ...customSocialMedia]

  const handlers = {
    giphy() {
      const giphyPureUrl = url.replace(/media\./g, 'i.')
      const giphy = new ImageFile(giphyPureUrl, 'gif')
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
    image() {
      const image = new ImageFile(urlOrFile)
      return { message: 'Image pasted — reading it...', handle: image }
    },
    async customSocialDownloader() {
      const filePath = await VideoDownloader(url, showStatus)
      return this.mp4(filePath)
    },
  }

  // If we not have a url, we assume it's a file
  if (!url) {
    processHandler(handlers.image())
    return
  }

  // Let's look for a handler
  let handler = allowed.find((type) => {
    const urlHasType = url.includes(type)

    const imageType = imagesType.includes(type) ? 'image' : type
    const customSocialType = customSocialMedia.includes(type)
      ? 'customSocialDownloader'
      : type

    const imageOrCustomSocialOrType =
      imageType != type ? imageType : customSocialType
    const hasFunction = Object.keys(handlers).includes(
      imageOrCustomSocialOrType,
    )

    return hasFunction && urlHasType
  })

  // handler found!
  if (handler) {
    if (imagesType.includes(handler)) {
      handler = 'image'
    } else if (customSocialMedia.includes(handler)) {
      handler = 'customSocialDownloader'
    }

    const handlerResult = await handlers[handler]()
    processHandler(handlerResult)
  }
}

function processHandler({ message, handle }) {
  showStatus(message)
  handle.generate()
  window.activeThing.dispose()
  mainArea.innerHTML = ''
  handle.setEvents(showStatus)
}
