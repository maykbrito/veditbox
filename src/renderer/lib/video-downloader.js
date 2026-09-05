const youtubedl = require('../../utils/get-yt-dlp')

const fs = require('fs')
const { CONSTANTS } = require('../../utils/constants')
const { showStatus } = require('../../utils/show-status')

const download = (url) => {
  let err = false
  return new Promise(async (resolve, reject) => {
    const videoFilePath = CONSTANTS.videoFilePath()
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
      // yt-dlp sai com sucesso mesmo quando nao acha video (ex: pin de imagem),
      // deixando um arquivo de 0 bytes que sujava a biblioteca
      const vazio = !fs.existsSync(videoFilePath) || fs.statSync(videoFilePath).size === 0

      if (err || vazio) {
        if (fs.existsSync(videoFilePath)) fs.unlinkSync(videoFilePath)
        return reject(err?.message ? err : new Error('yt-dlp não encontrou vídeo nessa página'))
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
