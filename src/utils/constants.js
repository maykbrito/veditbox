const path = require('path')
const homedir = require('os').homedir();

const destDownloadFolder = homedir + '/veditbox'

class CONSTANTS {
  static destDownloadFolder = destDownloadFolder;
  static videoFilePath = (ext = 'mp4') => createPath(ext);
  static audioFilePath = (ext = 'wav') => createPath(ext);
  static imageFilePath = (ext = 'png') => createPath(ext);
}

function createPath(ext) {
  return path.join(destDownloadFolder, `${new Date().toJSON().replace(/\W/g, '')}.${ext}`)
}

module.exports = { CONSTANTS }