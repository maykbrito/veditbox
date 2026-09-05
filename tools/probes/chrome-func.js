// Probe funcional do chrome: clica em tudo que a Fase 0 mexeu e confere que
// os comportamentos que ja existiam continuam de pe.
// Rode: VEDITBOX_PROBE=chrome-func yarn start
;(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  const resultado = {}

  // 1. cada aba responde ao clique, marca .active e renderiza a biblioteca
  const abas = []
  for (const li of document.querySelectorAll('#menu li[data-tab]')) {
    li.click()
    await espera(400)
    abas.push({
      tab: li.dataset.tab,
      ficouAtiva: li.classList.contains('active'),
      // uma aba so pode ter um .active por vez
      ativasNoMenu: document.querySelectorAll('#menu li.active').length,
      renderizou: !!document.querySelector('.library-grid, .library-empty'),
      status: document.querySelector('#statusText').textContent.slice(0, 40),
    })
  }
  resultado.abas = abas

  // 2. logo volta pra home: limpa a area e desmarca todas as abas
  document.querySelector('#menu h2').click()
  await espera(300)
  resultado.home = {
    areaVazia: document.querySelector('#mainArea').children.length === 0,
    nenhumaAbaAtiva: document.querySelectorAll('#menu li.active').length === 0,
  }

  // 3. preview abre e o botao voltar retorna pra lista
  document.querySelector('#menu li[data-tab="image"]').click()
  await espera(400)
  const primeiro = document.querySelector('.library-item')
  primeiro.click()
  await espera(400)
  const abriuPreview = !!document.querySelector('.library-preview')
  document.querySelector('.library-back')?.click()
  await espera(400)
  resultado.preview = {
    abriuPreview,
    voltouPraLista: !!document.querySelector('.library-grid'),
  }

  // 4. checkbox de always-on-top: o uk-checkbox nao pode ter quebrado o form
  const cb = document.querySelector('#settingsForm input[name=alwaysOnTop]')
  const antes = cb.checked
  cb.click()
  await espera(150)
  const marcou = cb.checked
  cb.click()
  await espera(150)
  resultado.checkbox = {
    comecouDesmarcado: antes === false,
    marcouComClique: marcou === true,
    desmarcouDeVolta: cb.checked === false,
    // control-window.js le settingsForm.alwaysOnTop — o name tem que sobreviver
    acessivelPeloName: !!document.querySelector('#settingsForm').alwaysOnTop,
  }

  // 5. dialog de ajuda pelo botao real
  document.querySelector('#helpBtn').click()
  await espera(200)
  const dialogAberto = document.querySelector('#helpDialog').open
  document.querySelector('#helpDialog button').click()
  await espera(200)
  resultado.ajuda = {
    abriuPeloBotao: dialogAberto,
    fechouPeloOk: !document.querySelector('#helpDialog').open,
  }

  // 6. §8.0: o handler de teclado do gravador de audio continua vivo.
  // A Fase 3 trocou `window.onkeydown = ...` por addEventListener (a atribuicao
  // era o alcapao do §8.0), entao onkeydown agora e null DE PROPOSITO. O que
  // prova que o handler vive e a tecla funcionar — ver probe `focus-guard`.
  const fs = require('fs')
  const { CONSTANTS } = require('../utils/constants') // resolve a partir de src/renderer/
  const pasta = CONSTANTS.destDownloadFolder
  const listar = () => new Set(fs.readdirSync(pasta))
  const antesDosArquivos = listar()
  const statusAntes = document.querySelector('#statusText').textContent
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }))
  await espera(900)
  resultado.teclado = {
    onkeydownEhAtribuicao: typeof window.onkeydown === 'function',
    teclaRGravou: document
      .querySelector('#statusText')
      .textContent.includes('Recording audio'),
    statusAntes: statusAntes.slice(0, 30),
  }
  window.activeThing.dispose()
  // a gravacao escreve o .wav no disco; o probe nao pode deixar lixo na
  // biblioteca do usuario (§ probes que escrevem, tools/probes/README.md)
  await espera(1200)
  resultado.teclado.wavsRemovidos = [...listar()]
    .filter((f) => !antesDosArquivos.has(f))
    .map((f) => {
      fs.unlinkSync(pasta + '/' + f)
      return f
    })


  return resultado
})()
