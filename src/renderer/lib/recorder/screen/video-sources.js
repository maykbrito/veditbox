const { desktopCapturer, Menu } = require('@electron/remote')
const { ondataavailable, onstop } = require('./handlers.js')

/**
 * Get video sources to record
 * @param {function} cb - Callback to run after src is selected
 * @param {boolean} autoSelect - If true, automatically select the first source
 */
async function getVideoSources(cb, autoSelect = false) {
  const inputSources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
  })

  if (autoSelect) {
    return selectSource(inputSources[0], cb)
  }

  const videoOptionsMenu = Menu.buildFromTemplate(
    inputSources.map((source) => {
      return {
        label: source.name,
        click: () => selectSource(source, cb),
      }
    }),
  )

  videoOptionsMenu.popup()
}

// Change the videoSource window to record
async function selectSource(source, cb) {
  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id,
      },
    },
  }

  cb(constraints)
}

async function createStream(constraints) {
  // Create a Stream
  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  const mimeType = 'video/webm; codecs="pcm"'

  return {
    stream, mimeType
  }
}

/**
 * Create a MediaRecorder
 * @param {Object} constraints - MediaRecorder constraints
 * @param {function} ondataavailable - MediaRecorder ondataavailable callback
 * @param {function} onstop - MediaRecorder onstop callback
 * @return {MediaRecorder} - MediaRecorder instance
 */
async function createMediaRecorder(constraints) {
  const { stream, mimeType } = await createStream(constraints)

  window.mediaRecorder = new MediaRecorder(stream, { mimeType })
  window.mediaRecorder.ondataavailable = ondataavailable
  window.mediaRecorder.onstop = onstop
}

module.exports = { createMediaRecorder, getVideoSources }
