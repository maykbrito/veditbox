class ELEMENTS {
  static getElement = (selector) => document.querySelector(selector)

  static setElement = (name, selector) => {
    return this[name] = this.getElement(selector)
  }
}

ELEMENTS.setElement('mainArea', '#mainArea')
ELEMENTS.setElement('settingsForm', '#settingsForm')
ELEMENTS.setElement('statusText', '#statusText')
ELEMENTS.setElement('modal', 'dialog')
ELEMENTS.setElement('helpBtn', '#helpBtn')
ELEMENTS.setElement('closeBtn', 'dialog button')

module.exports = { ELEMENTS }