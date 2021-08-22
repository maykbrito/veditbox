let latestStream = null

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

module.exports = { getMediaStream }
