const path = require('path')

let tempName = () => new Date().toJSON().replace(/\W/g, '')
module.exports.destDownloadFolder = globalThis.destDownloadFolder
module.exports.videoFilePath = path.join(destDownloadFolder, `${tempName()}.mp4`)
module.exports.audioFilePath = path.join(destDownloadFolder, `${tempName()}.wav`)
module.exports.imageFilePath = (ext) => path.join(destDownloadFolder, `${tempName()}.${ext}`)

window.activeThing = { dispose: () => {} }
module.exports.activeThing = window.activeThing

const showStatus = (text, color = 'white') => {
  statusText.textContent = text
  statusText.style.color = color
}

window.showStatus = showStatus
module.exports.showStatus = showStatus