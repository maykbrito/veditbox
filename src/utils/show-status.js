const { ELEMENTS } = require('./elements')

const showStatus = (text, color = 'white') => {
  ELEMENTS.statusText.textContent = text
  ELEMENTS.statusText.style.color = color
}

module.exports = { showStatus }