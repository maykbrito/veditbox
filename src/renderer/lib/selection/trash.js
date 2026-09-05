// Orquestra delete e undo no renderer.
//
// §7, cada exclusao faz TRES coisas: manda pra Lixeira, remove a entrada do
// indice, e apaga o thumb do cache.
const { ipcRenderer } = require('electron')
const { dialog, getCurrentWindow } = require('@electron/remote')

const { showStatus } = require('../../../utils/show-status')

const sel = require('./selection')
const adapter = require('./store-adapter')

// §7: pilha de UM nivel. So o ultimo lote, nao historico.
// [{ name, entry, trashedPath }]
let ultimoLote = null

const lastBatch = () => ultimoLote

// §7/§9.1: 1 item nao confirma — a Lixeira ja e o undo, e confirmar exclusao
// recuperavel de um arquivo e atrito. 2+ confirma mostrando a CONTAGEM, porque
// selecao multipla e onde um clique errado leva 40 arquivos.
// showMessageBox do main (nativo do SO) em vez de <dialog> HTML: e o que o
// Finder faz, e desacopla esta fase do design system.
const confirmar = async (n) => {
  if (n < 2) return true

  const { response } = await dialog.showMessageBox(getCurrentWindow(), {
    type: 'warning',
    buttons: ['Apagar', 'Cancelar'],
    defaultId: 0,
    cancelId: 1,
    message: `Mover ${n} arquivos para a Lixeira?`,
    detail: 'Da pra recuperar com Cmd+Z ou pela Lixeira do sistema.',
  })

  return response === 0
}

const plural = (n) => (n === 1 ? '1 arquivo' : `${n} arquivos`)

const deleteSelected = async () => {
  const nomes = sel.names()
  if (!nomes.length) return

  if (!(await confirmar(nomes.length))) return

  // §10.2: o store grava com debounce de 500ms. Fechar a torneira ANTES da
  // operacao destrutiva, senao o debounce pega o estado velho.
  adapter.indexFlush()

  // Retrato ANTES de apagar: depois do trash a entrada do indice ja era, e e
  // ela que o undo repoe.
  const lote = nomes.map((name) => ({
    name,
    entry: adapter.indexGet(name),
    filePath: adapter.filePath(name),
  }))

  const { ok, fail } = await ipcRenderer.invoke(
    'trash-files',
    lote.map(({ filePath }) => filePath),
  )

  // Casa o resultado do main de volta com os nomes, pelo caminho enviado.
  const porCaminho = new Map(ok.map((o) => [o.path, o.trashedPath]))
  const apagados = lote.filter(({ filePath }) => porCaminho.has(filePath))

  // As outras duas coisas de §7, so pros que sairam mesmo da pasta
  apagados.forEach(({ name }) => {
    adapter.indexRemove(name)
    adapter.deleteThumb(name)
  })

  // grava ja: o proximo boot tem que ver o indice sem os apagados
  adapter.indexFlush()

  ultimoLote = apagados.map((item) => ({
    ...item,
    trashedPath: porCaminho.get(item.filePath),
  }))

  // tira da selecao so o que sumiu; o que falhou continua selecionado
  sel.remove(apagados.map(({ name }) => name))
  adapter.repaint()

  if (fail.length) {
    // §7 falha e avisa. Os que falharam continuam selecionados, entao a barra
    // ainda esta de pe e o #statusText, escondido — o aviso sai nos dois.
    const aviso = `${ok.length} na Lixeira, ${fail.length} falharam: ${fail[0].error}`
    showStatus(aviso, 'var(--red)')
    require('./action-bar').showError(aviso)
    console.error('falhas ao apagar:', fail)
    return
  }

  showStatus(`${plural(ok.length)} na Lixeira — Cmd+Z desfaz`)
}

const undoLastDelete = async () => {
  if (!ultimoLote || !ultimoLote.length) {
    showStatus('Nada pra desfazer')
    return
  }

  const lote = ultimoLote

  const { ok, fail } = await ipcRenderer.invoke(
    'untrash-files',
    lote.map(({ name, trashedPath }) => ({ name, trashedPath })),
    adapter.libDir(),
  )

  const restaurados = new Set(ok)

  lote
    .filter(({ name }) => restaurados.has(name))
    .forEach(({ name, entry }) => adapter.indexPut(name, entry))

  adapter.indexFlush()

  // §7: pilha de UM nivel — consumida, nao empilhada. Segundo Cmd+Z nao faz nada.
  ultimoLote = null

  adapter.repaint()

  // §7 best-effort: Lixeira esvaziada => FALHA E AVISA, nunca finge sucesso.
  if (fail.length) {
    showStatus(
      `${ok.length} de volta, ${fail.length} nao: ${fail[0].error}`,
      'var(--red)',
    )
    console.error('falhas ao restaurar:', fail)
    return
  }

  showStatus(`${plural(ok.length)} de volta da Lixeira`)
}

module.exports = { deleteSelected, undoLastDelete, lastBatch }
