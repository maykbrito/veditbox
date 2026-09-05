// §7: a #topBar troca o status por "N selecionados" + acoes. Espaco que ja existe.
const sel = require('./selection')

const topBar = document.querySelector('#topBar')
// Guarda os FILHOS, nao o innerHTML: o #settingsForm tem checkbox com estado e
// listeners, e recria-lo por HTML perderia os dois.
const conteudoOriginal = [...topBar.children]

let apagar = () => {}
let barra = null

const setDeleteHandler = (fn) => {
  apagar = fn
}

// Ponto de extensao pra Fase 3: acoes extras entram aqui e aparecem na barra.
// Ex.: addAction('Adicionar tag', () => addTagToMany(sel.names(), tag))
const acoesExtras = []
const addAction = (label, onClick, className = 'uk-btn uk-btn-default') => {
  acoesExtras.push({ label, onClick, className })
  if (barra) reconstruir()
}

const botao = (label, onClick, className) => {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = className
  el.textContent = label
  el.onclick = onClick
  return el
}

const reconstruir = () => {
  if (barra) barra.remove()

  barra = document.createElement('div')
  barra.className = 'selection-bar'

  const contagem = document.createElement('span')
  contagem.className = 'selection-count'
  barra.appendChild(contagem)
  barra._contagem = contagem

  acoesExtras.forEach(({ label, onClick, className }) =>
    barra.appendChild(botao(label, onClick, className)),
  )

  // --destructive ja aponta pro --red da paleta (theme.css)
  barra.appendChild(botao('Apagar', () => apagar(), 'uk-btn uk-btn-destructive'))
  barra.appendChild(botao('Cancelar', () => sel.clear(), 'uk-btn uk-btn-ghost'))

  topBar.appendChild(barra)
}

const render = () => {
  const n = sel.count()

  if (n === 0) {
    if (barra) barra.remove()
    barra = null
    conteudoOriginal.forEach((el) => topBar.appendChild(el))
    return
  }

  if (!barra) {
    conteudoOriginal.forEach((el) => el.remove())
    reconstruir()
  }

  barra._contagem.textContent = n === 1 ? '1 selecionado' : `${n} selecionados`
}

const mount = () => {
  sel.onChange(render)
}

module.exports = { mount, setDeleteHandler, addAction }
