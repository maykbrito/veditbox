// Probe de selecao — NAO DESTRUTIVO. So seleciona e mede; nunca apaga.
// Rode: VEDITBOX_PROBE=selection-ui yarn start
//
// Mede as duas coisas que o contrato manda medir e nao supor:
//  §10.9 os computed styles do checkbox, campo a campo, porque
//        `.library-item > *` do grid.css forca absolute/inset/100%/none em todo
//        filho de celula e a quebra e SILENCIOSA;
//  §10.5 que Cmd+A pega o INDICE INTEIRO da aba (~90), nao so as celulas
//        montadas (~60).
;(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  const resultado = {}

  const sel = require('./lib/selection/selection')
  const adapter = require('./lib/selection/store-adapter')
  const mediaIndex = require('./lib/media-index')

  document.querySelector('#menu li[data-tab="download"]').click()
  await espera(900)

  const grid = document.querySelector('.library-grid')
  if (!grid) return { erro: 'grid nao renderizou — ~/veditbox esta vazia?' }

  // ---- §10.9: o checkbox sobreviveu a `.library-item > *`? ----
  const celula = grid.querySelector('.library-item')
  const box = celula.querySelector('.select-box')
  if (!box) return { erro: 'cellHooks nao criou o checkbox' }

  const cs = getComputedStyle(box)
  const caixaBox = box.getBoundingClientRect()
  const caixaCelula = celula.getBoundingClientRect()

  resultado.checkbox = {
    // os 5 campos que `.library-item > *` forca, desfeitos campo a campo
    position: cs.position,
    pointerEvents: cs.pointerEvents, // TEM que ser 'auto', senao nao recebe clique
    width: cs.width, // NAO pode ser a largura da celula
    height: cs.height,
    top: cs.top,
    left: cs.left,
    right: cs.right,
    bottom: cs.bottom,
    zIndex: cs.zIndex,
    // o teste que importa: ocupa um cantinho, nao a celula inteira
    ocupaCelulaInteira: Math.round(caixaBox.width) >= Math.round(caixaCelula.width) - 2,
    larguraPx: Math.round(caixaBox.width),
    alturaPx: Math.round(caixaBox.height),
    celulaPx: Math.round(caixaCelula.width),
    // canto onde ficamos, pra Fase 3 nao colidir com as pills do rodape
    cantoRelativo: {
      x: Math.round(caixaBox.left - caixaCelula.left),
      y: Math.round(caixaBox.top - caixaCelula.top),
    },
    // e o elemento que o mouse realmente acerta naquele ponto?
    alvoDoPonto: (() => {
      const el = document.elementFromPoint(caixaBox.left + 4, caixaBox.top + 4)
      return el ? el.className : null
    })(),
  }

  resultado.todasCelulasTemCheckbox =
    grid.querySelectorAll('.library-item').length ===
    grid.querySelectorAll('.library-item > .select-box').length

  // ---- §10.5: a armadilha do Cmd+A, com numero ----
  const celulasNoDom = grid.querySelectorAll('.library-item').length
  const entradasNoIndice = mediaIndex.getAll().length
  const selecionaveis = adapter.selectableNames().length

  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true }))
  await espera(300)

  resultado.cmdA = {
    celulasNoDom,
    entradasNoIndice,
    selecionaveis,
    selecionadosAposCmdA: sel.count(),
    // O invariante: Cmd+A pega a LISTA, nao o DOM.
    pegouAListaInteira: sel.count() === selecionaveis,
    naoPegouSoOdom: sel.count() > celulasNoDom,
    // celulas pintadas so podem ser as montadas
    pintadasNoDom: grid.querySelectorAll('.library-item.selected').length,
    textoDaBarra: (document.querySelector('.selection-count') || {}).textContent,
    bodySelecting: document.body.classList.contains('selecting'),
  }

  // ---- shift+clique estende sobre a ordem exibida ----
  sel.clear()
  await espera(100)
  const celulas = [...grid.querySelectorAll('.library-item')]
  celulas[1].querySelector('.select-box').click()
  await espera(120)
  const aposCheckbox = sel.count()
  celulas[4].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
  await espera(120)
  const aposShift = sel.count()
  celulas[3].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
  await espera(120)

  resultado.cliques = {
    checkboxSelecionou: aposCheckbox === 1,
    shiftEstendeu: aposShift === 4,
    shiftEncolheu: sel.count() === 3,
    // §7: clique no corpo COM selecao ativa alterna, nao abre preview
    naoAbriuPreview: !document.querySelector('.library-preview'),
  }

  // clique simples SEM selecao ativa continua abrindo o preview (§7)
  sel.clear()
  await espera(150)
  document.querySelector('.library-item').click()
  await espera(500)
  resultado.previewAindaAbre = !!document.querySelector('.library-preview')
  document.querySelector('.library-back')?.click()
  await espera(400)

  // ---- Esc limpa e a topBar volta inteira ----
  sel.selectAll(adapter.selectableNames())
  await espera(150)
  const barraApareceu = !!document.querySelector('.selection-bar')
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await espera(200)

  resultado.topBar = {
    barraApareceu,
    escLimpou: sel.count() === 0,
    settingsFormVoltou: !!document.querySelector('#settingsForm'),
    statusTextVoltou: !!document.querySelector('#statusText'),
    // control-window.js le settingsForm.alwaysOnTop pelo name
    checkboxAcessivelPeloName: !!document.querySelector('#settingsForm').alwaysOnTop,
    filhosDaTopBar: document.querySelector('#topBar').children.length,
  }

  // 3 ciclos selecionar->cancelar nao podem acumular elementos na topBar
  for (let i = 0; i < 3; i++) {
    sel.toggle(adapter.selectableNames()[0])
    await espera(60)
    sel.clear()
    await espera(60)
  }
  resultado.topBar.filhosApos3Ciclos = document.querySelector('#topBar').children.length

  // §8.0: o handler do gravador de audio continua sendo uma atribuicao viva —
  // nao trocamos por addEventListener nem apagamos.
  resultado.teclado = {
    onkeydownEhAtribuicao: typeof window.onkeydown === 'function',
  }

  // higiene: este probe nao apagou nada
  resultado.indiceIntacto = mediaIndex.getAll().length === entradasNoIndice

  return resultado
})()
