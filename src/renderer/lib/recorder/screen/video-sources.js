const { desktopCapturer, remote } = require('electron')
const { Menu } = remote

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

/**
 * Create a MediaRecorder
 * @param {Object} constraints - MediaRecorder constraints
 * @param {function} ondataavailable - MediaRecorder ondataavailable callback
 * @param {function} onstop - MediaRecorder onstop callback
 * @return {MediaRecorder} - MediaRecorder instance
 */
async function createMediaRecorder(constraints, ondataavailable, onstop) {
  // Create a Stream
  const stream = await navigator.mediaDevices.getUserMedia(constraints)

  // Create the Media Recorder
  const options = { mimeType: 'video/webm; codecs=vp9' }
  mediaRecorder = new MediaRecorder(stream, options)

  // Register Event Handlers
  mediaRecorder.ondataavailable = ondataavailable
  mediaRecorder.onstop = onstop

  return mediaRecorder
}

module.exports = { createMediaRecorder, getVideoSources }
