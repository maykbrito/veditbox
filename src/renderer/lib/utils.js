module.exports.activeThing = { dispose: () => {} }

module.exports.showStatus =
  (statusText) =>
  (text, color = 'white') => {
    statusText.textContent = text
    statusText.style.color = color
  }
