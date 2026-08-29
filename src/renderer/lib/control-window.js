const { getCurrentWindow } = require('@electron/remote')
const { ELEMENTS } = require('../../utils/elements')

const settingsForm = ELEMENTS.settingsForm

settingsForm.alwaysOnTop.onchange = () => {
  getCurrentWindow().setAlwaysOnTop(settingsForm.alwaysOnTop.checked)
}