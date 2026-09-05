const path = require('path')

const CATEGORIES = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg'],
  gif: ['.gif'],
  video: ['.mp4', '.webm', '.mov'],
  audio: ['.wav', '.mp3', '.m4a'],
}

const categoryOf = (nome) => {
  const ext = path.extname(nome).toLowerCase()
  return Object.keys(CATEGORIES).find((c) => CATEGORIES[c].includes(ext))
}

// O nome vem de `new Date().toJSON().replace(/\W/g, '')`. Arquivo que o usuario
// trouxe de fora nao casa: devolve null e quem chama usa o mtime.
const dateFromName = (nome) => {
  const m = nome.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z/)
  if (!m) return null
  const [, a, mes, d, h, min, s, ms] = m
  const data = new Date(`${a}-${mes}-${d}T${h}:${min}:${s}.${ms}Z`)
  return Number.isNaN(data.getTime()) ? null : data
}

module.exports = { CATEGORIES, categoryOf, dateFromName }
