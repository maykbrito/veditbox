// Terceiro reconhecimento, cirurgico: qual formato do atributo `state` faz o
// <uk-input-tag> nascer JA com tags? Sem isso ele nao serve pro sheet, cujo
// trabalho e justamente carregar as tags existentes pra editar.
// Nao concluo "quebrado" sem tentar os formatos plausiveis.
//   VEDITBOX_PROBE=franken-api3 yarn start
;(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))

  const tentar = async (rotulo, montarHtml) => {
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;bottom:0;left:0;width:320px;z-index:99'
    host.innerHTML = montarHtml()
    document.body.appendChild(host)
    await espera(600)
    const it = host.querySelector('uk-input-tag')
    const saida = {
      rotulo,
      $tags: it ? it.$tags : null,
      hidden: Array.from(host.querySelectorAll('input[type=hidden]')).map(
        (i) => i.value,
      ),
    }
    host.remove()
    return saida
  }

  const resultado = { tentativas: [] }

  resultado.tentativas.push(
    await tentar('csv', () => `<uk-input-tag name="tags" state="reels,gato"></uk-input-tag>`),
  )
  resultado.tentativas.push(
    await tentar(
      'json-array',
      () => `<uk-input-tag name="tags" state='["reels","gato"]'></uk-input-tag>`,
    ),
  )
  resultado.tentativas.push(
    await tentar(
      'value-attr',
      () => `<uk-input-tag name="tags" value="reels,gato"></uk-input-tag>`,
    ),
  )
  resultado.tentativas.push(
    await tentar(
      'slot-de-inputs-hidden',
      () =>
        `<uk-input-tag name="tags"><input type="hidden" name="tags[]" value="reels"><input type="hidden" name="tags[]" value="gato"></uk-input-tag>`,
    ),
  )

  // e a prop direto, antes do upgrade do custom element?
  const host = document.createElement('div')
  document.body.appendChild(host)
  const el = document.createElement('uk-input-tag')
  el.setAttribute('name', 'tags')
  el.$tags = ['reels', 'gato']
  host.appendChild(el)
  await espera(600)
  resultado.propAntesDoUpgrade = {
    $tags: el.$tags,
    hidden: Array.from(host.querySelectorAll('input[type=hidden]')).map((i) => i.value),
  }

  // ultima carta: setar $tags depois de montado e pedir render
  el.$tags = ['x', 'y']
  if (el.requestUpdate) el.requestUpdate()
  await espera(400)
  resultado.propDepoisDeMontado = {
    $tags: el.$tags,
    hidden: Array.from(host.querySelectorAll('input[type=hidden]')).map((i) => i.value),
  }
  host.remove()

  // Offcanvas via UIkit JS (o custom element nao existe, mas o componente sim)
  const oc = document.createElement('div')
  oc.id = 'probeOffcanvas'
  oc.innerHTML = `<div class="uk-offcanvas-bar"><p>conteudo</p></div>`
  document.body.appendChild(oc)
  let erroOffcanvas = null
  let abriu = false
  try {
    const comp = window.UIkit.offcanvas(oc, { flip: true, overlay: true })
    comp.show()
    await espera(600)
    abriu = oc.classList.contains('uk-open') || getComputedStyle(oc).display !== 'none'
    comp.$destroy(true)
  } catch (e) {
    erroOffcanvas = String(e.message)
  }
  resultado.offcanvasViaUIkitJs = { abriu, erroOffcanvas }

  return resultado
})()
