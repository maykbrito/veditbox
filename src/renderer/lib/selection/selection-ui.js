// Pintura da selecao no grid e interpretacao do clique.
//
// O checkbox entra por `cellHooks` (§10.2): o hook roda uma vez por celula, ja
// com ela no DOM, e cobre os lotes incrementais do IntersectionObserver sem
// precisar de MutationObserver.
const sel = require('./selection')
const adapter = require('./store-adapter')

// Idempotente: o hook roda uma vez por celula, mas paint() reentra aqui.
const garantirCheckbox = (el) => {
  let box = el.querySelector('.select-box')
  if (box) return box

  box = document.createElement('input')
  box.type = 'checkbox'
  box.className = 'select-box'
  // fora da ordem de tab: o alvo de teclado desta fase e o grid, nao o checkbox
  box.tabIndex = -1
  el.appendChild(box)
  return box
}

const pintarCelula = (el, name) => {
  const marcado = sel.has(name)
  garantirCheckbox(el).checked = marcado
  el.classList.toggle('selected', marcado)
  // arrastar 40 arquivos nao e o que esta fase entrega; em modo selecao, desliga
  el.draggable = sel.count() === 0
}

const paint = () => {
  adapter.cellHooksTargets().forEach(({ el, item }) => pintarCelula(el, item.name))
  document.body.classList.toggle('selecting', sel.count() > 0)
}

const aoClicar = (event) => {
  const el = event.target.closest(adapter.ITEM_SELECTOR)
  if (!el) return

  const name = adapter.nameOf(el)
  if (!name) return

  const noCheckbox = event.target.classList.contains('select-box')

  // Clique simples, sem selecao ativa e fora do checkbox: preview, como hoje (§7)
  if (!noCheckbox && !event.shiftKey && sel.count() === 0) return

  // Capture + stopPropagation: e o que impede o `el.onclick = showPreview` que a
  // Fase 1 poe em cada celula de disparar. Consumir aqui e mais barato do que
  // pedir um hook de clique pra dona do grid.
  // stopPropagation e o que impede o preview; preventDefault e o que quebrava.
  event.stopPropagation()

  // Num <input type=checkbox> o browser marca ANTES de disparar o clique e
  // REVERTE depois se o default for cancelado — desfazendo o paint() que roda
  // aqui no meio. O sintoma era a marcacao atrasada em um passo. Sem
  // preventDefault, o toggle nativo fica de pe e paint() escreve o valor
  // autoritativo por cima. Probe: tools/probes/checkbox-lag.js
  if (!noCheckbox) event.preventDefault()

  // Shift estende sobre a ordem EXIBIDA — intervalo e um gesto sobre a tela.
  // Cmd+A e outra historia: opera sobre a lista (§10.5), ver shortcuts.js.
  if (event.shiftKey) {
    sel.extendTo(name, adapter.renderedNames())
  } else {
    sel.toggle(name)
  }
}

const mount = () => {
  // fase de captura: chega antes do onclick da celula
  document.addEventListener('click', aoClicar, true)

  // §10.2: o hook roda 1x por celula, logo apos entrar no DOM. Ja aplica o
  // estado atual — importante depois de um refresh(), que recria tudo.
  adapter.cellHooks.push((el, item) => pintarCelula(el, item.name))

  sel.onChange(paint)
}

module.exports = { mount, paint }
