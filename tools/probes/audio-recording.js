// VEDITBOX_PROBE=audio-recording yarn start
// Grava no temporario, nunca na biblioteca do usuario.
;(async () => {
  const assert = require('assert')
  const fs = require('fs')
  const os = require('os')
  const path = require('path')
  const { systemPreferences } = require('@electron/remote')
  const { CONSTANTS } = require('../utils/constants')
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'veditbox-audio-'))
  let file
  const originalPath = CONSTANTS.audioFilePath
  CONSTANTS.audioFilePath = () => file
  const errors = []
  const onError = (event) => errors.push(String(event.reason))
  window.addEventListener('unhandledrejection', onError)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const key = (shiftKey) => document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key: shiftKey ? 'R' : 'r', shiftKey, bubbles: true }),
  )
  const status = () => document.querySelector('#statusText').textContent
  const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  let requestedNoiseSuppression
  navigator.mediaDevices.getUserMedia = (constraints) => {
    requestedNoiseSuppression = constraints.audio.noiseSuppression
    return getUserMedia(constraints)
  }
  try {
    const results = []
    for (const shiftKey of [false, true]) {
    file = path.join(folder, `recording-${shiftKey}.wav`)
    const { getMediaStream } = require('./lib/recorder/audio/media-stream')
    const previous = await getMediaStream({ noiseSuppression: shiftKey })
    previous.stream.getTracks().forEach((track) => track.stop())
    key(shiftKey)
    await wait(2500)
    assert.strictEqual(requestedNoiseSuppression, shiftKey, 'R sem redutor; Shift+R com redutor')
    const { stream } = await getMediaStream({ noiseSuppression: shiftKey })
    const track = stream.getAudioTracks()[0]
    const columns = [...document.querySelectorAll('.waveform-display-column')]
    const waveformHasSignal = columns
      .some((column) => parseFloat(column.style.height) > 0)
    key(shiftKey)
    const deadline = Date.now() + 8000
    while (!fs.existsSync(file) && !errors.length && Date.now() < deadline) {
      await wait(100)
    }
    const result = {
      permission: systemPreferences.getMediaAccessStatus('microphone'),
      status: status(),
      errors,
      saved: fs.existsSync(file),
      pcmSupported: MediaRecorder.isTypeSupported('audio/webm; codecs="pcm"'),
      track: { label: track.label, muted: track.muted, settings: track.getSettings() },
      contextState: window.mainAudioContext.state,
    }
    console.log('AUDIO DIAGNOSTIC', JSON.stringify(result))
    assert(result.saved, 'R deve gravar e salvar um WAV: ' + JSON.stringify(result))
    const wav = fs.readFileSync(file)
    assert.strictEqual(wav.toString('ascii', 0, 4), 'RIFF')
    assert(wav.length > 44, 'WAV deve conter amostras de audio')
    const decoded = await window.mainAudioContext.decodeAudioData(
      wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength),
    )
    const samples = decoded.getChannelData(0)
    let peak = 0
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
    assert.strictEqual(track.readyState, 'live', 'Nova gravacao deve reabrir a captura interrompida')
    // Sem fala, ruido pode arredondar para 0%; mais colunas provam o processamento.
    assert(columns.length > 1, 'A onda deve processar a captura ao longo do tempo')
    results.push({ ...result, shiftKey, bytes: wav.length, peak, waveformHasSignal })
    }
    return { results, PASSOU: true }
  } finally {
    navigator.mediaDevices.getUserMedia = getUserMedia
    window.activeThing.dispose()
    CONSTANTS.audioFilePath = originalPath
    window.removeEventListener('unhandledrejection', onError)
    fs.rmSync(folder, { recursive: true, force: true })
  }
})()
