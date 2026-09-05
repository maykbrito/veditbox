// Probe na BIBLIOTECA REAL, com os 2 .mp4 de 0 byte (residuo do bug antigo do
// yt-dlp, §7/§10.3) — o alvo legitimo desta fase.
//
// Faz o ROUND-TRIP COMPLETO: apaga, mede as tres coisas de §7 no disco, desfaz,
// e mede de novo. A biblioteca termina exatamente como comecou. Apagar de vez e
// decisao do usuario, com um clique, nao de um probe.
//
//   VEDITBOX_PROBE=selection-real yarn start
;(async () => {
  const fs = require('fs')
  const path = require('path')
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))

  const sel = require('./lib/selection/selection')
  const adapter = require('./lib/selection/store-adapter')
  const trash = require('./lib/selection/trash')
  const mediaIndex = require('./lib/media-index')

  const LIB = adapter.libDir()
  const INDEX = path.join(LIB, '.veditbox', 'index.json')
  const chaves = () =>
    Object.keys(JSON.parse(fs.readFileSync(INDEX, 'utf8'))).filter((k) => k !== 'arquivadas')

  const resultado = { libDir: LIB }

  document.querySelector('#menu li[data-tab="download"]').click()
  await espera(1200)

  // acha os quebrados pelo tamanho, sem detector de duplicados/vazios em
  // producao — §7 e §11 proibem construir isso. Aqui e so a escolha do alvo.
  const vazios = mediaIndex
    .getAll()
    .filter((item) => {
      try {
        return fs.statSync(item.filePath).size === 0
      } catch (erro) {
        return false
      }
    })
    .map((item) => item.name)

  resultado.alvos = vazios
  if (vazios.length !== 2) return { erro: `esperava 2 mp4 de 0 byte, achei ${vazios.length}` }

  // A isca que o wrapper plantou na biblioteca real. Misturar ela com os dois
  // quebrados testa o caminho de FALHA PARCIAL (§7 "relata por item"): um lote
  // que sai pela metade tem que apagar so o que saiu e nao tocar no resto.
  // busca no INDICE, nao na aba: a isca e .png e o grid esta na aba video
  const isca = mediaIndex
    .getAll()
    .map((i) => i.name)
    .find((n) => n.startsWith('isca-real-'))
  resultado.isca = isca || null

  const alvos = isca ? [isca, ...vazios] : vazios

  const arquivosAntes = fs.readdirSync(LIB).length
  const indiceAntes = chaves().length
  resultado.antes = { arquivos: arquivosAntes, indice: indiceAntes }

  // 2 itens => confirmaria. Espiona pra responder "Apagar" sem folha nativa.
  const { dialog } = require('@electron/remote')
  const original = dialog.showMessageBox
  let confirmou = null
  dialog.showMessageBox = async (_w, o) => {
    confirmou = o.message
    return { response: 0 }
  }

  sel.clear()
  sel.selectAll(alvos)
  await espera(200)
  resultado.selecionou = {
    conta: sel.count(),
    barra: (document.querySelector('.selection-count') || {}).textContent,
  }

  await trash.deleteSelected()
  await espera(2500)

  const lote = trash.lastBatch() || []
  const existe = (n) => fs.existsSync(path.join(LIB, n))
  resultado.apagou = {
    confirmacaoPedida: confirmou,
    // quantos SAIRAM de fato — nada de assercao vazia sobre lista vazia
    loteApagado: lote.length,
    nomesApagados: lote.map((i) => i.name),
    // a isca sai; os dois quebrados o Google Drive recusa (ver relatorio)
    iscaSaiu: isca ? !existe(isca) : null,
    quebradosFicaram: vazios.every(existe),
    // as TRES coisas de §7, medidas SO no que saiu
    sairamDaPasta: lote.every((i) => !existe(i.name)),
    sairamDoIndice: lote.every((i) => !chaves().includes(i.name)),
    thumbsApagados: lote.every(
      (i) => !fs.existsSync(require('./lib/thumbs').thumbPath(i.name)),
    ),
    naLixeira: lote.length > 0 && lote.every((i) => i.trashedPath && fs.existsSync(i.trashedPath)),
    // o que FALHOU nao pode ter sido tirado do indice
    quebradosSeguemNoIndice: vazios.every((n) => chaves().includes(n)),
    lixeiraUsada: lote[0] ? path.dirname(lote[0].trashedPath || '') : null,
    arquivos: fs.readdirSync(LIB).length,
    indice: chaves().length,
    sumiramDoGrid: lote.every((i) => !document.querySelector(`.library-item[data-name="${i.name}"]`)),
    // §7 falha e avisa: a barra mostra o motivo, porque o statusText esta escondido
    avisoNaBarra: (document.querySelector('.selection-count') || {}).textContent,
    status: (document.querySelector('#statusText')||{}).textContent,
  }

  // ---- desfaz: a biblioteca tem que voltar ao numero exato ----
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))
  await espera(2500)

  resultado.desfez = {
    arquivos: fs.readdirSync(LIB).length,
    indice: chaves().length,
    voltouTudo: lote.every((i) => existe(i.name) && chaves().includes(i.name)),
    fechouOnumero:
      fs.readdirSync(LIB).length === arquivosAntes && chaves().length === indiceAntes,
    status: (document.querySelector('#statusText')||{}).textContent,
  }

  dialog.showMessageBox = original
  sel.clear()
  return resultado
})()
