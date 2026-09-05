// Funcao pura: sem DOM, sem require de electron. E isso que a torna testavel
// em node (design doc §12) — `node scripts/check-search.js`.
//
// ponytail: includes() sobre milhares de itens e instantaneo (medido: ver
// relatorio da Fase 3). Fuse.js so entra se o usuario nao achar o que sabe que
// existe, por erro de digitacao — e entra sobre este mesmo array, sem retrabalho.
const PESOS = { titulo: 8, tags: 4, notes: 2, url: 1 }

// O usuario digita a tag como LEMBRA, nao como salvou: "sertao" acha "Sertão".
const normalizar = (s) =>
  String(s === undefined || s === null ? '' : s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

// Tags entram separadas por espaco para nao casarem por juncao: ['gato','preto']
// nao pode ser achado por "gatopreto".
const campos = (entry) => ({
  titulo: normalizar(entry.titulo),
  tags: normalizar((Array.isArray(entry.tags) ? entry.tags : []).join(' ')),
  notes: normalizar(entry.notes),
  url: normalizar(entry.url),
})

const scoreEntry = (entry, termo) => {
  const t = normalizar(termo)
  if (!t) return 0
  const c = campos(entry)
  return Object.keys(PESOS).reduce(
    (total, campo) => total + (c[campo].includes(t) ? PESOS[campo] : 0),
    0,
  )
}

// §8: escopo e a biblioteca inteira. Quem filtra por aba e o chamador, nao aqui.
const searchEntries = (entries, query) => {
  const termos = normalizar(query).split(/\s+/).filter(Boolean)
  // Cmd+K abre mostrando a biblioteca: query vazia devolve tudo, ordem original.
  if (!termos.length) return entries.slice()

  const pontuados = []
  entries.forEach((entry) => {
    const c = campos(entry)
    let total = 0
    for (const termo of termos) {
      // um termo pode casar em campo diferente do outro, mas TODOS precisam casar
      let doTermo = 0
      for (const campo of Object.keys(PESOS)) {
        if (c[campo].includes(termo)) doTermo += PESOS[campo]
      }
      if (doTermo === 0) return // termo ausente elimina o item
      total += doTermo
    }
    pontuados.push({ entry, total })
  })

  return pontuados
    .sort((a, b) => b.total - a.total || a.entry.name.localeCompare(b.entry.name))
    .map(({ entry }) => entry)
}

module.exports = { searchEntries, scoreEntry, normalizar }
