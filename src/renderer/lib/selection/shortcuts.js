// Atalhos da selecao (§7): Cmd+A, Esc, Cmd+Delete, Cmd+Z.
//
// §8.0 — addEventListener, NUNCA `window.onkeydown =`. O gravador de audio
// (recorder/audio/index.js) usa a ATRIBUICAO de propriedade; uma segunda
// atribuicao apagaria a gravacao por atalho em silencio, sem erro.
const sel = require('./selection')
const adapter = require('./store-adapter')
const trash = require('./trash')

// A Fase 3 publica src/utils/is-typing-target.js junto com o campo de busca.
// Enquanto ela nao aterrissa, um fallback equivalente: Cmd+A dentro de um input
// tem que selecionar o TEXTO, nao 92 arquivos. Some quando o modulo dela chegar.
let isTypingTarget
try {
  isTypingTarget = require('../../../utils/is-typing-target').isTypingTarget
} catch (naoMergeadoAinda) {
  isTypingTarget = (alvo) =>
    !!alvo &&
    (alvo.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))
}

const mount = () => {
  window.addEventListener('keydown', (evento) => {
    const digitando = isTypingTarget(evento.target)

    // Cmd+A: seleciona tudo dentro da aba/filtro atual (§7).
    // §10.5: a lista vem de getAll() filtrado, NAO do DOM — ha ~60 celulas
    // montadas para ~90 entradas no indice, e selecionar o DOM faria o usuario
    // apagar 60 de 90 achando que apagou tudo.
    if (evento.metaKey && evento.key === 'a') {
      if (digitando) return
      const nomes = adapter.selectableNames()
      // sem grid na tela (home/preview): deixa o select-all nativo passar
      if (!nomes.length) return
      evento.preventDefault()
      sel.selectAll(nomes)
      return
    }

    // Cmd+Z: undo do ultimo lote apagado
    if (evento.metaKey && evento.key === 'z') {
      if (digitando) return
      evento.preventDefault()
      trash.undoLastDelete()
      return
    }

    // Cmd+Delete dispara (§7). Backspace e a tecla Delete do teclado Mac.
    if (evento.metaKey && (evento.key === 'Backspace' || evento.key === 'Delete')) {
      if (digitando || sel.count() === 0) return
      evento.preventDefault()
      trash.deleteSelected()
      return
    }

    // Esc limpa. So consome o evento se havia selecao, pra nao roubar o Esc de
    // quem fecha modal.
    if (evento.key === 'Escape' && sel.count() > 0) {
      evento.preventDefault()
      sel.clear()
    }
  })
}

module.exports = { mount }
