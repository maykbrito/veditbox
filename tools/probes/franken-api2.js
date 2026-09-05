// Segundo reconhecimento, mais fundo nos dois pontos que decidem o desenho do
// sheet e da palette:
//   1. da pra LER as tags de volta de um <uk-input-tag>? (senao ele nao serve)
//   2. o Offcanvas existe em algum lugar deste bundle? (nao esta no customElements)
//   VEDITBOX_PROBE=franken-api2 yarn start
;(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  const resultado = {}

  // ---- 1. uk-input-tag: ida e volta ----
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;bottom:0;left:0;width:320px;z-index:99'
  host.innerHTML = `<uk-input-tag name="tags" state="reels,gato"></uk-input-tag>`
  document.body.appendChild(host)
  await espera(700)

  const it = host.querySelector('uk-input-tag')
  const hidden = () =>
    Array.from(host.querySelectorAll('input[type=hidden]')).map((i) => [
      i.name,
      i.value,
    ])

  resultado.leituraInicial = {
    // $tags e a prop interna do Lit; hidden inputs sao o que um <form> leria
    $tags: it.$tags,
    $value: it.$value,
    hiddenInputs: hidden(),
    chipsVisiveis: host.querySelectorAll('[data-host-inner] > *').length,
    htmlDepoisDoRender: host.innerHTML.replace(/<!--[^>]*-->/g, '').slice(0, 400),
  }

  // escrever programaticamente: e assim que o sheet carrega a entrada atual
  let erroAddTag = null
  try {
    it.addTag('novaTag')
  } catch (e) {
    erroAddTag = String(e.message)
  }
  await espera(400)
  resultado.depoisDeAddTag = { $tags: it.$tags, hiddenInputs: hidden(), erroAddTag }

  // trocar o `state` recarrega? (sheet reabre com OUTRO arquivo)
  it.setAttribute('state', 'outra,coisa')
  await espera(400)
  resultado.depoisDeTrocarState = { $tags: it.$tags, hiddenInputs: hidden() }

  // digitar de verdade no input interno + Enter
  const inp = host.querySelector('input[type=text]')
  resultado.inputInternoEhLightDom = !!inp
  if (inp) {
    inp.value = 'digitada'
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
    )
    await espera(400)
    resultado.depoisDeDigitar = { $tags: it.$tags, hiddenInputs: hidden() }
    // §8.1: o keydown do input interno sobe ate o window? se sim, a guarda
    // precisa pega-lo — e o alvo sera INPUT (light dom), nao o host.
    let alvo = null
    const espia = (e) => (alvo = e.target.tagName)
    window.addEventListener('keydown', espia)
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }))
    window.removeEventListener('keydown', espia)
    resultado.alvoQueChegaNoWindow = alvo
  }

  // ---- 2. Offcanvas existe? ----
  resultado.offcanvas = {
    customElement: !!customElements.get('uk-offcanvas'),
    uikitTemOffcanvas: !!(window.UIkit && window.UIkit.offcanvas),
    uikitComponentes: window.UIkit
      ? Object.keys(window.UIkit)
          .filter((k) => typeof window.UIkit[k] === 'function')
          .sort()
      : [],
    cssTemClasseBar: (() => {
      // se a classe existe no CSS, da pra usar o visual sem o JS do componente
      const d = document.createElement('div')
      d.className = 'uk-offcanvas-bar'
      document.body.appendChild(d)
      const w = getComputedStyle(d).width
      const pos = getComputedStyle(d).position
      d.remove()
      return { width: w, position: pos }
    })(),
  }

  host.remove()
  return resultado
})()
