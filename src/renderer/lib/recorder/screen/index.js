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
  await getVideoSources(async (constraints) => {
    await updateMediaRecorder(constraints)
    previewVideo()
  })
})

ipcRenderer.on('startScreenRecorder', async () => {
  await window.mediaRecorder.start()
  previewVideo()
  showStatus(`Recording`, 'red')
})

ipcRenderer.on('stopScreenRecorder', async () => {
  await window.mediaRecorder.stop()
  mainArea.innerHTML = ''
  showStatus(`Stop recording...`, 'orange')
})

function previewVideo() {
  mainArea.innerHTML = ''
  const videoPlayer = document.createElement('video')
  videoPlayer.setAttribute('autoplay', true)
  videoPlayer.setAttribute('loop', true)
  videoPlayer.srcObject = window.mediaRecorder.stream;
  videoPlayer.play()
  mainArea.appendChild(videoPlayer)
}