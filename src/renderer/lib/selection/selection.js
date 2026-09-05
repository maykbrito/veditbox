// Estado puro da selecao. Sem DOM, sem fs — por isso da pra testar com node.
//
// §10.5: este modulo nunca ve o DOM. Quem chama passa a lista de nomes, e a
// regra do contrato e que essa lista venha de getAll() filtrado pela aba, nao
// das celulas renderizadas.
const selecionados = new Set()
const ouvintes = []

let ancora = null
// Guarda o que havia antes do shift atual, pra encolher o intervalo sem residuo
let baseDaExtensao = null

const has = (name) => selecionados.has(name)
const count = () => selecionados.size
const names = () => [...selecionados]

const notificar = () => ouvintes.forEach((fn) => fn())
const onChange = (fn) => ouvintes.push(fn)

// Inclusivo nas duas pontas, indiferente a direcao. Ponta fora da lista = vazio.
const rangeBetween = (a, b, orderedNames) => {
  const i = orderedNames.indexOf(a)
  const j = orderedNames.indexOf(b)
  if (i === -1 || j === -1) return []
  return orderedNames.slice(Math.min(i, j), Math.max(i, j) + 1)
}

const toggle = (name) => {
  if (selecionados.has(name)) {
    selecionados.delete(name)
  } else {
    selecionados.add(name)
  }
  ancora = name
  baseDaExtensao = null
  notificar()
}

const extendTo = (name, orderedNames) => {
  if (ancora === null) return toggle(name)

  // Sem isto, um extendTo grande seguido de um pequeno deixaria os itens do
  // intervalo maior selecionados. O Finder encolhe; aqui tambem.
  if (baseDaExtensao === null) baseDaExtensao = new Set(selecionados)

  selecionados.clear()
  baseDaExtensao.forEach((n) => selecionados.add(n))
  rangeBetween(ancora, name, orderedNames).forEach((n) => selecionados.add(n))
  notificar()
}

const selectAll = (orderedNames) => {
  orderedNames.forEach((n) => selecionados.add(n))
  baseDaExtensao = null
  notificar()
}

// Depois de apagar: tira da selecao so o que sumiu de fato.
const remove = (namesToDrop) => {
  namesToDrop.forEach((n) => selecionados.delete(n))
  baseDaExtensao = null
  notificar()
}

const clear = () => {
  selecionados.clear()
  ancora = null
  baseDaExtensao = null
  notificar()
}

module.exports = {
  has,
  count,
  names,
  toggle,
  extendTo,
  selectAll,
  remove,
  clear,
  onChange,
  rangeBetween,
}
