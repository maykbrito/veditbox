const { Buffer } = require('buffer')
const { ipcRenderer } = require('electron')
const { showStatus, audioFilePath } = require('../../utils.js')
const { createWaveformDisplay } = require('./waveform-display.js')
const { getMediaStream } = require('./media-stream.js')

window.onkeydown = (e) => {
  if (!e.altKey && !e.ctrlKey && !e.metaKey) {
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault()
      e.stopPropagation()
      toggleRecording({ noiseSuppression: !e.shiftKey })
    } else if (e.key === ' ') {
      if (window.activeThing.play) {
        e.preventDefault()
        e.stopPropagation()
        window.activeThing.play()
      }
    }
  }
}

async function toggleRecording({ noiseSuppression }) {
  if (window.activeThing.isRecording) {
    window.activeThing.finishRecording()
  } else {
    showStatus('Recording audio...')

    let disposed = false

    const updateStatus = (text) => {
      if (!disposed) showStatus(text)
    }

    window.activeThing.dispose()
    mainArea.innerHTML = ''

    const waveformDisplay = createWaveformDisplay()
    const waveformEl = waveformDisplay.element
    mainArea.appendChild(waveformEl)

    const thing = { isRecording: true }
    window.activeThing = thing

    const disposePromise = new Promise((r) => (thing.dispose = r))
    const stopPromise = new Promise((r) => {
      thing.finishRecording = () => {
        thing.isRecording = false
        r()
      }
      disposePromise.then(r)
    })

    let queuedPlay = false
    thing.play = () => {
      thing.finishRecording()
      queuedPlay = true
    }

    const audioCtx =
      window.mainAudioContext || (window.mainAudioContext = new AudioContext())

    const { stream } = await getMediaStream({ noiseSuppression })
    const recorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm; codecs="pcm"',
    })

    const source = audioCtx.createMediaStreamSource(stream)
    const processor = audioCtx.createScriptProcessor(0, 1, 1)
    processor.onaudioprocess = (e) => {
      if (recorder.state !== 'recording') {
        return
      }
      waveformDisplay.handle(e.inputBuffer.getChannelData(0))
    }

    source.connect(processor)
    processor.connect(audioCtx.destination)

    const blobs = []
    recorder.ondataavailable = function (e) {
      blobs.push(e.data)
    }

    const recordingStopPromise = new Promise((r) => (recorder.onstop = r))
    recorder.start()

    await stopPromise
    updateStatus('Stopping recording...')
    recorder.stop()

    source.disconnect()
    processor.disconnect()
    waveformDisplay.finish()

    await recordingStopPromise
    const buffer = await new Blob(blobs).arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(buffer)
    const waveBuffer = audioBufferToWav(audioBuffer)

    const audio = document.createElement('audio')
    const name = audioFilePath
    const blob = new Blob([waveBuffer], { type: 'audio/wav' })
    audio.src = URL.createObjectURL(blob)

    updateStatus(
      `Audio recording [${audioBuffer.duration.toFixed(1)}s] [${(
        waveBuffer.byteLength / 1024
      ).toFixed(1)}kb]`,
    )

    document.body.appendChild(audio)

    thing.play = () => {
      if (audio.paused) {
        audio.currentTime = 0
        audio.play()
      } else {
        audio.pause()
      }
    }

    if (queuedPlay) {
      audio.play()
    }

    disposePromise.then(() => {
      audio.pause()
      audio.remove()
    })

    waveformEl.draggable = true
    waveformEl.ondragstart = (event) => {
      event.preventDefault()
      const buffer = Buffer.from(waveBuffer)
      ipcRenderer.send('dragstart', { buffer, name })
    }
  }
}
