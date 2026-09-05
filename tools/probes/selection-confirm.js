// Probe da CONFIRMACAO destrutiva (§7/§9.1): 1 item nao confirma, 2+ confirma
// mostrando a contagem.
//
// LIMITE HONESTO DESTE PROBE: o showMessageBox e uma folha NATIVA do SO; nem
// executeJavaScript clica nela, e dirigi-la por AppleScript exige permissao de
// Acessibilidade (tentado, trava esperando o prompt de TCC). Entao aqui o
// dialog.showMessageBox e espionado no ponto de chamada: o probe verifica SE
// foi chamado, COM QUE texto e botoes, e o que acontece para cada resposta.
// O que ele NAO cobre e a renderizacao pelo SO — isso fica pra olho humano.
//
//   VEDITBOX_DIR=/tmp/veditbox-probe VEDITBOX_PROBE=selection-confirm yarn start
;(async () => {
  const fs = require('fs')
  const path = require('path')
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))

  const sel = require('./lib/selection/selection')
  const adapter = require('./lib/selection/store-adapter')
  const trash = require('./lib/selection/trash')

  const LIB = adapter.libDir()
  if (!LIB.includes('probe')) return { erro: `RECUSADO: ${LIB} nao e descartavel` }

  // trash.js faz `const { dialog } = require('@electron/remote')` e chama
  // dialog.showMessageBox(...) — acesso de propriedade na hora da chamada,
  // entao trocar a propriedade aqui intercepta de verdade.
  const { dialog } = require('@electron/remote')
  const original = dialog.showMessageBox
  const chamadas = []
  let respostaFalsa = 1

  dialog.showMessageBox = async (_win, opcoes) => {
    chamadas.push(opcoes)
    return { response: respostaFalsa }
  }

  const resultado = { libDir: LIB }

  document.querySelector('#menu li[data-tab="download"]').click()
  await espera(900)

  const nomes = adapter.selectableNames()
  resultado.disponiveis = nomes.length
  if (nomes.length < 4) return { erro: `so ${nomes.length} iscas, preciso de 4` }

  // ---- 1 item: NAO confirma (§7) ----
  chamadas.length = 0
  sel.clear()
  sel.toggle(nomes[0])
  await espera(120)
  await trash.deleteSelected()
  await espera(1200)

  resultado.umItem = {
    chamouConfirmacao: chamadas.length > 0,
    esperadoChamar: false,
    apagouDireto: !fs.existsSync(path.join(LIB, nomes[0])),
  }

  // desfaz pra devolver a isca
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))
  await espera(1500)
  resultado.umItem.undoDevolveu = fs.existsSync(path.join(LIB, nomes[0]))

  // ---- 2 itens + Cancelar (response 1) ----
  chamadas.length = 0
  respostaFalsa = 1
  sel.clear()
  sel.selectAll([nomes[1], nomes[2]])
  await espera(150)
  await trash.deleteSelected()
  await espera(800)

  const op = chamadas[0] || {}
  resultado.doisItens_cancelar = {
    chamouConfirmacao: chamadas.length === 1,
    message: op.message,
    detail: op.detail,
    botoes: op.buttons,
    tipo: op.type,
    // §7: a contagem na tela e o que faz o usuario parar
    mostrouContagem: /\b2\b/.test(String(op.message)),
    cancelIdCerto: op.cancelId === 1 && op.defaultId === 0,
    // Cancelar nao apaga nada e preserva a selecao
    nadaApagado:
      fs.existsSync(path.join(LIB, nomes[1])) && fs.existsSync(path.join(LIB, nomes[2])),
    selecaoIntacta: sel.count() === 2,
  }

  // ---- 2 itens + Apagar (response 0) ----
  chamadas.length = 0
  respostaFalsa = 0
  await trash.deleteSelected()
  await espera(1800)

  resultado.doisItens_apagar = {
    chamouConfirmacao: chamadas.length === 1,
    ambosSairam:
      !fs.existsSync(path.join(LIB, nomes[1])) && !fs.existsSync(path.join(LIB, nomes[2])),
    selecaoLimpou: sel.count() === 0,
    loteTem2: (trash.lastBatch() || []).length === 2,
    status: document.querySelector('#statusText').textContent,
  }

  // ---- undo do lote de 2, de uma vez ----
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))
  await espera(2000)
  resultado.undoDoLoteDe2 = {
    ambosVoltaram:
      fs.existsSync(path.join(LIB, nomes[1])) && fs.existsSync(path.join(LIB, nomes[2])),
    status: document.querySelector('#statusText').textContent,
  }

  // ---- a contagem cresce com o lote: 4 itens dizem "4 arquivos" ----
  chamadas.length = 0
  respostaFalsa = 1
  sel.clear()
  sel.selectAll(adapter.selectableNames().slice(0, 4))
  await espera(150)
  await trash.deleteSelected()
  await espera(600)
  resultado.quatroItens = {
    message: (chamadas[0] || {}).message,
    mostrou4: /\b4\b/.test(String((chamadas[0] || {}).message)),
    textoDaBarra: document.querySelector('.selection-count').textContent,
  }

  dialog.showMessageBox = original
  sel.clear()
  resultado.arquivosNoFim = fs.readdirSync(LIB).length
  return resultado
})()
