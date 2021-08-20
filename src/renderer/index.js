const { Buffer } = require('buffer')
const { ipcRenderer } = require('electron')
const VideoFile = require('./lib/VideoFile.js')
const ImageFile = require('./lib/ImageFile.js')
const { VideoDownloader } = require('./lib/VideoDownloader.js')

let { activeThing, showStatus } = require('./lib/utils.js')
require('./lib/control-window.js')

// Configure status message
showStatus = showStatus(statusText)
showStatus('Paste image, url or press R to start record audio')

// Paste content from clipboard
document.onpaste = async (e) => {
  e.preventDefault()
  let isUrl = (e.clipboardData || window.clipboardData).getData('text')

  const urlOrFile = !isUrl ? e.clipboardData.files[0] : isUrl

  handlePaste(urlOrFile)
}

async function handlePaste(urlOrFile) {
  const url = typeof urlOrFile === 'string' ? urlOrFile : null

  const custom = ['https://media.giphy', 'mp4', 'pexels']
  const imagesType = ['png', 'gif', 'jpg', 'jpeg', 'webp']
  const customSocialMedia = ['twitter', 'instagram']
  const allowed = [...custom, ...imagesType, ...customSocialMedia]

  const handlers = {
    giphy() {
      const giphyPureUrl = url.replace(/media\./g, 'i.')
      const giphy = new ImageFile(giphyPureUrl, 'gif')
      return { message: 'Giphy pasted — reading it...', handle: giphy }
    },
    pexels() {
      return this.mp4()
    },
    mp4(customUrl = null) {
      const link = customUrl || url
      const video = new VideoFile(link)
      return { message: 'Video pasted — reading it...', handle: video }
    },
    image() {
      const image = new ImageFile(urlOrFile)
      return { message: 'Image pasted — reading it...', handle: image }
    },
    async customSocialDownloader() {
      const filePath = await VideoDownloader(url, showStatus)
      return this.mp4(filePath)
    },
  }

  // If we not have a url, we assume it's a file
  if (!url) {
    processHandler(handlers.image())
    return
  }

  // Let's look for a handler
  let handler = allowed.find((type) => {
    const urlHasType = url.includes(type)

    const imageType = imagesType.includes(type) ? 'image' : type
    const customSocialType = customSocialMedia.includes(type)
      ? 'customSocialDownloader'
      : type

    const imageOrCustomSocialOrType =
      imageType != type ? imageType : customSocialType
    const hasFunction = Object.keys(handlers).includes(
      imageOrCustomSocialOrType,
    )

    return hasFunction && urlHasType
  })

  // handler found!
  if (handler) {
    if (imagesType.includes(handler)) {
      handler = 'image'
    } else if (customSocialMedia.includes(handler)) {
      handler = 'customSocialDownloader'
    }

    const handlerResult = await handlers[handler]()
    processHandler(handlerResult)
  }
}

function processHandler({ message, handle }) {
  showStatus(message)
  handle.generate()
  activeThing.dispose()
  mainArea.innerHTML = ''
  handle.setEvents(showStatus, mainArea, activeThing, ipcRenderer)
}

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
    const currentStream = await getMediaStream({ noiseSuppression })
    const stream = currentStream.stream
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
