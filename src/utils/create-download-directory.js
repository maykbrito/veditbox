const fs = require('fs')
const { CONSTANTS } = require('./constants')

const create = () => fs.mkdirSync(CONSTANTS.destDownloadFolder, { recursive: true })

module.exports = { create }
