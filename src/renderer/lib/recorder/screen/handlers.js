const { createVideoFile } = require('./ffmpeg')
const { videoFilePath } = require('./video-filepath.js')
const VideoFile = require('../../file/VideoFile.js')

let recordedChunks = []

// Captures all recorded chunks
function handleDataAvailable(e) {
  recordedChunks.push(e.data)
}

// Saves the video file on stop
async function handleStop() {
  const blob = new Blob(recordedChunks, { type: 'video/webm; codecs=vp9' })

  recordedChunks = []

  window.videoBuffer = Buffer.from(await blob.arrayBuffer())
}

async function onstop() {
  await handleStop()
  await createVideoFile(videoFilePath, showStatus)
  const video = new VideoFile(videoFilePath)
  await video.generate()
  mainArea.innerHTML = ''
  video.setEvents(showStatus)
}

async function ondataavailable(e) {
  handleDataAvailable(e)
}

module.exports = { onstop, ondataavailable }
