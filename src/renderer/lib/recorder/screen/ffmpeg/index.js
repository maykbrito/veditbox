const loadFfmpeg = require('./load-ffmpeg')
const createReadableVideoBuffer = require('./create-readable-video-buffer')

exports.createVideoFile = async function (filePath, showStatus) {
  const ffmpeg = loadFfmpeg()
  const readableVideoBuffer = createReadableVideoBuffer()

  return new Promise((resolve) => {
    ffmpeg
      .input(readableVideoBuffer)
      .output(filePath)
      .withNoAudio()
      .on('start', () => showStatus(`Encoding video...`, 'orange'))
      .on('end', () => resolve())
      .run()
  })
}
