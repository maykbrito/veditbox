const { remote } = require('electron')
const path = require('path')
const { app } = remote
let destDownloadFolder = app.getPath('videos')
module.exports.destDownloadFolder = destDownloadFolder
module.exports.videoFilePath = path.join(destDownloadFolder, 'temp.mp4')

window.activeThing = { dispose: () => {} }
module.exports.activeThing = window.activeThing

module.exports.showStatus = (text, color = 'white') => {
  statusText.textContent = text
  statusText.style.color = color
}
