const magick = require('imagemagick');
const fs = require('fs')

function webpToGif(file) {
  if(!file.includes('webp')) return file
  let gifFile = file.replace('.webp', '.gif')

  if(fs.existsSync(gifFile)) return gifFile

  return new Promise((resolve) => {
    magick.convert([file, '-format',  'gif', gifFile], (err, stdout) => {
      if (err) throw err;
      resolve(gifFile)
    })
  })
}

module.exports = { webpToGif }