// Unica ponte para a API da Fase 1 (design doc §10.2). Se a assinatura de la
// mudar, muda so este arquivo.
//
// Escrito contra a API REAL, medida no codigo da Fase 1 ja mergeado — as
// suposicoes S1 e S4 do plano original estavam erradas: o store e
// `media-index.js` (nao `library/store.js`) e o thumb se apaga com
// `deleteThumb()` (nao montando caminho a mao).
const mediaIndex = require('../media-index')
const thumbs = require('../thumbs')
const lib = require('../library')
const { CONSTANTS } = require('../../../utils/constants')

const ITEM_SELECTOR = '.library-item'

// Espelha a linha do media-index.js: VEDITBOX_DIR existe pros probes rodarem
// numa pasta descartavel. O undo precisa restaurar na MESMA pasta de onde o
// arquivo saiu — usar CONSTANTS.destDownloadFolder direto devolveria o arquivo
// pra biblioteca real durante um teste.
const libDir = () => process.env.VEDITBOX_DIR || CONSTANTS.destDownloadFolder

const nameOf = (el) => el && el.dataset && el.dataset.name

// A aba ativa nao e exportada pela Fase 1; o DOM do menu e a fonte dela
// (set-tab.js marca .active). null = home, sem aba.
const currentTab = () => {
  const li = document.querySelector('#menu li.active')
  return li ? li.dataset.tab : null
}

// §10.5 ARMADILHA DO Cmd+A: ha ~60 celulas no DOM e ~90 entradas no indice,
// porque o grid carrega em lote. Selecionar tem que operar sobre a LISTA, nunca
// sobre o DOM — senao o usuario apaga 60 de 90 achando que apagou tudo.
// Mesmo filtro de library.showLibrary().
const selectableNames = () => {
  const tab = currentTab()
  if (!tab) return []
  return mediaIndex
    .getAll()
    .filter((item) => tab === 'download' || item.category === tab)
    .map((item) => item.name)
}

// So pra pintar/estender intervalo: e a ordem do que esta na tela.
const renderedNames = () => [...lib.getRenderedItems().keys()]

// { el, item } de cada celula montada. Serve pra repintar, nunca pra decidir o
// que esta selecionado (§10.5).
const cellHooksTargets = () => [...lib.getRenderedItems().values()]

const itemEl = (name) => {
  const registro = lib.getRenderedItems().get(name)
  return registro ? registro.el : null
}

const filePath = (name) => {
  const item = mediaIndex.get(name)
  return item ? item.filePath : null
}

const indexGet = (name) => mediaIndex.get(name)
const indexRemove = (name) => mediaIndex.removeEntry(name)

// Undo: recria a entrada e repoe os campos do usuario que estavam nela.
const indexPut = (name, entry) => {
  mediaIndex.addEntry(name)
  if (entry) mediaIndex.setEntry(name, entry)
}

// §10.2: o store grava com debounce de 500ms. Antes de qualquer operacao
// destrutiva (ou de medir o index.json no disco) e obrigatorio fechar a torneira.
const indexFlush = () => mediaIndex.flush()

const deleteThumb = (name) => thumbs.deleteThumb(name)

// §10.5: refresh() remonta a aba atual preservando o scroll.
const repaint = () => lib.refresh()

module.exports = {
  ITEM_SELECTOR,
  libDir,
  nameOf,
  currentTab,
  selectableNames,
  renderedNames,
  cellHooksTargets,
  itemEl,
  filePath,
  indexGet,
  indexRemove,
  indexPut,
  indexFlush,
  deleteThumb,
  repaint,
  cellHooks: lib.cellHooks,
}
