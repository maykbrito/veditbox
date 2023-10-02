const { showStatus } = require('../../../utils/show-status')
const { getHandlers } = require('./handlers.js')

const { ELEMENTS } = require('../../../utils/elements')
const mainArea = ELEMENTS.mainArea

// Paste content from clipboard
document.onpaste = async (e) => {
  e.preventDefault()
  let isUrl = (e.clipboardData || window.clipboardData).getData('text')

  const urlOrFile = !isUrl ? e.clipboardData.files[0] : isUrl

  handlePaste(urlOrFile)
}

async function handlePaste(urlOrFile) {
  const url = typeof urlOrFile === 'string' ? urlOrFile : null

  const custom = ['mp4', 'pexels']
  const imagesType = ['.png', '.gif', '.jpg', '.jpeg', '.webp']
  const customSocialMedia = ['twitter', 'instagram', 'youtube']
  const allowed = [...custom, ...imagesType, ...customSocialMedia]

  const handlers = getHandlers(url)

  // If we not have a url, we assume it's a file
  if (!url) {
    processHandler(handlers.image(urlOrFile))
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

    try {
      const handlerResult = await handlers[handler]()
      processHandler(handlerResult)
    } catch (error) {
      showStatus(error, 'red')
    }
  }
}

function processHandler({ message, handle }) {
  showStatus(message)
  handle.generate()
  window.activeThing.dispose()
  mainArea.innerHTML = ''
  handle.setEvents(showStatus)
}
