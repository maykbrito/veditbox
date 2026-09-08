(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const mediaIndex = require('../../src/renderer/lib/media-index')
  const sel = require('../../src/renderer/lib/selection/selection')

  document.querySelector('#menu li[data-tab=image]').click()
  await wait(3000)

  // seleciona 3
  const boxes = [...document.querySelectorAll('.library-item .select-box')].slice(0, 3)
  boxes.forEach((b) => b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  await wait(300)
  const nomes = sel.names()

  const antes = nomes.map((n) => (mediaIndex.get(n).tags || []).length)

  // clica "Adicionar tag"
  const btn = [...document.querySelectorAll('.selection-bar button')]
    .find((b) => b.textContent.trim() === 'Adicionar tag')
  btn.click()
  await wait(400)

  const dlg = document.querySelector('#promptDialog')
  // getBoundingClientRect da o valor USADO; getComputedStyle devolvia "auto"
  const r = dlg ? dlg.getBoundingClientRect() : null
  const larguraJanela = document.documentElement.clientWidth

  const abertoNaMedicao = dlg.open
  const input = dlg.querySelector('.prompt-input')
  input.value = 'probe-tag-multi'
  dlg.querySelector('button[value=ok]').click()
  await wait(600)

  const depois = nomes.map((n) => (mediaIndex.get(n).tags || []))
  const todosGanharam = depois.every((t) => t.includes('probe-tag-multi'))

  // limpeza: tira a tag que o probe criou
  nomes.forEach((n) => {
    const t = (mediaIndex.get(n).tags || []).filter((x) => x !== 'probe-tag-multi')
    mediaIndex.setEntry(n, { tags: t })
  })
  mediaIndex.flush()

  return {
    selecionados: nomes.length,
    dialogAbriu: !!dlg,
    // §10.9: `dialog { width: 80% }` sem layer nasceria com 80% da janela
    larguraDialog: r ? Math.round(r.width) : null,
    alturaDialog: r ? Math.round(r.height) : null,
    dialogAbertoNaMedicao: abertoNaMedicao,
    larguraJanela,
    NAO_PEGOU_OS_80_PORCENTO: r ? r.width < larguraJanela * 0.7 : null,
    tagsAntes: antes,
    tagsDepois: depois,
    TODOS_GANHARAM_A_TAG: todosGanharam,
    limpo: nomes.every((n) => !(mediaIndex.get(n).tags || []).includes('probe-tag-multi')),
  }
})()
