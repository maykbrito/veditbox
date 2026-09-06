(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const sel = require('../../src/renderer/lib/selection/selection')

  document.querySelector('#menu li[data-tab=download]').click()
  await wait(3500)

  const boxDe = (i) => document.querySelectorAll('.library-item')[i].querySelector('.select-box')
  const clicar = (i) => boxDe(i).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

  clicar(0)
  await wait(60)
  const dep1 = { estado: sel.count(), visual: boxDe(0).checked }

  clicar(1)
  const visualSincrono = boxDe(1).checked
  await wait(60)
  const dep2 = { estado: sel.count(), visualItem1: boxDe(1).checked, visualItem0: boxDe(0).checked }

  clicar(2)
  await wait(60)
  const dep3 = { estado: sel.count(), visualItem1: boxDe(1).checked }

  return {
    aposClique1: dep1,
    visualSincronoNoClique2: visualSincrono,
    aposClique2: dep2,
    aposClique3_item1AgoraAparece: dep3,
    HIPOTESE_CONFIRMADA: dep2.estado === 2 && dep2.visualItem1 === false && dep3.visualItem1 === true,
  }
})()
