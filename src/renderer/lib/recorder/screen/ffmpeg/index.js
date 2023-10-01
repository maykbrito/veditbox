const loadFfmpeg = require('./load-ffmpeg')

exports.createVideoFile = async function (filePath, showStatus) {
  const ffmpeg = loadFfmpeg()

  return new Promise((resolve) => {
    ffmpeg
      .input(filePath + '.webm')
      .output(filePath)
      .withNoAudio()
      .on('start', () => showStatus(`Encoding video...`, 'orange'))
      .on('end', () => resolve())
      .run()
  })
}
