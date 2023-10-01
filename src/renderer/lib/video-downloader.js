const YTDlpWrap = require('yt-dlp-wrap').default;
const youtubedl = new YTDlpWrap();

const fs = require('fs')

const { videoFilePath, showStatus } = require('./utils.js')

// async function download(url) {
//   try { 
//     const response = await fetch(url)
//     const file = await response.blob()
//     const link = document.createElement('a')
//     link.href = URL.createObjectURL(file)
//     link.download = videoFilePath
//     link.hidden = true;
//     link.click()
//     showStatus('done downloading video file', 'green')
//     return videoFilePath
//   } catch(err) {
//     showStatus('error downloading video', 'red')
//   }
// }

function download(url) {
  let err = false
  return new Promise((resolve, reject) => {
    let video = youtubedl.execStream([
      '-o', videoFilePath,
      url,
    ])
    
    video.on('ytDlpEvent', (eventType, eventData) => {
      let color = 'orange'

      if(eventType == 'download') {
        color = 'blue'
      }
      
      showStatus(eventData, color)
    })
    
    video.pipe(fs.createWriteStream(videoFilePath))
  
    video.on('close', () => {
      if(err) {
        return reject(err)
      }
      showStatus('done downloading video file', 'green')
      resolve(videoFilePath)
    })

    video.on('error', (error) => {
      err = error
    })
  })
}

module.exports.VideoDownloader = async function (url) {
  try {
    return download(url)
  } catch (error) {
    throw new Error(error)
  }
}
