class ELEMENTS {
  static getElement = (selector) => document.querySelector(selector)

  static setElement = (name, selector) => {
    return this[name] = this.getElement(selector)
  }
}

ELEMENTS.setElement('mainArea', '#mainArea')
ELEMENTS.setElement('settingsForm', '#settingsForm')
ELEMENTS.setElement('statusText', '#statusText')
// Seletores por id, nao por tag: 'dialog' e 'dialog button' pegavam o PRIMEIRO
// dialog do documento, entao o Cmd+K da Fase 3 sequestraria o botao de ajuda em
// silencio assim que aparecesse antes dele no DOM (design doc §9.1).
ELEMENTS.setElement('modal', '#helpDialog')
ELEMENTS.setElement('helpBtn', '#helpBtn')
ELEMENTS.setElement('closeBtn', '#helpDialog button')

module.exports = { ELEMENTS }