// §8: Cmd+K abre um <dialog> nativo. Sem campo permanente ocupando a interface,
// e sem kbar/cmdk (sao React — §8 descartou trazer React + bundler pra um projeto
// que deliberadamente nao tem nenhum dos dois).
//
// Por que <dialog> e nao o <uk-command> do Franken: §9.1 (emenda, portanto mais
// recente que a tabela do §9) define "palette Cmd+K, ajuda, sheet -> <dialog>
// HTML, estilizado com Franken". Alem disso o uk-command traz o proprio filtro
// interno, que competiria com o ranking titulo > tag > nota > url que o §8 exige.
const { searchEntries, normalizar } = require('./rank')
const mediaIndex = require('../media-index')
const library = require('../library')
const { showStatus } = require('../../../utils/show-status')
// metadata-sheet nao requer este modulo no topo (so dentro da pill, preguicoso),
// entao nao ha ciclo aqui.
const { openSheet } = require('../metadata-sheet')

const MAX_LINHAS = 50

let dialog
let input
let lista
let linhas = [] // { tipo: 'item'|'comando', item?, acao? }
let cursor = 0

// ---------------------------------------------------------------- montagem

// O dialog nasce em JS e vai pro fim do <body>: nao disputo o index.html com as
// outras fases (§10.1). O alcapao do elements.js ja foi fechado pela Fase 0
// (seletores por id), entao aparecer depois do #helpDialog nao e mais requisito
// — mas continua sendo o lugar certo.
function montar() {
  dialog = document.createElement('dialog')
  dialog.id = 'searchDialog'

  input = document.createElement('input')
  input.id = 'searchInput'
  input.type = 'search'
  input.autocomplete = 'off'
  input.placeholder = 'Buscar em toda a biblioteca: titulo, tag, nota ou url'

  lista = document.createElement('ul')
  lista.id = 'searchResults'

  dialog.append(input, lista)
  document.body.appendChild(dialog)

  input.addEventListener('input', () => render(input.value))
  input.addEventListener('keydown', aoTeclar)
  dialog.addEventListener('close', () => {
    input.value = ''
  })
  // clique no backdrop fecha: o alvo so e o proprio dialog fora do conteudo
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close()
  })
}

// ---------------------------------------------------------------- render

function criarPill(tag) {
  const pill = document.createElement('button')
  pill.type = 'button'
  pill.className = 'tag-pill'
  pill.textContent = tag
  pill.addEventListener('click', (e) => {
    e.stopPropagation() // senao o clique na pill tambem abriria o preview
    filtrarPorTag(tag)
  })
  return pill
}

function criarLinha(conteudo, extraClasse) {
  const li = document.createElement('li')
  if (extraClasse) li.className = extraClasse
  const rotulo = document.createElement('span')
  rotulo.className = 'search-rotulo'
  rotulo.textContent = conteudo
  li.appendChild(rotulo)
  return li
}

function render(query) {
  const todas = mediaIndex.getAll()
  // §8: escopo e a biblioteca inteira, nao a aba atual — o ponto e achar o que
  // nao se sabe onde esta.
  const achados = searchEntries(todas, query).slice(0, MAX_LINHAS)

  linhas = []
  lista.innerHTML = ''

  // §4.1: orfao adotado tem url vazia e NAO ganha tag automatica, entao este
  // filtro e o unico caminho ate ele. Vira comando quando a query casa o nome.
  const q = normalizar(query).trim()
  if (q && 'sem origem'.includes(q)) {
    linhas.push({ tipo: 'comando', acao: filtrarSemOrigem })
    const li = criarLinha('Filtrar: sem origem', 'search-comando')
    const meta = document.createElement('span')
    meta.className = 'search-meta'
    meta.textContent = `${todas.filter((e) => !e.url).length} item(ns)`
    li.appendChild(meta)
    li.addEventListener('click', () => escolher(0))
    lista.appendChild(li)
  }

  achados.forEach((item) => {
    const indice = linhas.length
    linhas.push({ tipo: 'item', item })

    const li = criarLinha(item.titulo || item.name)
    item.tags.forEach((tag) => li.appendChild(criarPill(tag)))

    const meta = document.createElement('span')
    meta.className = 'search-meta'
    meta.textContent = item.domain || item.category || ''
    li.appendChild(meta)

    li.addEventListener('click', () => escolher(indice))
    lista.appendChild(li)
  })

  if (!linhas.length) {
    lista.appendChild(criarLinha('Nada encontrado', 'search-empty'))
  }

  cursor = 0
  marcarCursor()
}

function marcarCursor() {
  Array.from(lista.children).forEach((li, i) =>
    li.setAttribute('aria-selected', String(i === cursor && !!linhas.length)),
  )
}

function mover(delta) {
  if (!linhas.length) return
  cursor = (cursor + delta + linhas.length) % linhas.length
  marcarCursor()
  lista.children[cursor].scrollIntoView({ block: 'nearest' })
}

// ---------------------------------------------------------------- acoes

// O preview da Fase 1 usa a aba corrente pro botao "voltar". Vindo da busca nao
// ha aba corrente (pode estar na home), e showLibrary(null) renderiza vazio.
// Fixar a aba antes e o menor conserto que nao edita library.js, que tem dono.
function abrirPreview(item) {
  library.showLibrary('download')
  library.showPreview(item)
}

function escolher(indice) {
  const linha = linhas[indice]
  if (!linha) return
  closeSearch()
  if (linha.tipo === 'comando') return linha.acao()
  abrirPreview(linha.item)
  openSheet(linha.item.name)
}

function aoTeclar(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    mover(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    mover(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    escolher(cursor)
  }
  // Esc: o proprio <dialog> ja fecha. Nao precisa de codigo.
}

function openSearch() {
  if (!dialog) montar()
  render('')
  dialog.showModal()
  input.focus()
}

const closeSearch = () => {
  if (dialog && dialog.open) dialog.close()
}

// §8: clicar numa pill filtra por aquela tag. renderGrid aceita lista arbitraria
// (§10.2), entao o resultado usa o grid de verdade, com thumbs e hover.
function filtrarPorTag(tag) {
  const alvo = normalizar(tag)
  const items = mediaIndex.getAll().filter((e) => e.tags.some((t) => normalizar(t) === alvo))
  closeSearch()
  library.renderGrid(items, 'download')
  showStatus(`tag: ${tag} — ${items.length} item(ns)`)
}

function filtrarSemOrigem() {
  const items = mediaIndex.getAll().filter((e) => !e.url)
  closeSearch()
  library.renderGrid(items, 'download')
  showStatus(`sem origem — ${items.length} item(ns)`)
}

// ---------------------------------------------------------------- atalho

// §8.0: addEventListener, nunca `document.onkeydown = ...`.
//
// Cmd+K e o UNICO atalho que ignora a guarda de foco de §8.1, DE PROPOSITO:
// ele precisa funcionar de dentro de um campo de texto, porque e como se sai de
// la. Nao "conserte" isto adicionando isTypingTarget aqui.
document.addEventListener('keydown', (e) => {
  if (!e.metaKey || e.key.toLowerCase() !== 'k') return
  e.preventDefault()
  if (dialog && dialog.open) closeSearch()
  else openSearch()
})

module.exports = {
  openSearch,
  closeSearch,
  filtrarPorTag,
  filtrarSemOrigem,
}
