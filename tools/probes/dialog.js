// Probe do dialog de ajuda: abre pelo #helpBtn, mede, fecha pelo OK.
// Cobre a correcao do §9.1 (seletor por id) e o estilo vindo do Franken.
// Rode: VEDITBOX_PROBE=dialog yarn start
;(async () => {
  const dialog = document.querySelector('#helpDialog')
  const helpBtn = document.querySelector('#helpBtn')
  const closeBtn = document.querySelector('#helpDialog button')

  const abriuSozinho = dialog.open
  helpBtn.click()
  await new Promise((r) => setTimeout(r, 150))

  const cs = getComputedStyle(dialog)
  const csBtn = getComputedStyle(closeBtn)
  const caixa = dialog.getBoundingClientRect()
  const caixaBtn = closeBtn.getBoundingClientRect()
  const abriu = dialog.open

  closeBtn.click()
  await new Promise((r) => setTimeout(r, 150))

  return {
    abriuSozinho,
    abriu,
    fechou: !dialog.open,
    dialogBg: cs.backgroundColor,
    dialogColor: cs.color,
    dialogRadius: cs.borderRadius,
    dialogPadding: cs.padding,
    dialogLargura: Math.round(caixa.width),
    janelaLargura: window.innerWidth,
    btnBg: csBtn.backgroundColor,
    btnColor: csBtn.color,
    btnAltura: Math.round(caixaBtn.height),
    btnAlinhadoDireita: Math.round(caixaBtn.right) <= Math.round(caixa.right),

    // §9.1: simula o dialog do Cmd+K da Fase 3 aparecendo ANTES no DOM.
    // Com o seletor antigo ('dialog'), querySelector devolveria este intruso.
    seletorResistiuAoIntruso: (() => {
      const intruso = document.createElement('dialog')
      intruso.appendChild(document.createElement('button'))
      document.body.insertBefore(intruso, document.body.firstChild)
      const ok =
        document.querySelector('#helpDialog') === dialog &&
        document.querySelector('dialog') === intruso
      intruso.remove()
      return ok
    })(),
  }
})()
