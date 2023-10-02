const { windowAlwaysOnTop } = require('../../utils/window-always-on-top')
const { ELEMENTS } = require('../../utils/elements')

const settingsForm = ELEMENTS.settingsForm

settingsForm.alwaysOnTop.onchange = () => {
  windowAlwaysOnTop(settingsForm.alwaysOnTop.checked)
}