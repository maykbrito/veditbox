const { remote } = require('electron')
const path = require('path')
const { app } = remote
let destDownloadFolder = app.getPath('videos')

module.exports.videoFilePath = path.join(destDownloadFolder, 'temp.mp4')
