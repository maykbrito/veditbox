const {
  ipcRenderer,
  remote: { getCurrentWindow },
} = require('electron')

settingsForm.alwaysOnTop.onchange = () => {
  getCurrentWindow().setAlwaysOnTop(settingsForm.alwaysOnTop.checked)
}

settingsForm.autoPaste.onchange = () => {
  ipcRenderer.send('clipboardMonitor', {
    on: settingsForm.autoPaste.checked,
  })
}
