const { getCurrentWindow } = require('@electron/remote')

const windowAlwaysOnTop = (onTop) => {
  getCurrentWindow().setAlwaysOnTop(onTop)
}

module.exports = { windowAlwaysOnTop }