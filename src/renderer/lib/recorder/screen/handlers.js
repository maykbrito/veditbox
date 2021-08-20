const { createVideoFile } = require('./ffmpeg')

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

module.exports = { handleDataAvailable, handleStop, createVideoFile }
