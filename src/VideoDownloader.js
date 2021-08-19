var youtubedl = require('youtube-dl')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const path = require('path')
var fs = require('fs')

const { app } = require('electron').remote
let destDownloadFolder = app.getPath('videos')

const videoFilePath = path.join(destDownloadFolder, 'temp.mp4')

function download(url, setInfoPanel) {
  return new Promise((resolve, reject) => {
    let pos = 0
    let size = 0

    // if want best quality
    // const VIDEOQUALITY = 'bestvideo[height<=1080]+bestaudio[height<=1080]/best'

    let video = youtubedl(
      url,
      // Optional customArgs passed to youtube-dl.
      // see here for options https://github.com/rg3/youtube-dl/blob/master/README.md
      ['--no-mtime', '--ignore-errors'],
      // Additional options can be given for calling `child_process.execFile()`.
      {
        cwd: destDownloadFolder,
        maxBuffer: Infinity,
      },
    )

    video.on('data', function data(chunk) {
      pos += chunk.length
      if (size) {
        let percent = ((pos / size) * 100).toFixed(2)
        setInfoPanel(`Downloading video ${percent}% of ${size}`, 'lightgreen')
      }
    })

    // listener for video info, to get file name
    video.on('info', function (info) {
      size = info.size
      // update GUI with info on the file being downloaded
      setInfoPanel(
        `title: ${info.title} | filename: ${info._filename} | size:${info.size} | path:${videoFilePath}`,
        'orange',
      )

      var writeStream = fs.createWriteStream(videoFilePath)
      video.pipe(writeStream)
    })

    video.on('end', function () {
      setInfoPanel('done downloading video file', 'green')
      resolve(videoFilePath)
    })
  })
}

module.exports.VideoDownloader = async function (url, showStatusFn) {
  try {
    await exec('rm -rf ' + videoFilePath)
    return download(url, showStatusFn)
  } catch (error) {
    throw new Error(error)
  }
}
