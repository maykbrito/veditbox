// Visual do sheet: abre o Offcanvas com metadado carregado e DEIXA aberto pro
// screenshot. Confere tambem que o uk-input-tag nao nasceu apertado na escala
// de 10px do app (aviso da Fase 0).
//   VEDITBOX_PROBE=sheet-visual yarn start
;(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  const mediaIndex = require('./lib/media-index')
  const { openSheet } = require('./lib/metadata-sheet')

  const nome = mediaIndex.getAll()[0].name
  mediaIndex.setEntry(nome, {
    titulo: 'reels de gato dormindo',
    tags: ['reels', 'gato', 'engracado'],
    notes: 'cortar os primeiros 3 segundos antes de usar',
    url: 'https://www.instagram.com/reel/abc123',
  })
  mediaIndex.flush()

  document.querySelector('#menu li[data-tab="download"]').click()
  await espera(600)
  openSheet(nome)
  await espera(800)

  const sheet = document.querySelector('#metadataSheet')
  const it = sheet.querySelector('uk-input-tag')
  const r = {
    abriu: sheet.classList.contains('uk-open'),
    tituloCarregado: sheet.querySelector('input[name=titulo]').value,
    notasCarregadas: sheet.querySelector('textarea[name=notes]').value,
    // a prova de que o value= csv funcionou: as tags salvas voltaram como chips
    tagsCarregadas: it.$tags,
    chipsRenderizados: it.querySelectorAll('button, [class*=tag]').length,
    alturaInputTag: Math.round(it.getBoundingClientRect().height),
    larguraBarra: Math.round(
      sheet.querySelector('.uk-offcanvas-bar').getBoundingClientRect().width,
    ),
    focoNoTitulo:
      document.activeElement === sheet.querySelector('input[name=titulo]'),
  }

  setTimeout(() => {
    mediaIndex.setEntry(nome, { url: '', titulo: '', tags: [], notes: '' })
    mediaIndex.flush()
  }, 1200)

  return r
})()
