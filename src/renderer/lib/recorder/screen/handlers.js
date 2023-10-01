const fs = require('fs')
const { createVideoFile } = require('./ffmpeg')
const { videoFilePath } = require('../../utils')
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

  return Buffer.from(await blob.arrayBuffer())
}

async function onstop() {
  const videoBuffer = await handleStop()
  // temp file
  fs.writeFileSync(videoFilePath + '.webm', videoBuffer)
  
  // mp4 file
  await createVideoFile(videoFilePath, showStatus)
  
  // delete temp
  fs.unlinkSync(videoFilePath + '.webm')
  
  const video = new VideoFile(videoFilePath)
  await video.generate()
  mainArea.innerHTML = ''
  video.setEvents(showStatus)
}

async function ondataavailable(e) {
  handleDataAvailable(e)
}

module.exports = { onstop, ondataavailable }
