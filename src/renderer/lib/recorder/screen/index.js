const { ipcRenderer } = require('electron')
const { getVideoSources, createMediaRecorder } = require('./video-sources')
const { showStatus } = require('../../utils.js')

// start default video source
;(async () => {
  await getVideoSources(updateMediaRecorder, true)
})()

async function updateMediaRecorder(constraints) {
  await createMediaRecorder(constraints)
}

// Events when global shortcut key is pressed
ipcRenderer.on('screenRecorderSelectSource', async () => {
  await getVideoSources(updateMediaRecorder)
})

ipcRenderer.on('startScreenRecorder', async () => {
  await window.mediaRecorder.start()
  showStatus(`Recording`, 'red')
})

ipcRenderer.on('stopScreenRecorder', async () => {
  await window.mediaRecorder.stop()
  showStatus(`Stop recording`, 'green')
})
