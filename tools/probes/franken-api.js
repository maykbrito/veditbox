// Probe de reconhecimento: qual e a API REAL dos componentes do Franken que a
// Fase 3 vai usar? Nao adianta escrever contra a documentacao — o que vale e o
// que esta registrado no customElements deste bundle vendorizado.
//   VEDITBOX_PROBE=franken-api yarn start
;(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  const resultado = {}

  const registrados = {}
  for (const tag of [
    'uk-command',
    'uk-input-tag',
    'uk-offcanvas',
    'uk-drop',
    'uk-icon',
  ]) {
    registrados[tag] = !!customElements.get(tag)
  }
  resultado.registrados = registrados

  // uk-input-tag: preciso saber COMO se le e se escreve o valor, e o que ele
  // renderiza. Se nao der pra ler as tags de volta, o sheet nao pode usa-lo.
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;bottom:0;left:0;width:300px'
  host.innerHTML = `<uk-input-tag name="tags" state="reels,gato"></uk-input-tag>`
  document.body.appendChild(host)
  await espera(600)

  const it = host.querySelector('uk-input-tag')
  resultado.inputTag = {
    existe: !!it,
    temShadow: !!(it && it.shadowRoot),
    // as props do prototype revelam a API sem eu precisar adivinhar
    props: it
      ? Object.getOwnPropertyNames(Object.getPrototypeOf(it))
          .filter((p) => !p.startsWith('_'))
          .sort()
      : [],
    atributos: it ? Array.from(it.attributes).map((a) => a.name) : [],
    // e daqui que sai a tag digitada: existe input de verdade dentro?
    inputsInternos: it
      ? Array.from((it.shadowRoot || it).querySelectorAll('input')).map((i) => ({
          type: i.type,
          name: i.name,
          value: i.value,
        }))
      : [],
    // se o componente publica hidden inputs, o form ja le sozinho
    htmlInterno: it ? (it.shadowRoot || it).innerHTML.slice(0, 500) : '',
    alturaRenderizada: it ? Math.round(it.getBoundingClientRect().height) : 0,
  }

  // uk-offcanvas idem: existe? precisa de JS pra abrir?
  const oc = document.createElement('div')
  oc.innerHTML = `<uk-offcanvas id="probeOc"><div class="uk-offcanvas-bar">oi</div></uk-offcanvas>`
  document.body.appendChild(oc)
  await espera(400)
  const o = oc.querySelector('uk-offcanvas')
  resultado.offcanvas = {
    existe: !!o,
    props: o
      ? Object.getOwnPropertyNames(Object.getPrototypeOf(o))
          .filter((p) => !p.startsWith('_'))
          .sort()
      : [],
    temUIkitGlobal: typeof window.UIkit !== 'undefined',
  }

  // A escala global e 10px (Fase 0, pra topBar caber em 36px). Preciso saber se
  // isso esmaga os componentes novos antes de desenhar em cima.
  const cs = getComputedStyle(document.documentElement)
  resultado.escala = {
    globalFontSize: cs.getPropertyValue('--uk-global-font-size').trim(),
    btnHeight: cs.getPropertyValue('--uk-btn-height').trim(),
    bodyFont: getComputedStyle(document.body).font,
  }

  host.remove()
  oc.remove()
  return resultado
})()
