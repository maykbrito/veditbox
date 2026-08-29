const { CONSTANTS } = require('./constants')
const { showStatus } = require('./show-status')

globalThis.destDownloadFolder = CONSTANTS.destDownloadFolder

globalThis.activeThing = { dispose: () => {} }
module.exports.activeThing = globalThis.activeThing

// descarta o preview/gravacao atual e volta pro estado neutro
const resetActiveThing = () => {
  globalThis.activeThing.dispose()
  globalThis.activeThing = { dispose: () => {} }
}
globalThis.resetActiveThing = resetActiveThing
module.exports.resetActiveThing = resetActiveThing

globalThis.showStatus = showStatus
module.exports.showStatus = showStatus