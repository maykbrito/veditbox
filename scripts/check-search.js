// Logica pura da Fase 3 (design doc §12): roda em node, sem Electron e sem DOM.
// Rode: node scripts/check-search.js
const assert = require('assert')
const { isTypingTarget } = require('../src/utils/is-typing-target')

const el = (tagName, extra = {}) => ({ tagName, isContentEditable: false, ...extra })

assert.equal(isTypingTarget(el('INPUT')), true, 'input digita')
assert.equal(isTypingTarget(el('TEXTAREA')), true, 'textarea digita')
assert.equal(isTypingTarget(el('SELECT')), true, 'select captura teclas')
assert.equal(
  isTypingTarget(el('DIV', { isContentEditable: true })),
  true,
  'contenteditable digita',
)
assert.equal(isTypingTarget(el('DIV')), false, 'div comum nao digita')
assert.equal(isTypingTarget(el('BODY')), false, 'body nao digita')
assert.equal(isTypingTarget(null), false, 'alvo nulo nao quebra')
assert.equal(isTypingTarget(undefined), false, 'alvo indefinido nao quebra')

// O <uk-input-tag> do Franken e um custom element: o input real vive no shadow
// DOM, entao e.target no window vira o HOST, nao o <input>. Sem isto, digitar
// uma tag no sheet dispara a gravacao de audio.
assert.equal(
  isTypingTarget(el('UK-INPUT-TAG')),
  true,
  'custom element de input do franken digita',
)

console.log('ok is-typing-target')
