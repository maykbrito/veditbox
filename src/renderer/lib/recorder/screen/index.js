const { ipcRenderer, remote } = require('electron')
const { getVideoSources, createMediaRecorder } = require('./video-sources')
const {
  handleDataAvailable,
  handleStop,
  createVideoFile,
} = require('./handlers.js')

const path = require('path')
const { app } = remote
let destDownloadFolder = app.getPath('videos')
const videoFilePath = path.join(destDownloadFolder, 'temp.mp4')

module.exports.screenRecorder = ({
  showStatus,
  VideoFile,
  mainArea,
  activeThing,
}) => {
  let mediaRecorder

    // start default video source
  ;(async () => {
    await getVideoSources(updateMediaRecorder, true)
  })()

  // handlers
  async function onstop(e) {
    await handleStop()
    await createVideoFile(videoFilePath, showStatus)
    const video = new VideoFile(videoFilePath)
    await video.generate()
    activeThing.dispose()
    mainArea.innerHTML = ''
    video.setEvents(showStatus, mainArea, activeThing, ipcRenderer)
  }

  async function ondataavailable(e) {
    handleDataAvailable(e)
  }

  async function updateMediaRecorder(constraints) {
    mediaRecorder = await createMediaRecorder(
      constraints,
      ondataavailable,
      onstop,
    )
    console.log(mediaRecorder)
  }

  // EVENTS =========================================
  // Start recording when global shortcut key is pressed
  ipcRenderer.on('screenRecorderSelectSource', async () => {
    // Get the available video sources
    await getVideoSources(updateMediaRecorder)
  })

  ipcRenderer.on('startScreenRecorder', async () => {
    await mediaRecorder.start()
    showStatus(`Recording`, 'red')
  })

  // Stop recording when global shortcut key is pressed
  ipcRenderer.on('stopScreenRecorder', async () => {
    await mediaRecorder.stop()
    showStatus(`Stop recording`, 'green')
  })
}
