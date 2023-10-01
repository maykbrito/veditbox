const { getCurrentWindow } = require('@electron/remote')

settingsForm.alwaysOnTop.onchange = () => {
  getCurrentWindow().setAlwaysOnTop(settingsForm.alwaysOnTop.checked)
}