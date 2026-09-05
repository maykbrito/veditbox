// Atalhos globais (r, espaco, e os que a Fase 2 registrar) nao podem disparar
// enquanto o usuario digita. Verificado no app rodando: keydown num input
// dentro de <dialog open> SOBE ate o window.onkeydown do gravador de audio,
// entao digitar "reels" na busca comecaria a gravar audio (design doc §8.1).
//
// Custom element com input no shadow DOM (uk-input-tag) reporta a si mesmo
// como e.target no window, nunca o <input> interno — por isso o segundo ramo.
const TAGS_DE_TEXTO = ['INPUT', 'TEXTAREA', 'SELECT']

const isTypingTarget = (el) =>
  !!el &&
  (el.isContentEditable === true ||
    TAGS_DE_TEXTO.includes(el.tagName) ||
    /^UK-(INPUT|CMD|COMMAND|CUSTOM-SELECT|DATEPICKER)/.test(el.tagName || ''))

module.exports = { isTypingTarget }
