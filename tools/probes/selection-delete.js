// Probe DESTRUTIVO de delete + undo. Roda numa pasta descartavel, nunca na
// biblioteca real:
//
//   VEDITBOX_DIR=/tmp/veditbox-probe VEDITBOX_PROBE=selection-delete yarn start
//
// O wrapper scripts/check-selection-flow.sh cria a pasta, popula com iscas e
// confere que a biblioteca real ficou intacta. Rode por ele, nao na mao.
//
// Nao passa pela confirmacao nativa (showMessageBox nao da pra clicar daqui);
// o caminho de 1 item nao confirma, entao o probe apaga de 1 em 1 e o de 2+
// fica pro teste manual. Ver relatorio.
;(async () => {
  const fs = require('fs')
  const path = require('path')
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))

  const sel = require('./lib/selection/selection')
  const adapter = require('./lib/selection/store-adapter')
  const trash = require('./lib/selection/trash')
  const mediaIndex = require('./lib/media-index')
  const thumbs = require('./lib/thumbs')

  const LIB = adapter.libDir()
  const INDEX = path.join(LIB, '.veditbox', 'index.json')
  const resultado = { libDir: LIB }

  if (!LIB.includes('probe')) {
    return { erro: `RECUSADO: ${LIB} nao parece pasta descartavel` }
  }

  const lerIndice = () => {
    try {
      const cru = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
      return Object.keys(cru).filter((k) => k !== 'arquivadas')
    } catch (erro) {
      return []
    }
  }

  document.querySelector('#menu li[data-tab="download"]').click()
  await espera(900)

  const antes = adapter.selectableNames()
  resultado.antes = { arquivos: fs.readdirSync(LIB).length, indice: antes.length }

  // garante thumbs gerados pros alvos, pra poder provar que sao apagados
  const alvos = antes.slice(0, 2)
  await Promise.all(alvos.map((n) => thumbs.getThumb(mediaIndex.get(n))))
  await espera(400)
  resultado.thumbsAntes = alvos.map((n) => fs.existsSync(thumbs.thumbPath(n)))

  // ---- apaga 1 (sem confirmacao, §7) ----
  sel.clear()
  sel.toggle(alvos[0])
  await espera(120)
  await trash.deleteSelected()
  await espera(1200)

  const loteUm = trash.lastBatch()
  resultado.apagouUm = {
    saiuDaPasta: !fs.existsSync(path.join(LIB, alvos[0])),
    saiuDoIndice: !lerIndice().includes(alvos[0]),
    thumbApagado: !fs.existsSync(thumbs.thumbPath(alvos[0])),
    // as TRES coisas de §7, medidas no disco
    tresCoisasFeitas: false,
    selecaoLimpou: sel.count() === 0,
    sumiuDoGrid: !document.querySelector(`.library-item[data-name="${alvos[0]}"]`),
    foiPraLixeira: !!(loteUm && loteUm[0] && fs.existsSync(loteUm[0].trashedPath)),
    lixeiraUsada: loteUm && loteUm[0] ? path.dirname(loteUm[0].trashedPath || '') : null,
    status: document.querySelector('#statusText').textContent,
  }
  resultado.apagouUm.tresCoisasFeitas =
    resultado.apagouUm.saiuDaPasta &&
    resultado.apagouUm.saiuDoIndice &&
    resultado.apagouUm.thumbApagado

  // ---- Cmd+Z traz de volta, arquivo E entrada do indice ----
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))
  await espera(1500)

  resultado.undo = {
    voltouPraPasta: fs.existsSync(path.join(LIB, alvos[0])),
    voltouPraIndice: lerIndice().includes(alvos[0]),
    voltouPraGrid: !!document.querySelector(`.library-item[data-name="${alvos[0]}"]`),
    status: document.querySelector('#statusText').textContent,
  }

  // ---- pilha de UM nivel: segundo Cmd+Z nao faz nada ----
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))
  await espera(600)
  resultado.segundoUndo = {
    status: document.querySelector('#statusText').textContent,
    disseNadaPraDesfazer: /nada pra desfazer/i.test(
      document.querySelector('#statusText').textContent,
    ),
    loteConsumido: trash.lastBatch() === null,
  }

  // ---- Cmd+Delete dispara (§7) ----
  sel.clear()
  sel.toggle(alvos[1])
  await espera(120)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', metaKey: true }))
  await espera(1500)
  resultado.cmdDelete = {
    apagou: !fs.existsSync(path.join(LIB, alvos[1])),
    status: document.querySelector('#statusText').textContent,
  }

  // ---- undo best-effort: Lixeira esvaziada FALHA e AVISA, nao finge (§7) ----
  const lote2 = trash.lastBatch()
  if (lote2 && lote2[0] && lote2[0].trashedPath) {
    fs.rmSync(lote2[0].trashedPath, { force: true }) // simula esvaziar a Lixeira
  }
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))
  await espera(1500)

  const statusFalha = document.querySelector('#statusText').textContent
  resultado.undoFalhaHonesta = {
    status: statusFalha,
    avisouAFalha: /nao/i.test(statusFalha) && /0 restaurado/i.test(statusFalha),
    naoFingiuSucesso: !fs.existsSync(path.join(LIB, alvos[1])),
    corDeErro: document.querySelector('#statusText').style.color,
  }

  // ---- Cmd+Delete sem selecao nao faz nada ----
  sel.clear()
  await espera(100)
  const indiceAntesDoNada = lerIndice().length
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', metaKey: true }))
  await espera(700)
  resultado.deleteSemSelecao = { indiceInalterado: lerIndice().length === indiceAntesDoNada }

  resultado.depois = { arquivos: fs.readdirSync(LIB).length, indice: lerIndice().length }

  return resultado
})()
