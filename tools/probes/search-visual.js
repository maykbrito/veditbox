// Visual da palette: semeia metadado, abre o Cmd+K com resultados e DEIXA
// aberto, pra o screenshot do probe.js pegar a tela de verdade.
// Numero verifica logica; so o olho verifica se o componente esta apertado na
// escala de 10px que a Fase 0 avisou (§ escala do Franken).
//   VEDITBOX_PROBE=search-visual yarn start
;(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  const mediaIndex = require('./lib/media-index')
  const s = require('./lib/search')

  const nomes = mediaIndex.getAll().slice(0, 4).map((e) => e.name)
  mediaIndex.setEntry(nomes[0], {
    titulo: 'reels de gato dormindo',
    tags: ['reels', 'gato'],
    url: 'https://www.instagram.com/reel/abc123',
  })
  mediaIndex.setEntry(nomes[1], {
    titulo: 'reels de cachorro',
    tags: ['reels', 'cachorro', 'engracado'],
    url: 'https://www.facebook.com/reel/892819649954687',
  })
  mediaIndex.setEntry(nomes[2], { notes: 'lembrar dos reels da semana' })
  mediaIndex.setEntry(nomes[3], { titulo: 'paisagem sem reels' })
  mediaIndex.flush()

  s.openSearch()
  await espera(300)
  const inp = document.querySelector('#searchInput')
  inp.value = 'reels'
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  await espera(500)

  const linhas = Array.from(document.querySelectorAll('#searchResults li')).map((li) => ({
    rotulo: li.querySelector('.search-rotulo').textContent,
    pills: Array.from(li.querySelectorAll('.tag-pill')).map((p) => p.textContent),
    meta: (li.querySelector('.search-meta') || {}).textContent,
    selecionada: li.getAttribute('aria-selected') === 'true',
    altura: Math.round(li.getBoundingClientRect().height),
  }))

  // setinhas andam?
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  await espera(150)
  const cursorDepois = Array.from(document.querySelectorAll('#searchResults li')).findIndex(
    (li) => li.getAttribute('aria-selected') === 'true',
  )

  // desfaz o que semeou (menos o screenshot, que ja foi)
  const limpar = () => {
    nomes.forEach((n) => mediaIndex.setEntry(n, { url: '', titulo: '', tags: [], notes: '' }))
    mediaIndex.flush()
  }
  setTimeout(limpar, 1200)

  return {
    ordem: linhas.map((l) => l.rotulo),
    linhas,
    cursorComecaEm0: linhas[0] && linhas[0].selecionada,
    cursorDepoisDeArrowDown: cursorDepois,
    dialogAberto: document.querySelector('#searchDialog').open,
  }
})()
