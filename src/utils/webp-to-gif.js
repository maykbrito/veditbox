const magick = require('imagemagick');
const fs = require('fs')

function webpToGif(file) {
  if(!file.includes('webp')) return file
  let gifFile = file.replace('.webp', '.gif')

  if(fs.existsSync(gifFile)) return gifFile

  return new Promise((resolve, reject) => {
    // o 'error' (ENOENT, convert ausente) nao tem listener no pacote: sem isso vira uncaught
    magick
      .convert([file, '-format',  'gif', gifFile], (err) => {
        if (err) return reject(err)
        resolve(gifFile)
      })
      .on('error', reject)
  })
}

module.exports = { webpToGif }