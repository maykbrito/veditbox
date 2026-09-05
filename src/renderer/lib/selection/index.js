// Boot da Fase 2. Unico require novo em src/renderer/index.js (§10.1).
const ui = require('./selection-ui')
const actionBar = require('./action-bar')
const trash = require('./trash')
const shortcuts = require('./shortcuts')

ui.mount()
actionBar.mount()
actionBar.setDeleteHandler(trash.deleteSelected)
shortcuts.mount()

// Ponto de extensao da Fase 3 (§7, "adicionar tag a N itens" na barra de acao).
// Ligado se o modulo dela ja estiver mergeado; ausente, a barra so nao mostra o
// botao. Esta fase nao depende disso pra fechar.
try {
  const { addTagToMany } = require('../metadata-sheet')
  const sel = require('./selection')

  actionBar.addAction('Adicionar tag', async () => {
    const tag = window.prompt('Tag para os selecionados:')
    if (tag && tag.trim()) addTagToMany(sel.names(), tag.trim())
  })
} catch (fase3NaoMergeada) {
  // segue sem o botao
}

module.exports = { ui, actionBar, trash, shortcuts }
