window.onkeydown = (e) => {
  if (!e.altKey && !e.ctrlKey && !e.metaKey) {
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault()
      e.stopPropagation()
      toggleRecording({ noiseSuppression: !e.shiftKey })
    } else if (e.key === ' ') {
      if (activeThing.play) {
        e.preventDefault()
        e.stopPropagation()
        activeThing.play()
      }
    }
  }
}

function createWaveformDisplay() {
  const el = document.createElement('div')
  el.className = 'waveform-display'
  const createColumn = (startTime) => {
    const column = document.createElement('div')
    column.className = 'waveform-display-column'
    el.appendChild(column)
    let maxAmplitude = 0
    return {
      startTime,
      handleAmplitude: (a) => {
        const amplitude = Math.round(a * 100)
        if (amplitude > maxAmplitude) {
          maxAmplitude = amplitude
          column.style.height = amplitude + '%'
        }
      },
    }
  }
  let startTime = 0
  let lastColumn = createColumn(0)
  return {
    element: el,
    finish: () => {
      el.dataset.finished = 'true'
    },
    handle: (data) => {
      const now = Date.now()
      if (!startTime) startTime = now
      let amplitude = 0
      for (let i = 0; i < data.length; i++) {
        const a = Math.abs(data[i])
        if (a > amplitude) amplitude = a
      }
      const audioTime = now - startTime
      if (audioTime - lastColumn.startTime > 200) {
        lastColumn = createColumn(lastColumn.startTime + 200)
      }
      lastColumn.handleAmplitude(amplitude)
    },
  }
}

let latestStream
async function getMediaStream({ noiseSuppression }) {
  if (latestStream) {
    if (latestStream.noiseSuppression !== noiseSuppression) {
      latestStream.destroy()
      latestStream = null
    }
  }
  if (!latestStream) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: noiseSuppression,
      },
      video: false,
    })
    const destroy = () => {
      for (const track of stream.getTracks()) track.stop()
    }
    latestStream = { noiseSuppression, stream, destroy }
  }
  return latestStream
}

async function toggleRecording({ noiseSuppression }) {
  if (activeThing.isRecording) {
    activeThing.finishRecording()
  } else {
    showStatus('Recording audio...')
    let disposed = false
    const updateStatus = (text) => {
      if (!disposed) showStatus(text)
    }
    activeThing.dispose()
    mainArea.innerHTML = ''
    const waveformDisplay = createWaveformDisplay()
    const el = waveformDisplay.element
    mainArea.appendChild(el)
    const thing = { isRecording: true }
    activeThing = thing
    const disposePromise = new Promise((resolve) => (thing.dispose = resolve))
    const stopPromise = new Promise((resolve) => {
      thing.finishRecording = () => {
        thing.isRecording = false
        resolve()
      }
      disposePromise.then(resolve)
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

    const recordingStopPromise = new Promise(
      (resolve) => (recorder.onstop = resolve),
    )
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
    const name = `${new Date().toJSON().replace(/\W/g, '')}.wav`
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
    el.draggable = true
    el.ondragstart = (event) => {
      event.preventDefault()
      const buffer = Buffer.from(waveBuffer)
      ipcRenderer.send('dragstart', { buffer, name })
    }
  }
}
