// Probe da guarda de foco (design doc §8.1). Roda:
//   VEDITBOX_PROBE=focus-guard yarn start
//
// Mede o app RODANDO, porque o script node NAO prova nada sobre <dialog>: ja
// foi verificado que keydown num input dentro de <dialog open> SOBE ate o
// window. O que importa aqui e o par de casos:
//
//   caso positivo  — digitar "reels" num input NAO pode gravar audio
//   CONTROLE NEGATIVO — a mesma tecla no <body> DEVE gravar
//
// Sem o controle negativo o teste passaria mesmo se o gravador estivesse morto.
;(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  const status = () => document.querySelector('#statusText').textContent
  const gravando = () =>
    status().includes('Recording audio') || !!window.activeThing.isRecording

  const teclar = (alvo, key) =>
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

  const resultado = {}

// O controle negativo GRAVA DE VERDADE, e o gravador escreve o .wav no disco
// assim que a gravacao termina (nao so ao arrastar). Sem esta limpeza, cada
// rodada do probe deixa um arquivo de ~30KB na biblioteca do usuario — foi o
// que aconteceu tres vezes antes de alguem reparar na contagem do grid.
const fs = require('fs')
const { CONSTANTS } = require('../utils/constants') // resolve a partir de src/renderer/
const pasta = CONSTANTS.destDownloadFolder
const listar = () => new Set(fs.readdirSync(pasta))
  const antesDosArquivos = listar()

  // ---- caso positivo: input dentro de <dialog open> ----
  const d = document.createElement('dialog')
  const i = document.createElement('input')
  d.appendChild(i)
  document.body.appendChild(d)
  d.showModal()
  i.focus()

  resultado.gravandoAntes = gravando()
  for (const k of ['r', 'e', 'e', 'l', 's']) {
    i.value += k
    teclar(i, k)
  }
  await espera(900)

  resultado.digitou = i.value
  resultado.gravandoDepoisDeDigitar = gravando()
  resultado.statusDepoisDeDigitar = status().slice(0, 40)
  // §8.1 e por causa deste: o keydown do input realmente CHEGA no window
  resultado.eventoSobeAteWindow = await (async () => {
    let subiu = false
    const espia = () => (subiu = true)
    window.addEventListener('keydown', espia)
    teclar(i, 'r')
    window.removeEventListener('keydown', espia)
    return subiu
  })()

  d.close()
  d.remove()
  await espera(200)

  // ---- CONTROLE NEGATIVO: a mesma tecla no body DEVE gravar ----
  teclar(document.body, 'r')
  await espera(1200)
  resultado.controleNegativoGravou = gravando()
  resultado.statusControleNegativo = status().slice(0, 40)

  // encerra a gravacao e APAGA o wav que ela gravou
  if (window.activeThing.dispose) window.activeThing.dispose()
  await espera(1200)
  resultado.wavsRemovidos = [...listar()]
    .filter((f) => !antesDosArquivos.has(f))
    .map((f) => {
      fs.unlinkSync(pasta + '/' + f)
      return f
    })

  // §8.0: o handler tem que existir como LISTENER, nunca como atribuicao
  resultado.onkeydownEhAtribuicao = typeof window.onkeydown === 'function'

  resultado.PASSOU =
    resultado.gravandoAntes === false &&
    resultado.digitou === 'reels' &&
    resultado.gravandoDepoisDeDigitar === false &&
    resultado.eventoSobeAteWindow === true &&
    resultado.controleNegativoGravou === true &&
    resultado.onkeydownEhAtribuicao === false &&
    // o probe nao pode sujar a biblioteca do usuario
    resultado.wavsRemovidos.length === 1

  return resultado
})()
