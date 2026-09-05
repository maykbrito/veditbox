// Probe de fronteira: prova que o grid (territorio da Fase 1) nao mudou.
// Rode: VEDITBOX_PROBE=grid-snapshot yarn start
;(async () => {
  document.querySelector('#menu li[data-tab="download"]').click()
  await new Promise((r) => setTimeout(r, 600))

  const grid = document.querySelector('.library-grid')
  if (!grid) return { erro: 'grid nao renderizou — a pasta ~/veditbox esta vazia?' }

  const item = grid.querySelector('.library-item')
  const csGrid = getComputedStyle(grid)
  const csItem = getComputedStyle(item)
  const caixa = item.getBoundingClientRect()

  return {
    itens: grid.children.length,
    gridColunas: csGrid.gridTemplateColumns,
    gridGap: csGrid.gap,
    gridPadding: csGrid.padding,
    itemLargura: Math.round(caixa.width),
    itemAltura: Math.round(caixa.height),
    itemQuadrado: Math.abs(caixa.width - caixa.height) <= 1,
    itemBg: csItem.backgroundColor,
    itemRadius: csItem.borderRadius,
    itemCursor: csItem.cursor,
    itemOverflow: csItem.overflow,
    itemDraggable: item.draggable,
    tagsDeThumb: [...grid.children].map((c) => c.firstElementChild?.tagName).slice(0, 8),
    // §10.4 mandou este campo e ele nao tinha chegado; a Fase 3 acrescentou ao
    // pendurar as pills de tag nas celulas. E o invariante do §6: o grid nao
    // pode ter decoder de video em repouso. Esperado 0 — se subir, alguem
    // reintroduziu <video> por celula, que era a causa real da lentidao.
    videosNoDom: document.querySelectorAll('.library-grid video').length,
    statusText: document.querySelector('#statusText').textContent,
  }
})()
