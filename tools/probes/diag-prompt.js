(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  document.querySelector('#menu li[data-tab=download]').click()
  await wait(3000)

  const out = { promptExiste: typeof window.prompt }
  try { out.promptRetornou = JSON.stringify(window.prompt('teste')) }
  catch (e) { out.promptLancou = e.message }

  // o botao existe mesmo?
  document.querySelector('.library-item .select-box')
    .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await wait(250)
  const btns = [...document.querySelectorAll('.selection-bar button')].map((b) => b.textContent.trim())
  out.botoesNaBarra = btns
  out.temBotaoTag = btns.includes('Adicionar tag')

  const { addTagToMany } = require('../../src/renderer/lib/metadata-sheet')
  out.addTagToManyExiste = typeof addTagToMany
  return out
})()
