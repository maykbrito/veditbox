(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  document.querySelector('#menu li[data-tab=download]').click()
  await wait(3000)

  const box = document.querySelector('.library-item .select-box')
  box.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await wait(200)

  const barra = document.querySelector('.selection-bar')
  const apagar = [...(barra ? barra.querySelectorAll('button') : [])]
    .find((b) => b.textContent.trim() === 'Apagar')

  const regiao = (el) => getComputedStyle(el).getPropertyValue('-webkit-app-region').trim()

  return {
    barraExiste: !!barra,
    botaoApagarExiste: !!apagar,
    botaoDesabilitadoNoDom: apagar ? apagar.disabled : null,
    regiaoTopBar: regiao(document.querySelector('#topBar')),
    regiaoBarraSelecao: barra ? regiao(barra) : null,
    // ESTE e o campo que importa: 'drag' faz o macOS engolir o clique do mouse
    regiaoBotaoApagar: apagar ? regiao(apagar) : null,
    CLICAVEL_POR_MOUSE_REAL: apagar ? regiao(apagar) === 'no-drag' : false,
  }
})()
