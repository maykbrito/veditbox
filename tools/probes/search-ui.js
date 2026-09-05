// Probe da UI da Fase 3: palette Cmd+K, pills de tag, filtro sem origem e sheet.
//   VEDITBOX_PROBE=search-ui yarn start
//
// Mede o app RODANDO (§12). Inclui os computed styles porque a armadilha do
// §10.6 e silenciosa: o index.css tem `dialog { width: 80% }` sem layer, que
// casa com o MEU dialog tambem. Um numero errado aqui e a unica forma de ver.
;(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  const status = () => document.querySelector('#statusText').textContent
  const r = {}

  const mediaIndex = require('./lib/media-index')

  // A biblioteca real desta maquina nasceu antes do indice, entao TODAS as 92
  // entradas foram adotadas como orfas e tem url vazia. Sem semear, a busca por
  // url/dominio nunca seria exercitada na UI. O probe desfaz isto no passo 8.
  const semente = mediaIndex.getAll()[0].name
  mediaIndex.setEntry(semente, {
    url: 'https://www.facebook.com/reel/892819649954687',
    titulo: 'semente do probe fase3',
  })
  mediaIndex.flush()

  const todas = mediaIndex.getAll()
  r.biblioteca = {
    total: todas.length,
    semOrigem: todas.filter((e) => !e.url).length,
    comTags: todas.filter((e) => e.tags.length).length,
  }

  // ---- 1. Cmd+K abre, foca e lista a biblioteca inteira ----
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
  )
  await espera(300)
  const d = document.querySelector('#searchDialog')
  const inp = document.querySelector('#searchInput')
  r.abriu = {
    existe: !!d,
    aberto: !!d && d.open,
    inputFocado: document.activeElement === inp,
    linhasIniciais: document.querySelectorAll('#searchResults li').length,
    // §8: escopo e a biblioteca INTEIRA, nao a aba (limitado a 50 por render)
    baterCom50OuTotal:
      document.querySelectorAll('#searchResults li').length ===
      Math.min(50, todas.length),
  }

  // ---- 2. §10.6: o `dialog { width: 80% }` do index.css nao pode ter vencido ----
  const cs = getComputedStyle(d)
  r.estiloDoDialog = {
    largura: cs.width, // 460px, NAO 80% da janela
    padding: cs.padding, // 0px — o dialog nao tem card body
    fonte: cs.font,
    naoPegouOs80Porcento: Math.abs(parseFloat(cs.width) - 460) < 1,
  }

  // ---- 3. digitar filtra e NAO grava audio (§8.1 de ponta a ponta na UI) ----
  inp.value = 'zzznaoexistenada'
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  // a mesma tecla que gravaria audio, digitada dentro da palette
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }))
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
  await espera(700)
  r.digitar = {
    consulta: 'zzznaoexistenada',
    // conta so as linhas de RESULTADO: a linha "Nada encontrado" nao e resultado
    resultados: document.querySelectorAll('#searchResults li:not(.search-empty)').length,
    mostrouVazio: !!document.querySelector('#searchResults .search-empty'),
    gravouAudio: status().includes('Recording audio'),
  }

  // busca por algo que existe de fato: o dominio, que sai da url
  r.buscaPorUrl = {}
  for (const q of ['facebook', '892819649954687', 'semente']) {
    inp.value = q
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    await espera(350)
    r.buscaPorUrl[q] = {
      resultados: document.querySelectorAll('#searchResults li:not(.search-empty)').length,
      primeiro: (document.querySelector('#searchResults .search-rotulo') || {}).textContent,
    }
  }

  // ---- 4. comando "sem origem" aparece e filtra o grid ----
  inp.value = 'sem or'
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  await espera(300)
  const cmd = document.querySelector('#searchResults .search-comando')
  r.comandoSemOrigem = { apareceu: !!cmd, texto: cmd ? cmd.textContent : '' }
  if (cmd) cmd.click()
  await espera(700)
  r.filtroSemOrigem = {
    dialogFechou: !d.open,
    celulas: document.querySelectorAll('.library-item').length,
    status: status(),
    // renderGrid mostra no maximo 60 por lote (§6)
    esperadoNoLote: Math.min(60, r.biblioteca.semOrigem),
  }

  // ---- 5. sheet: abre, escreve, salva, e o disco recebe ----
  const { openSheet } = require('./lib/metadata-sheet')
  const nome = todas[0].name
  openSheet(nome)
  await espera(700)
  const sheet = document.querySelector('#metadataSheet')
  const bar = sheet.querySelector('.uk-offcanvas-bar')
  r.sheet = {
    existe: !!sheet,
    abriu: sheet.classList.contains('uk-open'),
    // §8 pede sheet lateral DIREITO: a barra tem que encostar na borda direita
    encostaNaDireita:
      Math.abs(bar.getBoundingClientRect().right - window.innerWidth) < 2,
    largura: Math.round(bar.getBoundingClientRect().width),
    temInputTag: !!sheet.querySelector('uk-input-tag'),
    tituloCarregado: sheet.querySelector('input[name=titulo]').value,
  }

  sheet.querySelector('input[name=titulo]').value = 'titulo de teste fase3'
  sheet.querySelector('textarea[name=notes]').value = 'nota de teste fase3'

  // digita duas tags no uk-input-tag como o usuario digitaria
  const tagInput = sheet.querySelector('uk-input-tag input[type=text]')
  for (const t of ['reels', 'gato']) {
    tagInput.value = t
    tagInput.dispatchEvent(new Event('input', { bubbles: true }))
    tagInput.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
    )
    await espera(250)
  }
  r.tagsDigitadas = sheet.querySelector('uk-input-tag').$tags

  sheet.querySelector('[data-salvar]').click()
  await espera(600)

  r.salvou = {
    status: status(),
    // le do INDICE em memoria; o disco e conferido fora, por node
    noIndice: mediaIndex.get(nome),
    nome,
  }

  // ---- 6. pill no grid: existe e filtra ao clicar ----
  document.querySelector('#menu li[data-tab="download"]').click()
  await espera(800)
  const pill = document.querySelector('.library-item .library-tags .tag-pill')
  r.pillNoGrid = {
    apareceu: !!pill,
    texto: pill ? pill.textContent : '',
    // §10.6: `.library-item > *` do grid.css forca width/height 100% e
    // pointer-events:none — se venceu, a pill fica gigante e nao clicavel
    // a CAIXA e pointer-events:none de proposito (nao rouba o drag da celula);
    // quem tem que receber clique e a PILL
    caixaIgnoraPonteiro: pill ? getComputedStyle(pill.parentElement).pointerEvents : '',
    pillRecebeClique: pill ? getComputedStyle(pill).pointerEvents : '',
    pillLarguraNaoEstourou: pill
      ? Math.round(pill.getBoundingClientRect().width) < 100
      : false,
    alturaCaixa: pill ? Math.round(pill.parentElement.getBoundingClientRect().height) : 0,
  }
  if (pill) {
    pill.click()
    await espera(700)
    r.pillFiltrou = {
      status: status(),
      celulas: document.querySelectorAll('.library-item').length,
    }
  }

  // ---- 7. addTagToMany, a API que a Fase 2 vai chamar ----
  const { addTagToMany } = require('./lib/metadata-sheet')
  const doisNomes = todas.slice(1, 3).map((e) => e.name)
  r.addTagToMany = {
    nomes: doisNomes,
    alterados: addTagToMany(doisNomes, 'loteFase3'),
    // idempotente: chamar de novo nao pode duplicar
    naSegundaVez: addTagToMany(doisNomes, 'loteFase3'),
    conferido: doisNomes.map((n) => mediaIndex.get(n).tags),
  }

  // ---- 8. desfaz TUDO que o probe escreveu na biblioteca real ----
  const limpar = [semente, nome].concat(doisNomes)
  limpar.forEach((n) =>
    mediaIndex.setEntry(n, { url: '', titulo: '', tags: [], notes: '' }),
  )
  mediaIndex.flush()
  r.limpeza = limpar.map((n) => {
    const e = mediaIndex.get(n)
    return { nome: n, limpo: !e.url && !e.titulo && !e.tags.length && !e.notes }
  })

  return r
})()
