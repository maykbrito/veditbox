const util = require('util')
const exec = util.promisify(require('child_process').exec)

const VIDEOQUALITY = 'bestvideo[height<=1080]+bestaudio[height<=1080]/best'

const youtubedl = (url) =>
  `youtube-dl -f '${VIDEOQUALITY}' '${url}' -o temp.mp4`

module.exports.VideoDownloader = async function (url) {
  try {
    console.log('> Dowloading and converting')
    await exec('rm -rf temp.mp4')
    await exec(youtubedl(url))
  } catch (error) {
    throw new Error(error)
  }
}
