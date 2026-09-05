const mediaIndex = require('./media-index')

// §4: reconciliacao roda so na abertura. Modulo proprio por causa da regra
// append-only da §10.1 — src/renderer/index.js ganha uma linha, nunca um import.
//
// Rodar no fim do boot ainda e cedo o bastante: library.js so DEFINE funcoes e
// liga onclick no require, nada renderiza ate o usuario clicar numa aba.
const resultado = mediaIndex.reconcile()

console.log(
  `[veditbox] indice: ${resultado.adotados} adotado(s), ` +
    `${resultado.arquivados} arquivado(s), ${resultado.restaurados} restaurado(s)`,
)

module.exports = { resultado }
