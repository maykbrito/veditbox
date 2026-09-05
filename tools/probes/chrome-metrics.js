// Probe de chrome: medidas que o trafficLightPosition depende + estado do Franken.
// Rode: VEDITBOX_PROBE=chrome-metrics yarn start
;(() => {
  const alturaDe = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height)
  const larguraDe = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().width)
  const token = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
  const menu = document.querySelector('#menu')

  return {
    topBarHeight: alturaDe('#topBar'),
    menuWidth: larguraDe('#menu'),
    menuPaddingTop: Math.round(parseFloat(getComputedStyle(menu).paddingTop)),
    logoHeight: alturaDe('#menu h2'),
    tabHeight: alturaDe('#menu li'),
    helpBtnHeight: alturaDe('#helpBtn'),
    formAltura: alturaDe('#settingsForm'),
    checkboxLargura: Math.round(
      document.querySelector('#topBar input[type=checkbox]').getBoundingClientRect().width,
    ),
    bodyFont: getComputedStyle(document.body).font,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,

    uikitLoaded: typeof window.UIkit !== 'undefined',
    ukCommandDefined: !!customElements.get('uk-command'),
    ukInputTagDefined: !!customElements.get('uk-input-tag'),

    tokenBackground: token('--background'),
    tokenForeground: token('--foreground'),
    tokenPrimary: token('--primary'),
    tokenCard: token('--card'),
    tokenDestructive: token('--destructive'),

    // contrato de seletor com a Fase 1 (library.js / set-tab.js fazem '#menu li')
    tabsComDataTab: document.querySelectorAll('#menu li[data-tab]').length,
    tabAtiva: document.querySelector('#menu li.active')?.dataset.tab ?? null,

    // §9.1: o dialog de ajuda precisa ser alcancavel por id, nao por 'dialog'
    statusTextExiste: !!document.querySelector('#statusText'),
    helpDialogPorId: !!document.querySelector('#helpDialog'),
    dialogsNoDocumento: document.querySelectorAll('dialog').length,

    // §8.0: ninguem pode apagar o window.onkeydown do gravador de audio
    onkeydownVivo: typeof window.onkeydown === 'function',

    // trafficLightPosition que ESSAS medidas exigem.
    //   y = (altura da topBar - 12) / 2   |  x = (largura do menu - 52) / 2
    // 12px e a altura dos botoes do macOS; 52px a largura do grupo de tres.
    trafficLightEsperado: {
      x: Math.round((larguraDe('#menu') - 52) / 2),
      y: Math.round((alturaDe('#topBar') - 12) / 2),
    },
  }
})()
