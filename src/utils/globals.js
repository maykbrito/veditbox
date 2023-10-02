const { CONSTANTS } = require('./constants')
const { showStatus } = require('./show-status')

globalThis.destDownloadFolder = CONSTANTS.destDownloadFolder

globalThis.activeThing = { dispose: () => {} }
module.exports.activeThing = globalThis.activeThing

globalThis.showStatus = showStatus
module.exports.showStatus = showStatus