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

module.exports = { createWaveformDisplay }
