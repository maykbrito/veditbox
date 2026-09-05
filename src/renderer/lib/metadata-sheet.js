// §8: sheet lateral direito pra editar titulo, tags e notas.
//
// Offcanvas do Franken (§9), mas via `UIkit.offcanvas(el)` e nao <uk-offcanvas>:
// MEDIDO no probe `franken-api` que o custom element `uk-offcanvas` NAO esta
// registrado neste bundle vendorizado — o componente existe so como UIkit JS.
// Ver relatorio da Fase 3.
const mediaIndex = require('./media-index')
const library = require('./library')
const { showStatus } = require('../../utils/show-status')

let sheet
let offcanvas
let campoTitulo
let campoNotas
let campoTags
let atual = null

// ---------------------------------------------------------------- montagem

function montar() {
  sheet = document.createElement('div')
  sheet.id = 'metadataSheet'
  sheet.innerHTML = `
    <div class="uk-offcanvas-bar">
      <h3 data-nome></h3>
      <label>Titulo<input type="text" name="titulo" /></label>
      <label>Tags<span data-tags></span></label>
      <label>Notas<textarea name="notes" rows="5"></textarea></label>
      <div class="sheet-acoes">
        <button type="button" class="uk-btn uk-btn-primary" data-salvar>Salvar</button>
        <button type="button" class="uk-btn uk-btn-default" data-fechar>Fechar</button>
      </div>
    </div>
  `
  document.body.appendChild(sheet)

  // acesso por querySelector, nao por `form.titulo`: o container e uma <div>,
  // e acesso nomeado a campo so existe em HTMLFormElement.
  campoTitulo = sheet.querySelector('input[name=titulo]')
  campoNotas = sheet.querySelector('textarea[name=notes]')
  // flip: lado direito (§8). overlay: escurece o resto em vez de empurrar o grid.
  offcanvas = window.UIkit.offcanvas(sheet, { flip: true, overlay: true })

  sheet.querySelector('[data-salvar]').addEventListener('click', salvar)
  sheet.querySelector('[data-fechar]').addEventListener('click', closeSheet)

  // Cmd+Enter salva sem tirar a mao do teclado. addEventListener (§8.0), e a
  // guarda de foco de §8.1 nao se aplica: e atalho local do sheet, com metaKey.
  sheet.addEventListener('keydown', (e) => {
    if (e.metaKey && e.key === 'Enter') {
      e.preventDefault()
      salvar()
    }
  })
}

// MEDIDO (probe franken-api3): o <uk-input-tag> le as tags iniciais do atributo
// `value` (csv) — NAO de `state`, que a doc sugere e que aqui nasce vazio. E ele
// so le na inicializacao: trocar o atributo depois nao recarrega. Por isso o
// elemento e recriado a cada abertura, que e mais barato que lutar com o Lit.
function montarCampoTags(tags) {
  const slot = sheet.querySelector('[data-tags]')
  slot.innerHTML = ''
  const el = document.createElement('uk-input-tag')
  el.setAttribute('name', 'tags')
  el.setAttribute('value', tags.join(','))
  slot.appendChild(el)
  campoTags = el
}

// Le de volta o que o usuario deixou no campo. `$tags` e a prop do Lit; os
// inputs hidden `tags[]` sao o espelho dela e servem de rede se a prop sumir.
function lerTags() {
  if (!campoTags) return []
  if (Array.isArray(campoTags.$tags) && campoTags.$tags.length) {
    return campoTags.$tags.slice()
  }
  return Array.from(sheet.querySelectorAll('input[type=hidden]'))
    .map((i) => i.value)
    .filter(Boolean)
}

// ---------------------------------------------------------------- abrir/salvar

function openSheet(nome) {
  if (!sheet) montar()
  const item = mediaIndex.get(nome)
  if (!item) return
  atual = item

  sheet.querySelector('[data-nome]').textContent = item.name
  campoTitulo.value = item.titulo || ''
  campoNotas.value = item.notes || ''
  montarCampoTags(item.tags || [])

  offcanvas.show()
  campoTitulo.focus()
}

function closeSheet() {
  if (offcanvas) offcanvas.hide()
}

function salvar() {
  if (!atual) return
  mediaIndex.setEntry(atual.name, {
    titulo: campoTitulo.value.trim(),
    // §2.4: o app NUNCA acrescenta tag por conta propria. So o que o usuario
    // deixou no campo — nem o tipo, nem "sem origem", nada.
    tags: lerTags(),
    notes: campoNotas.value,
  })
  // §10.2: sem flush() o debounce de 500ms segura a escrita, e fechar o app
  // dentro da janela perderia a edicao em silencio.
  mediaIndex.flush()

  showStatus(`Metadados salvos: ${atual.name}`)
  atualizarPillsDaCelula(atual.name)
  closeSheet()
}

// ---------------------------------------------------------------- pills no grid

// §8: "pills de tag: badges na interface; clicar filtra por aquela tag".
// library.js reserva `cellHooks` exatamente pra isto ("Fase 3 empurra os pills
// de tag"), entao o grid ganha as pills sem eu editar arquivo da Fase 1.
function pintarPills(el, item) {
  const antigo = el.querySelector('.library-tags')
  if (antigo) antigo.remove()
  if (!item.tags || !item.tags.length) return

  const caixa = document.createElement('div')
  caixa.className = 'library-tags'
  item.tags.forEach((tag) => {
    const pill = document.createElement('button')
    pill.type = 'button'
    pill.className = 'tag-pill'
    pill.textContent = tag
    pill.addEventListener('click', (e) => {
      // a celula inteira abre o preview no clique; a pill filtra em vez disso
      e.stopPropagation()
      require('./search').filtrarPorTag(tag)
    })
    caixa.appendChild(pill)
  })
  el.appendChild(caixa)
}

library.cellHooks.push(pintarPills)

// depois de salvar, a celula que estiver no DOM reflete as tags novas
function atualizarPillsDaCelula(nome) {
  const registro = library.getRenderedItems().get(nome)
  if (!registro) return
  const atualizado = mediaIndex.get(nome)
  if (atualizado) pintarPills(registro.el, atualizado)
}

// ---------------------------------------------------------------- fase 2

// §8: "adicionar tag a N itens" na barra de acao da selecao multipla.
// Devolve quantos itens realmente mudaram — quem ja tinha a tag nao conta.
function addTagToMany(names, tag) {
  const limpa = String(tag || '').trim()
  if (!limpa || !names || !names.length) return 0

  let alterados = 0
  names.forEach((nome) => {
    const item = mediaIndex.get(nome)
    if (!item) return
    const jaTem = item.tags.some((t) => t.toLowerCase() === limpa.toLowerCase())
    if (jaTem) return
    mediaIndex.setEntry(nome, { tags: item.tags.concat(limpa) })
    alterados++
  })

  if (alterados) {
    mediaIndex.flush()
    names.forEach(atualizarPillsDaCelula)
  }
  return alterados
}

module.exports = { openSheet, closeSheet, addTagToMany }
