(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  document.querySelector('#menu li[data-tab=download]').click()
  await wait(3000)

  document.querySelector('.library-item .select-box')
    .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await wait(250)

  const barra = document.querySelector('.selection-bar')
  const btn = [...barra.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Apagar')
  const cs = getComputedStyle(btn)

  const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  // alpha precisa ser MISTURADO com o fundo atras, senao a conta mente
  const alphaDe = (s) => { const m = s.match(/[\d.]+/g); return m && m.length > 3 ? Number(m[3]) : 1 }
  const misturar = (frente, atras) => {
    const a = alphaDe(frente), f = rgb(frente), t = rgb(atras)
    return f.map((c, i) => Math.round(c * a + t[i] * (1 - a)))
  }
  const razaoRGB = (x, y) => {
    const [p, q] = [lum(x), lum(y)].sort((m, n) => n - m)
    return +((p + 0.05) / (q + 0.05)).toFixed(2)
  }

  const raiz = getComputedStyle(document.documentElement)
  const fundoBarra = getComputedStyle(barra.parentElement).backgroundColor
  const fundoReal = misturar(cs.backgroundColor, fundoBarra)
  const contraste = razaoRGB(fundoReal, rgb(cs.color))
  return {
    fundoDeclarado: cs.backgroundColor,
    fundoRealAposMistura: `rgb(${fundoReal.join(', ')})`,
    texto: cs.color,
    contrasteReal: contraste,
    minimoWCAG_AA: 4.5,
    PASSA: contraste >= 4.5,
    tokenDestructive: raiz.getPropertyValue('--destructive').trim(),
    tokenDestructiveFg: raiz.getPropertyValue('--destructive-foreground').trim(),
    alphaAplicado: raiz.getPropertyValue('--destructive-alpha').trim() || '(nao definido)',
  }
})()
