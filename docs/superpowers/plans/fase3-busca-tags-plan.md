# Fase 3 — Busca, Tags, Sheet e Pills — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para rastreio.

**Goal:** Permitir reencontrar qualquer mídia da biblioteca por `Cmd+K` (substring em título/tags/notes/url), editar metadados num sheet lateral direito, e filtrar por pill de tag ou por "sem origem" — junto com a correção obrigatória de atalhos cientes de foco.

**Architecture:** Toda a lógica de busca é uma função pura sobre o array que a Fase 1 já mantém em memória (`searchIndex(entries, query)`), verificável por script Node sem app. A UI é `<dialog>` nativo + `showModal()` (padrão que o app já usa no botão de ajuda) e Offcanvas do Franken UI para o sheet. Um único módulo adaptador (`library-adapter.js`) concentra **todas** as suposições sobre a API da Fase 1, para que uma divergência de nomes custe um arquivo, não sete.

**Tech Stack:** Electron 33, JS puro CommonJS, sem bundler, sem framework, sem framework de teste. Franken UI (vendorizado pela Fase 0). `<dialog>`/`showModal()` nativo, `IntersectionObserver` nativo.

**Spec:** `docs/superpowers/specs/2026-09-05-veditbox-gerenciador-midias-design.md` (§8, §8.1, §12). Leia o spec junto com este plano.

## Global Constraints

- Sem ponto e vírgula, aspas simples/backticks — segue `.prettierrc`.
- CommonJS (`require`), nunca ESM. Sem TypeScript, sem bundler, sem framework.
- **Zero dependências novas.** Nada de kbar, cmdk, React (§8). Nada de Fuse.js nesta fase (§8 — gatilho para reavaliar: usuário não achar coisa que sabe existir, por erro de digitação).
- Nada de CDN: `index.html` tem `Content-Security-Policy: script-src 'self' 'unsafe-inline'` (§9). Todo asset vem do disco.
- **O app nunca escreve em `tags`** (§2.4, §4). Tags são exclusivamente do usuário. Órfãos adotados **não** recebem tag automática — são alcançáveis pelo filtro "sem origem".
- Escopo da busca é a **biblioteca inteira**, não a aba atual (§8).
- Ranking: título > tag > nota (§8). `url` é pesquisável mas é o menor peso.
- Verificar **rodando**, não compilando (§12). Lógica pura → script Node com asserções. Fluxo de UI → instrumentar `src/main/index.js` temporariamente com `executeJavaScript`, medir DOM/filesystem reais, **e reverter a instrumentação**.
- Mudança relevante → registrar em `version.md`.
- Arquivos gerados vão para `~/veditbox`; índice em `~/veditbox/.veditbox/index.json`.

---

## Fronteiras desta fase

**Sou dono de (crio/edito à vontade):**

- `src/utils/is-typing-target.js` (novo)
- `src/renderer/lib/search/*` (novo diretório inteiro)
- `src/renderer/lib/metadata-sheet.js` (novo)
- `src/renderer/styles/search.css` (novo)
- `src/renderer/lib/recorder/audio/index.js` (correção §8.1 — 3 linhas)
- `scripts/check-search.js` (novo)

**Arquivos compartilhados que toco minimamente (risco de conflito de merge):**

- `src/renderer/index.html` — **1 linha** (`<link>` do meu CSS). Todo o resto do meu DOM é criado em JS justamente para não disputar este arquivo com as Fases 0/1/2.
- `src/renderer/index.js` — **1 linha** de `require`.
- `version.md` — 1 entrada.

**Não toco:** `library.js`/grid (Fase 1), barra de seleção e IPC de lixeira (Fase 2), chrome/tokens do Franken UI (Fase 0).

## Suposições sobre a Fase 1 (todas isoladas na Task 1)

A Fase 1 é dona do índice e do grid. Este plano assume a existência de um store com, em espírito, esta API. **Se os nomes reais diferirem, só `library-adapter.js` muda.**

| Suposição | Uso aqui |
|---|---|
| `require('../index/store')` expõe `getAll()` → array de `{ name, filePath, url, titulo, tags, notes, largura, altura, category, data }` | fonte da busca |
| `store.update(name, patch)` grava o patch no índice com escrita atômica (§4) | salvar do sheet |
| `library.js` expõe `showLibrary(tab)` e algo capaz de renderizar uma **lista arbitrária** de itens | mostrar resultado / filtro por tag |
| `library.js` expõe `showPreview(file, tab)` | ancorar o sheet |

Se a Fase 1 **não** expuser renderização de lista arbitrária, o fallback já previsto (Task 1, Passo 3) é o adaptador chamar `showLibrary` com um filtro em memória.

---

### Task 1: Guarda de foco nos atalhos globais (§8.1 — correção obrigatória)

Vem primeiro, sozinha e commitada isolada: sem ela, a busca **nasce quebrada** (digitar "reels" começa a gravar áudio). Já foi verificado no app rodando que `<dialog open>` **não** isola: `keydown` num input dentro do dialog sobe até `window.onkeydown`.

**Files:**
- Create: `src/utils/is-typing-target.js`
- Create: `scripts/check-search.js`
- Modify: `src/renderer/lib/recorder/audio/index.js:15-29`

**Interfaces:**
- Consumes: nada.
- Produces: `isTypingTarget(el) -> boolean` — `true` se `el` for `<input>`, `<textarea>`, `<select>` ou `contenteditable`. Usado por qualquer atalho global futuro (Fase 2 também deve usar em `Cmd+A`/`Delete`).

- [ ] **Step 1: Escrever o script de asserção que falha**

Crie `scripts/check-search.js`. Ele roda com `node`, sem Electron, sem DOM real — por isso `isTypingTarget` recebe um objeto com `tagName`/`isContentEditable` e não depende de `HTMLElement`.

```js
const assert = require('assert')
const { isTypingTarget } = require('../src/utils/is-typing-target')

const el = (tagName, extra = {}) => ({ tagName, isContentEditable: false, ...extra })

assert.equal(isTypingTarget(el('INPUT')), true, 'input digita')
assert.equal(isTypingTarget(el('TEXTAREA')), true, 'textarea digita')
assert.equal(isTypingTarget(el('SELECT')), true, 'select captura teclas')
assert.equal(isTypingTarget(el('DIV', { isContentEditable: true })), true, 'contenteditable digita')
assert.equal(isTypingTarget(el('DIV')), false, 'div comum nao digita')
assert.equal(isTypingTarget(el('BODY')), false, 'body nao digita')
assert.equal(isTypingTarget(null), false, 'alvo nulo nao quebra')
assert.equal(isTypingTarget(undefined), false, 'alvo indefinido nao quebra')

console.log('ok is-typing-target')
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node scripts/check-search.js`
Expected: FAIL — `Cannot find module '../src/utils/is-typing-target'`.

- [ ] **Step 3: Implementar o mínimo**

Crie `src/utils/is-typing-target.js`:

```js
// Atalhos globais (r, espaco, Cmd+A, Delete) nao podem disparar enquanto o usuario digita.
// Verificado: keydown num input dentro de <dialog open> SOBE ate window.onkeydown.
const isTypingTarget = (el) =>
  !!el &&
  (el.isContentEditable === true ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

module.exports = { isTypingTarget }
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node scripts/check-search.js`
Expected: PASS — imprime `ok is-typing-target`.

- [ ] **Step 5: Aplicar a guarda no gravador de áudio**

Em `src/renderer/lib/recorder/audio/index.js`, adicione o require junto aos outros (depois da linha 13) e a guarda como primeira condição do handler:

```js
const { isTypingTarget } = require('../../../../utils/is-typing-target')
```

Substitua o handler das linhas 15-29 por:

```js
window.onkeydown = (e) => {
  if (isTypingTarget(e.target)) return
  if (!e.altKey && !e.ctrlKey && !e.metaKey) {
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault()
      e.stopPropagation()
      toggleRecording({ noiseSuppression: !e.shiftKey })
    } else if (e.key === ' ') {
      if (window.activeThing.play) {
        e.preventDefault()
        e.stopPropagation()
        window.activeThing.play()
      }
    }
  }
}
```

- [ ] **Step 6: Verificar RODANDO o app (não só o script)**

Isto é o ponto inteiro da tarefa; o script Node não prova nada sobre `<dialog>`. Instrumente `src/main/index.js` temporariamente: acrescente ao final do arquivo, **e marque para reverter**:

```js
// TEMP-INSTRUMENTACAO-FASE3 — remover antes do commit
app.whenReady().then(async () => {
  await new Promise((r) => setTimeout(r, 2500))
  const out = await win.webContents.executeJavaScript(`(async () => {
    const d = document.createElement('dialog')
    const i = document.createElement('input')
    d.appendChild(i)
    document.body.appendChild(d)
    d.showModal()
    i.focus()
    const antes = !!document.querySelector('.waveform, canvas')
    for (const k of ['r', 'e', 'e', 'l', 's']) {
      i.value += k
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
      i.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
    }
    await new Promise((r) => setTimeout(r, 800))
    const depois = !!document.querySelector('.waveform, canvas')
    const status = document.querySelector('#statusText').textContent
    d.close(); d.remove()
    return JSON.stringify({ antes, depois, status, valor: i.value })
  })()`)
  console.log('INSTRUMENTACAO:', out)
})
```

Run: `yarn start`
Expected no stdout: `{"antes":false,"depois":false,"status":"...","valor":"reels"}` — `depois` **false** e `status` **sem** `Recording audio...`. Se `depois` for `true` ou o status virar `Recording audio...`, a guarda não pegou: pare e investigue antes de seguir.

Controle negativo (prova que o teste testaria algo): rode o mesmo trecho disparando o `keydown` com `e.target = document.body` — aí a gravação **deve** começar. Sem esse controle, um teste que sempre passa não vale nada.

- [ ] **Step 7: Reverter a instrumentação**

Run: `git diff src/main/index.js`
Expected: **vazio**. `src/main/index.js` não pode entrar no commit desta fase.

- [ ] **Step 8: Commit**

```bash
git add src/utils/is-typing-target.js scripts/check-search.js src/renderer/lib/recorder/audio/index.js
git commit -m "fix: atalhos globais ignoram teclas digitadas em campos de texto"
```

---

### Task 2: Adaptador da Fase 1 (isola todas as suposições)

Um arquivo, um propósito: ser o **único** lugar que sabe os nomes reais da API da Fase 1. Não é abstração especulativa — é contenção de merge entre quatro agentes paralelos.

**Files:**
- Create: `src/renderer/lib/search/library-adapter.js`

**Interfaces:**
- Consumes: store e `library.js` da Fase 1 (ver tabela de suposições acima).
- Produces:
  - `allEntries() -> Array<{ name, filePath, url, titulo, tags, notes, category }>`
  - `updateEntry(name, patch) -> void`
  - `renderList(items, rotulo) -> void`
  - `openPreview(entry) -> void`

- [ ] **Step 1: Ler a API real da Fase 1 antes de escrever qualquer linha**

Run: `git log --oneline -- src/renderer/lib/index/ src/renderer/lib/library.js && rg -n 'module.exports' src/renderer/lib/index/ src/renderer/lib/library.js`
Expected: a lista de exports reais. **Escreva o adaptador contra o que apareceu**, não contra a tabela de suposições. Se a Fase 1 ainda não mergeou, siga com a tabela e deixe o `ponytail:` do Passo 2 no lugar.

- [ ] **Step 2: Escrever o adaptador**

```js
// Unico ponto de acoplamento com a Fase 1. Se os nomes de la mudarem, so este arquivo muda.
// ponytail: escrito contra a API assumida no design doc; conferir no merge com a Fase 1.
const store = require('../index/store')
const library = require('../library')

const allEntries = () =>
  store.getAll().map((e) => ({
    name: e.name,
    filePath: e.filePath,
    url: e.url || '',
    titulo: e.titulo || '',
    tags: Array.isArray(e.tags) ? e.tags : [],
    notes: e.notes || '',
    category: e.category,
  }))

const updateEntry = (name, patch) => store.update(name, patch)

// Fase 1 renderiza lista arbitraria; se so existir showLibrary(tab), cai no fallback.
const renderList = (items, rotulo) => {
  if (library.renderList) return library.renderList(items, rotulo)
  library.showLibrary('download')
  showStatus(`${rotulo}: ${items.length} item(ns)`)
}

const openPreview = (entry) => library.showPreview(entry, 'download')

module.exports = { allEntries, updateEntry, renderList, openPreview }
```

- [ ] **Step 3: Verificar que o adaptador lê a biblioteca real**

Instrumente `src/main/index.js` como na Task 1, com este corpo:

```js
const out = await win.webContents.executeJavaScript(`(() => {
  const a = require('./lib/search/library-adapter')
  const e = a.allEntries()
  return JSON.stringify({ total: e.length, amostra: e[0] || null })
})()`)
```

Run: `yarn start`
Expected: `total` igual à contagem real de `ls ~/veditbox | wc -l` (só mídias), e `amostra` com as sete chaves. Se estourar exceção de módulo não encontrado, a Fase 1 ainda não mergeou — pare e reporte a dependência.

- [ ] **Step 4: Reverter a instrumentação e commitar**

```bash
git diff --quiet src/main/index.js || echo 'REVERTER PRIMEIRO'
git add src/renderer/lib/search/library-adapter.js
git commit -m "feat: adaptador entre busca e o indice da fase 1"
```

---

### Task 3: Busca e ranking (lógica pura)

**Files:**
- Create: `src/renderer/lib/search/rank.js`
- Modify: `scripts/check-search.js`

**Interfaces:**
- Consumes: nada (função pura, sem `require` de DOM ou Electron — é isso que a torna testável em Node).
- Produces: `searchEntries(entries, query) -> Array<entry>` ordenado por relevância decrescente; `scoreEntry(entry, termo) -> number` (0 = não casa).

- [ ] **Step 1: Escrever as asserções que falham**

Acrescente ao final de `scripts/check-search.js`:

```js
const { searchEntries, scoreEntry } = require('../src/renderer/lib/search/rank')

const entrada = (over) => ({ name: 'x.mp4', url: '', titulo: '', tags: [], notes: '', ...over })

const porTitulo = entrada({ name: 'a.mp4', titulo: 'reels de gato' })
const porTag = entrada({ name: 'b.mp4', tags: ['reels'] })
const porNota = entrada({ name: 'c.mp4', notes: 'usar nos reels da semana' })
const porUrl = entrada({ name: 'd.mp4', url: 'https://facebook.com/reel/892819649954687' })
const nada = entrada({ name: 'e.mp4', titulo: 'paisagem' })

// ranking: titulo > tag > nota > url
assert.ok(scoreEntry(porTitulo, 'reels') > scoreEntry(porTag, 'reels'), 'titulo bate tag')
assert.ok(scoreEntry(porTag, 'reels') > scoreEntry(porNota, 'reels'), 'tag bate nota')
assert.ok(scoreEntry(porNota, 'reels') > scoreEntry(porUrl, 'reel'), 'nota bate url')
assert.equal(scoreEntry(nada, 'reels'), 0, 'sem casamento pontua zero')

const r = searchEntries([porNota, porUrl, nada, porTitulo, porTag], 'reels')
assert.deepEqual(r.map((e) => e.name), ['a.mp4', 'b.mp4', 'c.mp4'], 'ordem por relevancia, sem os que nao casam')

// substring, nao prefixo
assert.ok(scoreEntry(entrada({ titulo: 'meus reels' }), 'eel') > 0, 'casa no meio da palavra')
// case-insensitive e acento-insensitive: o usuario digita a tag como lembra
assert.ok(scoreEntry(entrada({ tags: ['Sertão'] }), 'sertao') > 0, 'ignora caixa e acento')
// query vazia devolve tudo, na ordem original (Cmd+K abre mostrando a biblioteca)
assert.equal(searchEntries([porTitulo, porTag], '   ').length, 2, 'query vazia devolve tudo')
// varios termos: todos precisam casar em algum campo
assert.equal(searchEntries([entrada({ titulo: 'reels de gato' })], 'reels gato').length, 1, 'AND entre termos')
assert.equal(searchEntries([entrada({ titulo: 'reels de gato' })], 'reels cachorro').length, 0, 'termo ausente elimina')

console.log('ok rank')
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node scripts/check-search.js`
Expected: FAIL — `Cannot find module '../src/renderer/lib/search/rank'`.

- [ ] **Step 3: Implementar**

Crie `src/renderer/lib/search/rank.js`:

```js
// Funcao pura, sem DOM e sem require de electron: roda em node, e por isso da pra testar.
// ponytail: includes() sobre milhares de itens e instantaneo. Fuse.js so se o usuario
// nao achar o que sabe existir (erro de digitacao) — entra sobre este mesmo array.
const PESOS = { titulo: 8, tags: 4, notes: 2, url: 1 }

const normalizar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const campos = (entry) => ({
  titulo: normalizar(entry.titulo),
  tags: normalizar((entry.tags || []).join(' ')),
  notes: normalizar(entry.notes),
  url: normalizar(entry.url),
})

const scoreEntry = (entry, termo) => {
  const t = normalizar(termo)
  if (!t) return 0
  const c = campos(entry)
  return Object.keys(PESOS).reduce(
    (total, campo) => total + (c[campo].includes(t) ? PESOS[campo] : 0),
    0,
  )
}

const searchEntries = (entries, query) => {
  const termos = normalizar(query).split(/\s+/).filter(Boolean)
  if (!termos.length) return entries.slice()

  return entries
    .map((entry) => ({
      entry,
      score: termos.reduce((total, termo) => {
        const s = scoreEntry(entry, termo)
        return s === 0 ? -Infinity : total + s // um termo ausente elimina o item
      }, 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .map(({ entry }) => entry)
}

module.exports = { searchEntries, scoreEntry, normalizar }
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node scripts/check-search.js`
Expected: PASS — imprime `ok is-typing-target` e `ok rank`.

- [ ] **Step 5: Medir com a biblioteca real, não com fixtures**

Run: `node -e "const {searchEntries}=require('./src/renderer/lib/search/rank');const e=Array.from({length:5000},(_,i)=>({name:i+'.mp4',titulo:'video '+i,tags:['t'+(i%50)],notes:'',url:'https://x.com/'+i}));const t=Date.now();for(let i=0;i<50;i++)searchEntries(e,'t7');console.log('ms por busca:',(Date.now()-t)/50)"`
Expected: bem abaixo de 16ms por busca em 5000 itens — confirma na medição a premissa do §8 de que `includes()` basta e Fuse.js não é necessário. Se passar de 16ms, registre o número no relatório em vez de adotar Fuse.js por conta própria.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/lib/search/rank.js scripts/check-search.js
git commit -m "feat: busca por substring com ranking titulo > tag > nota > url"
```

---

### Task 4: Palette `Cmd+K` com `<dialog>` nativo

**Files:**
- Create: `src/renderer/lib/search/index.js`
- Create: `src/renderer/styles/search.css`
- Modify: `src/renderer/index.html:11` (uma linha: `<link>`)
- Modify: `src/renderer/index.js` (uma linha: `require`)

**Interfaces:**
- Consumes: `searchEntries` (Task 3), `allEntries`/`renderList`/`openPreview` (Task 2), `isTypingTarget` (Task 1).
- Produces: `openSearch()` / `closeSearch()` — a Fase 2 pode querer fechar a palette ao entrar em modo seleção.

- [ ] **Step 1: Escrever o CSS**

Crie `src/renderer/styles/search.css`. Só o que a palette precisa; tokens do `index.css` existente (§9: mapear, não descartar):

```css
#searchDialog {
  border: 0;
  border-radius: 8px;
  padding: 0;
  width: 460px;
  max-width: 90vw;
  background: var(--gray-100, #1a1a1e);
  color: inherit;
}
#searchDialog::backdrop { background: rgba(0, 0, 0, 0.5); }
#searchDialog input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: inherit;
  font-size: 15px;
  outline: 0;
}
#searchResults { max-height: 320px; overflow-y: auto; margin: 0; padding: 0; list-style: none; }
#searchResults li { padding: 8px 14px; cursor: pointer; display: flex; gap: 8px; align-items: center; }
#searchResults li[aria-selected='true'] { background: rgba(255, 255, 255, 0.08); }
#searchResults .search-empty { opacity: 0.6; cursor: default; }
.tag-pill {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: var(--purple, #8257e5);
  color: #fff;
  cursor: pointer;
}
```

- [ ] **Step 2: Ligar o CSS no HTML**

Em `src/renderer/index.html`, depois da linha 11 (`ai-search.css`), acrescente exatamente uma linha:

```html
    <link rel="stylesheet" href="styles/search.css" />
```

Não crie o `<dialog>` no HTML: todo o DOM da palette nasce em JS, para não disputar `index.html` com as Fases 0/1/2.

- [ ] **Step 3: Implementar a palette**

Crie `src/renderer/lib/search/index.js`:

```js
const { searchEntries } = require('./rank')
const { allEntries, renderList, openPreview } = require('./library-adapter')
const { isTypingTarget } = require('../../../utils/is-typing-target')

let dialog, input, lista
let resultados = []
let cursor = 0

// O dialog nasce em JS e e anexado ao final do body: o querySelector('dialog') do
// elements.js continua achando o dialog de ajuda, que vem antes no documento.
function montar() {
  dialog = document.createElement('dialog')
  dialog.id = 'searchDialog'

  input = document.createElement('input')
  input.type = 'search'
  input.placeholder = 'Buscar por titulo, tag, nota ou url...'

  lista = document.createElement('ul')
  lista.id = 'searchResults'

  dialog.append(input, lista)
  document.body.appendChild(dialog)

  input.oninput = () => render(input.value)
  dialog.onclose = () => (input.value = '')
  dialog.onclick = (e) => { if (e.target === dialog) dialog.close() } // clique no backdrop fecha
  input.onkeydown = aoTeclar
}

function render(query) {
  // Escopo e a biblioteca inteira, nao a aba atual: o ponto e achar o que nao se sabe onde esta.
  resultados = searchEntries(allEntries(), query).slice(0, 50)
  cursor = 0
  lista.innerHTML = ''

  if (!resultados.length) {
    const vazio = document.createElement('li')
    vazio.className = 'search-empty'
    vazio.textContent = 'Nada encontrado'
    lista.appendChild(vazio)
    return
  }

  resultados.forEach((entry, i) => {
    const li = document.createElement('li')
    li.setAttribute('aria-selected', String(i === cursor))
    li.textContent = entry.titulo || entry.name
    entry.tags.forEach((tag) => {
      const pill = document.createElement('span')
      pill.className = 'tag-pill'
      pill.textContent = tag
      pill.onclick = (e) => {
        e.stopPropagation()
        filtrarPorTag(tag)
      }
      li.appendChild(pill)
    })
    li.onclick = () => escolher(i)
    lista.appendChild(li)
  })
}

function mover(delta) {
  if (!resultados.length) return
  cursor = (cursor + delta + resultados.length) % resultados.length
  Array.from(lista.children).forEach((li, i) =>
    li.setAttribute('aria-selected', String(i === cursor)),
  )
  lista.children[cursor].scrollIntoView({ block: 'nearest' })
}

function escolher(i) {
  const entry = resultados[i]
  if (!entry) return
  dialog.close()
  openPreview(entry)
}

function aoTeclar(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); mover(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1) }
  else if (e.key === 'Enter') { e.preventDefault(); escolher(cursor) }
  // Esc: o proprio <dialog> ja fecha, nao precisa de codigo
}

function openSearch() {
  if (!dialog) montar()
  render('')
  dialog.showModal()
  input.focus()
}

const closeSearch = () => dialog && dialog.open && dialog.close()

function filtrarPorTag(tag) {
  const alvo = tag.toLowerCase()
  const items = allEntries().filter((e) => e.tags.some((t) => t.toLowerCase() === alvo))
  closeSearch()
  renderList(items, `tag: ${tag}`)
}

function filtrarSemOrigem() {
  const items = allEntries().filter((e) => !e.url)
  closeSearch()
  renderList(items, 'sem origem')
}

// Cmd+K funciona ate com foco num input (e o unico atalho que deve): e como se sai de la.
document.addEventListener('keydown', (e) => {
  if (e.metaKey && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (dialog && dialog.open) closeSearch()
    else openSearch()
  }
})

module.exports = { openSearch, closeSearch, filtrarPorTag, filtrarSemOrigem, isTypingTarget }
```

- [ ] **Step 4: Carregar no boot**

Em `src/renderer/index.js`, depois da linha `require('./lib/library.js')`, acrescente:

```js
// Busca (Cmd+K), filtro por tag e sheet de metadados
require('./lib/search/index.js')
```

- [ ] **Step 5: Verificar RODANDO — abrir, digitar e não gravar áudio**

Instrumente `src/main/index.js` (temporário) com:

```js
const out = await win.webContents.executeJavaScript(`(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
  await espera(200)
  const d = document.querySelector('#searchDialog')
  const i = d.querySelector('input')
  const abriu = d.open
  const focado = document.activeElement === i
  const totalInicial = d.querySelectorAll('#searchResults li').length
  for (const k of ['r', 'e', 'e', 'l', 's']) {
    i.value += k
    i.dispatchEvent(new Event('input', { bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  }
  await espera(600)
  const status = document.querySelector('#statusText').textContent
  const totalFiltrado = d.querySelectorAll('#searchResults li').length
  return JSON.stringify({ abriu, focado, totalInicial, totalFiltrado, status, valor: i.value })
})()`)
```

Run: `yarn start`
Expected: `abriu: true`, `focado: true`, `totalInicial` = contagem da biblioteca (até 50), `valor: "reels"`, e `status` **sem** `Recording audio...`. Esta é a verificação de ponta a ponta do §8.1 dentro da UI de verdade — a Task 1 provou a guarda, esta prova que a busca a usa.

- [ ] **Step 6: Verificar que o dialog de ajuda não quebrou**

Ainda instrumentado, acrescente ao retorno: `ajudaEhODeAjuda: document.querySelector('dialog').id !== 'searchDialog'`.
Run: `yarn start`
Expected: `true`. `src/utils/elements.js:12` faz `querySelector('dialog')` — se algum dia o dialog de busca ficar **antes** no documento, o botão de ajuda passa a abrir a busca. Se der `false`, pare: a correção é dar `id="helpDialog"` ao dialog de ajuda e apontar `elements.js` para ele (edita arquivo compartilhado — reporte ao Maestro antes).

- [ ] **Step 7: Reverter a instrumentação e commitar**

```bash
git diff --quiet src/main/index.js || echo 'REVERTER PRIMEIRO'
git add src/renderer/lib/search/index.js src/renderer/styles/search.css src/renderer/index.html src/renderer/index.js
git commit -m "feat: busca por Cmd+K em dialog nativo"
```

---

### Task 5: Filtro "sem origem" e pill de tag na interface

**Files:**
- Modify: `src/renderer/lib/search/index.js` (adiciona a entrada de filtro na palette)

**Interfaces:**
- Consumes: `filtrarSemOrigem`, `filtrarPorTag` (Task 4).
- Produces: nada novo — só torna o já implementado alcançável sem mouse.

- [ ] **Step 1: Expor "sem origem" como primeiro item quando a query casar**

Órfãos adotados têm `url` vazia (§4) e **não** ganham tag automática, então o único caminho até eles é este filtro. Em `render()`, antes do `resultados.forEach`, acrescente:

```js
  // Comando, nao arquivo: aparece quando a query casa com o nome do filtro.
  if ('sem origem'.includes(normalizar(query)) && query.trim()) {
    const li = document.createElement('li')
    li.textContent = '⌕ Filtrar: sem origem'
    li.onclick = filtrarSemOrigem
    lista.insertBefore(li, lista.firstChild)
  }
```

E importe `normalizar` do `./rank` na linha do require existente:

```js
const { searchEntries, normalizar } = require('./rank')
```

- [ ] **Step 2: Verificar RODANDO com um órfão de verdade**

Crie um órfão real (arquivo na pasta sem entrada de `url`):

Run: `cp ~/veditbox/$(ls ~/veditbox | grep -E '\.(mp4|png|jpg)$' | head -1) ~/veditbox/orfao-teste.png 2>/dev/null; ls ~/veditbox/orfao-teste.png`
Expected: o arquivo existe.

Instrumente e rode:

```js
const out = await win.webContents.executeJavaScript(`(async () => {
  const s = require('./lib/search/index.js')
  s.filtrarSemOrigem()
  await new Promise((r) => setTimeout(r, 400))
  return JSON.stringify({
    status: document.querySelector('#statusText').textContent,
    itens: document.querySelectorAll('.library-item').length,
  })
})()`)
```

Run: `yarn start`
Expected: `itens` >= 1 e o órfão presente. Este é o teste de verdade: filesystem real, índice real, DOM real.

- [ ] **Step 3: Limpar o arquivo de teste**

Run: `rm ~/veditbox/orfao-teste.png`

- [ ] **Step 4: Reverter a instrumentação e commitar**

```bash
git diff --quiet src/main/index.js || echo 'REVERTER PRIMEIRO'
git add src/renderer/lib/search/index.js
git commit -m "feat: filtro sem origem e pills de tag clicaveis"
```

---

### Task 6: Sheet lateral direito para editar metadados

**Files:**
- Create: `src/renderer/lib/metadata-sheet.js`
- Modify: `src/renderer/styles/search.css` (estilos do sheet)
- Modify: `src/renderer/lib/search/index.js` (uma linha de `require` para registrar o atalho)

**Interfaces:**
- Consumes: `allEntries`, `updateEntry` (Task 2).
- Produces: `openSheet(name)` / `closeSheet()`. A Fase 2 chama `addTagToMany(names, tag)` a partir da barra de ação de seleção múltipla (§8).

- [ ] **Step 1: Implementar o sheet**

Crie `src/renderer/lib/metadata-sheet.js`. Usa `Offcanvas` do Franken UI se a Fase 0 já tiver vendorizado (`window.UIkit`), com fallback para um `<aside>` — assim esta tarefa não fica bloqueada esperando a Fase 0:

```js
const { allEntries, updateEntry } = require('./search/library-adapter')

let sheet, form, atual

function montar() {
  sheet = document.createElement('aside')
  sheet.id = 'metadataSheet'
  sheet.hidden = true

  form = document.createElement('form')
  form.innerHTML = `
    <label>Titulo <input name="titulo" type="text" /></label>
    <label>Tags <input name="tags" type="text" placeholder="separadas por virgula" /></label>
    <label>Notas <textarea name="notes" rows="4"></textarea></label>
    <button type="submit">Salvar</button>
    <button type="button" data-fechar>Fechar</button>
  `
  form.onsubmit = (e) => {
    e.preventDefault()
    salvar()
  }
  form.querySelector('[data-fechar]').onclick = closeSheet

  sheet.appendChild(form)
  document.body.appendChild(sheet)
}

function openSheet(name) {
  if (!sheet) montar()
  atual = allEntries().find((e) => e.name === name)
  if (!atual) return
  form.titulo.value = atual.titulo
  form.tags.value = atual.tags.join(', ')
  form.notes.value = atual.notes
  sheet.hidden = false
  form.titulo.focus()
}

const closeSheet = () => sheet && (sheet.hidden = true)

// Tags sao do usuario: o app so grava o que ele digitou, nunca acrescenta as suas (§2.4).
const parseTags = (texto) =>
  texto
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

function salvar() {
  if (!atual) return
  updateEntry(atual.name, {
    titulo: form.titulo.value.trim(),
    tags: parseTags(form.tags.value),
    notes: form.notes.value,
  })
  showStatus(`Metadados salvos: ${atual.name}`)
  closeSheet()
}

// Usada pela barra de acao da Fase 2 ("adicionar tag a N itens")
function addTagToMany(names, tag) {
  const limpa = tag.trim()
  if (!limpa) return
  const porNome = new Map(allEntries().map((e) => [e.name, e]))
  names.forEach((name) => {
    const e = porNome.get(name)
    if (!e || e.tags.includes(limpa)) return
    updateEntry(name, { tags: e.tags.concat(limpa) })
  })
}

module.exports = { openSheet, closeSheet, addTagToMany, parseTags }
```

- [ ] **Step 2: Estilos do sheet**

Acrescente a `src/renderer/styles/search.css`:

```css
#metadataSheet {
  position: fixed;
  top: 0;
  right: 0;
  width: 280px;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  overflow-y: auto;
  background: var(--gray-100, #1a1a1e);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 10;
}
#metadataSheet[hidden] { display: none; }
#metadataSheet label { display: block; margin-bottom: 12px; font-size: 12px; opacity: 0.8; }
#metadataSheet input,
#metadataSheet textarea {
  width: 100%;
  box-sizing: border-box;
  margin-top: 4px;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  font: inherit;
}
```

- [ ] **Step 3: Abrir o sheet a partir do preview**

Em `src/renderer/lib/search/index.js`, acrescente ao topo:

```js
const { openSheet } = require('../metadata-sheet')
```

E em `escolher()`, depois de `openPreview(entry)`, acrescente `openSheet(entry.name)`. Assim o sheet acompanha o preview (§8) sem eu precisar editar `library.js`, que é da Fase 1.

- [ ] **Step 4: Verificar RODANDO — o metadado chega ao disco**

Este é o único teste que importa aqui: editar na UI e ler o JSON do disco.

```js
const out = await win.webContents.executeJavaScript(`(async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  const { openSheet } = require('./lib/metadata-sheet')
  const { allEntries } = require('./lib/search/library-adapter')
  const alvo = allEntries()[0]
  openSheet(alvo.name)
  await espera(200)
  const f = document.querySelector('#metadataSheet form')
  f.titulo.value = 'titulo de teste fase3'
  f.tags.value = 'reels, gato'
  f.notes.value = 'nota de teste'
  f.querySelector('button[type=submit]').click()
  await espera(400)
  return JSON.stringify({ name: alvo.name, antes: alvo })
})()`)
```

Run: `yarn start`, e depois:
Run: `node -e "const i=require(require('os').homedir()+'/veditbox/.veditbox/index.json');const k=Object.keys(i).find(k=>i[k].titulo==='titulo de teste fase3');console.log(k, JSON.stringify(i[k]))"`
Expected: imprime a entrada com `titulo: 'titulo de teste fase3'` e `tags: ['reels','gato']` — **lido do arquivo**, não da memória. Se as tags vierem como string única, `parseTags` quebrou.

- [ ] **Step 5: Verificar que a busca acha o que acabou de ser salvo**

Ainda instrumentado, com a palette:

```js
const out = await win.webContents.executeJavaScript(`(async () => {
  const s = require('./lib/search/index.js')
  s.openSearch()
  const i = document.querySelector('#searchDialog input')
  i.value = 'gato'
  i.dispatchEvent(new Event('input', { bubbles: true }))
  await new Promise((r) => setTimeout(r, 300))
  return JSON.stringify({ achou: document.querySelectorAll('#searchResults li').length })
})()`)
```

Expected: `achou` >= 1. Fecha o ciclo: escreveu no índice, reconciliou, achou pela busca.

- [ ] **Step 6: Desfazer o metadado de teste**

Run: `node -e "const fs=require('fs');const p=require('os').homedir()+'/veditbox/.veditbox/index.json';const i=JSON.parse(fs.readFileSync(p));const k=Object.keys(i).find(k=>i[k].titulo==='titulo de teste fase3');if(k){i[k].titulo='';i[k].tags=[];i[k].notes='';fs.writeFileSync(p,JSON.stringify(i,null,2))};console.log('limpo',k)"`

- [ ] **Step 7: Reverter a instrumentação e commitar**

```bash
git diff --quiet src/main/index.js || echo 'REVERTER PRIMEIRO'
git add src/renderer/lib/metadata-sheet.js src/renderer/styles/search.css src/renderer/lib/search/index.js
git commit -m "feat: sheet lateral para editar titulo, tags e notas"
```

---

### Task 7: Documentação e fechamento

**Files:**
- Modify: `version.md`
- Modify: `src/renderer/index.html:42-59` (uma linha no texto de ajuda)

- [ ] **Step 1: Documentar `Cmd+K` no dialog de ajuda**

Em `src/renderer/index.html`, dentro do `<dialog>` de ajuda, acrescente um parágrafo depois do de gravar vídeo:

```html
      <p>
        <b>Buscar</b>: <span>Cmd+K</span> busca em toda a biblioteca por titulo, tag, nota ou url.
      </p>
```

- [ ] **Step 2: Registrar em `version.md`**

Acrescente a entrada seguindo o formato já usado no arquivo (leia-o antes; não invente formato):

```
- busca com Cmd+K em toda a biblioteca (titulo, tags, notas, url)
- sheet lateral para editar titulo, tags e notas
- pills de tag clicaveis e filtro "sem origem"
- fix: atalhos r/espaco nao disparam mais enquanto se digita
```

- [ ] **Step 3: Rodada final de verificação**

Run: `node scripts/check-search.js && git diff --quiet src/main/index.js && echo 'main limpo' && yarn start`
Expected: asserções passam, `main limpo` aparece, e no app: `Cmd+K` abre, digitar não grava áudio, clicar numa pill filtra, o sheet salva. Só declare pronto depois de ver isso na tela.

- [ ] **Step 4: Commit**

```bash
git add version.md src/renderer/index.html
git commit -m "docs: registra busca, tags e sheet da fase 3"
```

---

## Self-review (cobertura do §8 e §8.1)

| Requisito do spec | Task |
|---|---|
| `Cmd+K` abre `<dialog>` nativo, sem campo permanente | 4 |
| Sem kbar/cmdk/React | 4 (DOM em JS puro, zero deps) |
| Substring em titulo/tags/notes/url | 3 |
| Ranking titulo > tag > nota | 3 |
| Escopo = biblioteca inteira, não a aba | 4 (`allEntries()`, sem filtro de aba) |
| Fuse.js não agora, com gatilho medido | 3 (Passo 5 mede e registra o número) |
| Sheet lateral direito no preview | 6 |
| Pills de tag; clicar filtra | 4, 5 |
| Filtro "sem origem" para órfãos | 5 |
| "Adicionar tag a N itens" para a Fase 2 | 6 (`addTagToMany`) |
| §8.1 guarda de foco, junto com a busca | 1 (isolada e primeira) |
| §12 lógica pura em script Node | 1, 3 |
| §12 UI instrumentada e revertida | 1, 2, 4, 5, 6 |

## Riscos e objeções para o Maestro

1. **`src/utils/elements.js:12` usa `querySelector('dialog')`.** Isso é um alçapão: qualquer `<dialog>` que apareça antes do de ajuda no documento sequestra o botão de ajuda. Eu contorno criando o meu em JS e anexando ao fim do `body`, e a Task 4 Passo 6 verifica isso explicitamente. Mas a correção certa — `id="helpDialog"` — mexe em arquivo compartilhado com a Fase 0. **Não fiz por conta própria; recomendo que a Fase 0 faça**, já que ela é a dona do chrome.
2. **Dependência dura da Fase 1.** Tasks 2 a 6 não rodam sem o store e a lista da Fase 1. As Tasks 1 e 3 (guarda de foco e ranking puro) são independentes e podem mergear antes de tudo — sugiro liberá-las cedo, porque a guarda protege também os atalhos que a Fase 2 vai registrar.
3. **`renderList` de lista arbitrária é a única suposição que pode não existir.** Se a Fase 1 só expuser `showLibrary(tab)`, o filtro por tag cai num fallback pior (mostra a aba inteira e só ajusta o status). Vale combinar esse ponto com a Fase 1 antes de ela fechar o grid.
4. **Franken UI Offcanvas/Input Tag:** o §9 os prescreve, mas eu implementei o sheet com `<aside>` + `<input>` de vírgulas para não bloquear na Fase 0. Se a Fase 0 mergear antes, trocar por `Offcanvas`/`Input Tag` é substituição local dentro de `metadata-sheet.js`. **Não é divergência do contrato, é ordem de merge** — mas registro para não parecer que ignorei o §9.
5. **`Cmd+K` é o único atalho que deliberadamente ignora a guarda de foco**, porque precisa funcionar de dentro de um campo de texto. Está registrado em comentário no código para que ninguém "conserte" isso depois.
