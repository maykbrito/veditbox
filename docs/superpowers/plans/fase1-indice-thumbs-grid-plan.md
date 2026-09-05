# Fase 1 — Índice + Thumbnails + Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para rastreio.

**Goal:** Dar ao veditbox um índice de metadados persistente (`index.json`), um cache de thumbnails gerado por ffmpeg, e um grid que renderiza só `<img>` — o alicerce de que as Fases 2 e 3 dependem.

**Architecture:** Três módulos novos e independentes. `src/utils/media-kinds.js` é lógica pura (categoria pela extensão, data pelo nome) e roda em Node puro, então é testável por script. `src/renderer/lib/media-index.js` lê/reconcilia/grava `~/veditbox/.veditbox/index.json` com escrita atômica (tmp + rename) e é a única porta de entrada para metadados. `src/renderer/lib/thumbs.js` gera JPEGs de 320px em `/tmp/veditbox/` chamando o binário do `@ffmpeg-installer` via `execFile`, com no máximo 4 processos simultâneos. `src/renderer/lib/library.js` é reescrito para consumir os três: toda célula vira `<img>` do thumb, um único `IntersectionObserver` dispara o próximo lote de ~60 itens **e** a geração de thumb, e o `<video>` só existe no item sob o cursor.

**Tech Stack:** Electron 33, CommonJS, JS puro. Zero dependência nova. `fs`, `path`, `child_process.execFile`, `IntersectionObserver`. ffmpeg vem de `@ffmpeg-installer/ffmpeg`, já em `package.json`.

**Spec:** `docs/superpowers/specs/2026-09-05-veditbox-gerenciador-midias-design.md` (§3, §4, §5, §6). Leia o design doc antes de executar: ele registra o que foi descartado e por quê.

## Global Constraints

- **Nenhuma dependência nova.** Nem npm, nem CDN. Ver §2.2 e §9 do design.
- **Sem framework de teste.** Verificação é script Node com `assert` (lógica pura) ou instrumentação temporária de `src/main/index.js` com `executeJavaScript` (fluxo de UI), sempre revertida. Ver §12.
- **Verificar rodando, não compilando.** Nenhum passo é considerado feito por "o require não quebrou".
- **Estilo:** sem ponto e vírgula, aspas simples/backticks, CommonJS (`require`). Segue `.prettierrc`.
- **Filesystem vence sempre.** O índice nunca cria, renomeia ou apaga arquivo em `~/veditbox`. Ver §2.1.
- **Não armazenar o que é derivável.** Só `url`, `titulo`, `tags`, `notes`, `largura`, `altura` vão para o JSON. Tipo, data e domínio são derivados em runtime. Ver §2.4 e §3.
- **O app nunca escreve em `tags`.** Nem na adoção de órfão. Ver §4.
- **Thumbs ficam fora de `~/veditbox`.** `/tmp/veditbox/`, 320px. A pasta da biblioteca é sincronizada (nesta máquina ela é um symlink para o Google Drive) e thumb é regenerável. Ver §5.
- **Fronteira de fase:** esta fase não implementa seleção múltipla, delete, undo, busca, tags na UI, nem Franken UI. Deixe os ganchos, não construa os consumidores.

## Pré-requisitos

`node_modules` não existe nesta worktree. Antes da Task 1:

```bash
yarn
node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)"
```

O segundo comando deve imprimir um caminho existente. Se falhar, pare: toda a Task 4 depende dele.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/utils/media-kinds.js` | **Criar.** Lógica pura: `categoryOf(nome)`, `dateFromName(nome)`, `CATEGORIES`. Sem `electron`, sem `fs` — roda em Node puro. |
| `src/renderer/lib/media-index.js` | **Criar.** Store do `index.json`: carregar, reconciliar, ler, gravar (atômico). Única porta para metadados. |
| `src/renderer/lib/thumbs.js` | **Criar.** Cache de thumbnails em `/tmp/veditbox/`, fila com limite de 4 processos ffmpeg. |
| `src/renderer/lib/library.js` | **Reescrever.** Grid de `<img>`, lote incremental, hover com `<video>`, preview. |
| `src/renderer/index.js` | **Modificar.** Chamar a reconciliação no boot, antes de montar a UI. |
| `src/renderer/lib/file/index.js` | **Modificar.** Registrar a url de origem depois de cada colagem bem-sucedida. |
| `src/renderer/lib/file/ImageFile.js` | **Modificar.** 1 linha: gravar dimensões quando o `<img>` carrega. |
| `src/renderer/lib/file/VideoFile.js` | **Modificar.** 1 linha: gravar dimensões quando o `<video>` carrega. |
| `src/renderer/styles/index.css` | **Modificar.** Estilos do overlay de hover e do sentinel. |
| `scripts/check-media-kinds.js` | **Criar.** Asserções de lógica pura. |
| `scripts/check-media-index.js` | **Criar.** Asserções do store + reconciliação, em pasta temporária. |
| `version.md` | **Modificar.** Registrar a mudança (convenção do AGENTS.md). |

---

## Contrato de integração (Fases 2 e 3 dependem disto)

Esta seção é normativa. As Fases 2 e 3 codificam contra estas assinaturas.

### `src/utils/media-kinds.js`

```js
CATEGORIES                    // { image: ['.png',...], gif, video, audio }
categoryOf(nome)              // 'image'|'gif'|'video'|'audio'|undefined
dateFromName(nome)            // Date | null  (null = usar mtime)
```

### `src/renderer/lib/media-index.js`

```js
// Chamado UMA vez no boot. Lê o JSON, reconcilia contra a pasta, grava se mudou.
// Síncrono de propósito: a UI não deve montar antes do índice existir.
reconcile()                   // -> { adotados: Number, podados: Number }

// Leitura. Devolve OBJETOS DERIVADOS (não o cru do JSON).
getAll()                      // -> MediaItem[]  ordenado: mais novo primeiro
get(nome)                     // -> MediaItem | undefined

// Escrita. Merge parcial no campo cru; grava atomicamente.
// Ignora chaves fora do schema. Nunca cria arquivo em ~/veditbox.
setEntry(nome, patch)         // -> MediaItem     patch: { url?, titulo?, tags?, notes?, largura?, altura? }
removeEntry(nome)             // -> void          (Fase 2 chama isso ao deletar)
addEntry(nome)                // -> MediaItem     (adota um arquivo recém-criado sem reconciliar tudo)

INDEX_PATH                    // string, ~/veditbox/.veditbox/index.json
```

**MediaItem** — a forma que o grid, a busca e a barra de seleção consomem:

```js
{
  name:     '20260905T144341144Z.mp4',   // chave; nome do arquivo
  filePath: '/Users/…/veditbox/2026…mp4',
  category: 'video',                     // derivado da extensão
  date:     Date,                        // derivado do nome; fallback mtime
  domain:   'www.facebook.com',          // derivado da url; '' se sem origem
  url:      'https://…',                 // '' = órfão / sem origem
  titulo:   '',
  tags:     [],
  notes:    '',
  largura:  720,                         // 0 se desconhecido
  altura:   1280,                        // 0 se desconhecido
}
```

### `src/renderer/lib/thumbs.js`

```js
thumbPath(nome)               // -> '/tmp/veditbox/<nome>.jpg'  (não gera nada)
getThumb(item)                // -> Promise<string>  caminho a usar em <img src>.
                              //    Gera se faltando ou mais velho que o arquivo.
                              //    Em qualquer falha, resolve com item.filePath (fallback).
                              //    Nunca rejeita.
deleteThumb(nome)             // -> void  (Fase 2 chama isso ao deletar)
```

### `src/renderer/lib/library.js`

```js
showLibrary(tab)              // monta o grid da aba ('download' = tudo)
showHome()
renderGrid(items, tab)        // monta o grid a partir de um array arbitrário.
                              //   Fase 3 passa o resultado da busca aqui.
getRenderedItems()            // -> Map<name, { el: HTMLElement, item: MediaItem }>
                              //   só o que já foi montado (lotes carregados até agora)
cellHooks                     // Array<(el, item) => void>. Rodado uma vez por
                              //   célula, logo após ela entrar no DOM.
                              //   Fase 2 empurra o checkbox aqui.
                              //   Fase 3 empurra os pills de tag aqui.
refresh()                     // remonta a aba atual preservando o scroll
```

Além disso, **cada célula carrega `data-name` com o nome do arquivo**. É por aí que a Fase 2 mapeia clique → item sem depender do índice do array.

---

### Task 1: Lógica pura — categoria e data

**Files:**
- Create: `src/utils/media-kinds.js`
- Test: `scripts/check-media-kinds.js`

**Interfaces:**
- Consumes: nada.
- Produces: `CATEGORIES`, `categoryOf(nome) -> string|undefined`, `dateFromName(nome) -> Date|null`. Tasks 2, 5 e a Fase 3 usam.

- [ ] **Step 1: Escrever o script de verificação que falha**

Create `scripts/check-media-kinds.js`:

```js
const assert = require('assert')
const { categoryOf, dateFromName } = require('../src/utils/media-kinds')

assert.equal(categoryOf('a.PNG'), 'image', 'extensao maiuscula')
assert.equal(categoryOf('a.jpeg'), 'image')
assert.equal(categoryOf('a.gif'), 'gif', 'gif nao e image')
assert.equal(categoryOf('a.mp4'), 'video')
assert.equal(categoryOf('a.wav'), 'audio')
assert.equal(categoryOf('index.json'), undefined, 'nao-midia')
assert.equal(categoryOf('.DS_Store'), undefined, 'dotfile sem extensao conhecida')
assert.equal(categoryOf('sem-extensao'), undefined)

// nome gerado por CONSTANTS: new Date().toJSON().replace(/\W/g, '')
const d = dateFromName('20260905T144341144Z.mp4')
assert.equal(d.toISOString(), '2026-09-05T14:43:41.144Z')

// arquivo real da pasta do usuario
assert.equal(
  dateFromName('20241123T095133225Z.mp4').toISOString(),
  '2024-11-23T09:51:33.225Z',
)

assert.equal(dateFromName('foto-de-ferias.jpg'), null, 'arquivo de fora -> mtime')
assert.equal(dateFromName('2026.png'), null, 'prefixo parcial nao conta')
assert.equal(dateFromName('20261399T999999999Z.png'), null, 'data invalida -> null')

console.log('check-media-kinds: OK')
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node scripts/check-media-kinds.js
```

Esperado: `Error: Cannot find module '../src/utils/media-kinds'`.

- [ ] **Step 3: Implementar**

Create `src/utils/media-kinds.js`:

```js
const path = require('path')

const CATEGORIES = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg'],
  gif: ['.gif'],
  video: ['.mp4', '.webm', '.mov'],
  audio: ['.wav', '.mp3', '.m4a'],
}

const categoryOf = (nome) => {
  const ext = path.extname(nome).toLowerCase()
  return Object.keys(CATEGORIES).find((c) => CATEGORIES[c].includes(ext))
}

// O nome vem de `new Date().toJSON().replace(/\W/g, '')`. Arquivo que o usuario
// trouxe de fora nao casa: devolve null e quem chama usa o mtime.
const dateFromName = (nome) => {
  const m = nome.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z/)
  if (!m) return null
  const [, a, mes, d, h, min, s, ms] = m
  const data = new Date(`${a}-${mes}-${d}T${h}:${min}:${s}.${ms}Z`)
  return Number.isNaN(data.getTime()) ? null : data
}

module.exports = { CATEGORIES, categoryOf, dateFromName }
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node scripts/check-media-kinds.js
```

Esperado: `check-media-kinds: OK`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/media-kinds.js scripts/check-media-kinds.js
git commit -m "feat: extrai categoria e data derivada para media-kinds"
```

---

### Task 2: Store do índice com escrita atômica e reconciliação

**Files:**
- Create: `src/renderer/lib/media-index.js`
- Test: `scripts/check-media-index.js`

**Interfaces:**
- Consumes: `categoryOf`, `dateFromName` da Task 1. `CONSTANTS.destDownloadFolder` de `src/utils/constants.js`.
- Produces: `reconcile()`, `getAll()`, `get(nome)`, `setEntry(nome, patch)`, `addEntry(nome)`, `removeEntry(nome)`, `INDEX_PATH`. Assinaturas exatas na seção "Contrato de integração" acima. Tasks 3, 5, 6 e as Fases 2 e 3 usam.

**Nota de design:** o módulo precisa ser testável em Node puro (sem Electron), então ele lê a pasta de `CONSTANTS.destDownloadFolder` mas aceita override por `process.env.VEDITBOX_DIR`. É o gancho mínimo que torna o script de verificação possível sem mexer no `~/veditbox` real do usuário.

- [ ] **Step 1: Escrever o script de verificação que falha**

Create `scripts/check-media-index.js`:

```js
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veditbox-check-'))
process.env.VEDITBOX_DIR = dir

const store = require('../src/renderer/lib/media-index')

const escrever = (nome) => fs.writeFileSync(path.join(dir, nome), 'x')

// --- reconciliacao adota orfaos ---
escrever('20260905T144341144Z.mp4')
escrever('20260905T144342000Z.png')
escrever('index.json') // nao-midia: deve ser ignorado
let r = store.reconcile()
assert.equal(r.adotados, 2, 'adotou os dois arquivos de midia')
assert.equal(r.podados, 0)
assert.equal(store.getAll().length, 2, 'index.json nao virou item')
assert.equal(store.get('20260905T144341144Z.mp4').url, '', 'orfao nasce sem url')
assert.deepEqual(store.get('20260905T144341144Z.mp4').tags, [], 'app nao escreve em tags')

// --- derivacoes ---
const item = store.get('20260905T144341144Z.mp4')
assert.equal(item.category, 'video')
assert.equal(item.date.toISOString(), '2026-09-05T14:43:41.144Z')
assert.equal(item.domain, '', 'sem url -> sem dominio')
assert.equal(item.filePath, path.join(dir, '20260905T144341144Z.mp4'))

// --- ordenacao: mais novo primeiro ---
assert.equal(store.getAll()[0].name, '20260905T144342000Z.png')

// --- escrita e dominio derivado ---
store.setEntry('20260905T144341144Z.mp4', {
  url: 'https://www.facebook.com/reel/892819649954687',
  titulo: 'reel',
})
assert.equal(store.get('20260905T144341144Z.mp4').domain, 'www.facebook.com')
assert.equal(store.get('20260905T144341144Z.mp4').titulo, 'reel')

// --- nao armazena o que e derivavel ---
const cru = JSON.parse(fs.readFileSync(store.INDEX_PATH, 'utf8'))
const campos = Object.keys(cru['20260905T144341144Z.mp4']).sort()
assert.deepEqual(
  campos,
  ['altura', 'largura', 'notes', 'tags', 'titulo', 'url'],
  'schema so tem os 6 campos do §3',
)

// --- patch com chave fora do schema e ignorado ---
store.setEntry('20260905T144341144Z.mp4', { category: 'audio', lixo: 1 })
const cru2 = JSON.parse(fs.readFileSync(store.INDEX_PATH, 'utf8'))
assert.equal(cru2['20260905T144341144Z.mp4'].category, undefined)
assert.equal(cru2['20260905T144341144Z.mp4'].lixo, undefined)

// --- escrita atomica: nao sobra .tmp ---
assert.ok(
  !fs.existsSync(store.INDEX_PATH + '.tmp'),
  'o tmp foi renomeado, nao deixado para tras',
)

// --- reconciliacao poda entrada morta e preserva metadado de quem sobrou ---
fs.unlinkSync(path.join(dir, '20260905T144342000Z.png'))
escrever('20260905T144343000Z.wav')
r = store.reconcile()
assert.equal(r.podados, 1)
assert.equal(r.adotados, 1)
assert.equal(store.get('20260905T144342000Z.png'), undefined, 'podado')
assert.equal(
  store.get('20260905T144341144Z.mp4').titulo,
  'reel',
  'metadado do sobrevivente preservado',
)

// --- filesystem vence: reconciliar nunca cria nem apaga arquivo ---
const antes = fs.readdirSync(dir).sort()
store.reconcile()
assert.deepEqual(fs.readdirSync(dir).sort(), antes, 'a pasta nao foi tocada')

// --- json corrompido nao derruba o app ---
fs.writeFileSync(store.INDEX_PATH, '{ isso nao e json')
r = store.reconcile()
assert.equal(r.adotados, 2, 'recomeca do zero adotando tudo que existe')

// --- removeEntry ---
store.removeEntry('20260905T144341144Z.mp4')
assert.equal(store.get('20260905T144341144Z.mp4'), undefined)
assert.ok(
  fs.existsSync(path.join(dir, '20260905T144341144Z.mp4')),
  'removeEntry mexe no indice, NAO no arquivo',
)

// --- addEntry: adota um arquivo novo sem varrer a pasta ---
escrever('20260905T144344000Z.jpg')
const novo = store.addEntry('20260905T144344000Z.jpg')
assert.equal(novo.category, 'image')
assert.equal(novo.url, '')

// --- arquivo de fora: data vem do mtime ---
escrever('foto-de-ferias.jpg')
store.reconcile()
const deFora = store.get('foto-de-ferias.jpg')
assert.ok(deFora.date instanceof Date && !Number.isNaN(deFora.date.getTime()))

// --- url invalida nao explode a derivacao de dominio ---
store.setEntry('foto-de-ferias.jpg', { url: 'nao e uma url' })
assert.equal(store.get('foto-de-ferias.jpg').domain, '')

fs.rmSync(dir, { recursive: true, force: true })
console.log('check-media-index: OK')
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node scripts/check-media-index.js
```

Esperado: `Cannot find module '../src/renderer/lib/media-index'`.

- [ ] **Step 3: Implementar**

Create `src/renderer/lib/media-index.js`:

```js
const fs = require('fs')
const path = require('path')

const { CONSTANTS } = require('../../utils/constants')
const { categoryOf, dateFromName } = require('../../utils/media-kinds')

// VEDITBOX_DIR existe para os scripts de verificacao rodarem numa pasta
// descartavel. Em producao ninguem define, e vale a pasta real.
const LIB_DIR = process.env.VEDITBOX_DIR || CONSTANTS.destDownloadFolder
const META_DIR = path.join(LIB_DIR, '.veditbox')
const INDEX_PATH = path.join(META_DIR, 'index.json')

// §2.4: so entra aqui o que NAO da pra derivar. Tipo, data e dominio ficam de fora.
const CAMPOS = ['url', 'titulo', 'tags', 'notes', 'largura', 'altura']

const entradaVazia = () => ({
  url: '',
  titulo: '',
  tags: [],
  notes: '',
  largura: 0,
  altura: 0,
})

let dados = {} // { nome: entradaCrua }

function ler() {
  try {
    const cru = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'))
    // ponytail: aceita qualquer objeto; campo faltando cai no default
    return cru && typeof cru === 'object' ? cru : {}
  } catch (error) {
    // arquivo ausente ou corrompido. O filesystem e a fonte de verdade
    // (§2.1), entao perder o indice custa metadado, nunca midia.
    return {}
  }
}

// §4: tmp + rename. rename e atomico no mesmo volume, entao uma queda no meio
// preserva o indice anterior em vez de deixar um json pela metade.
function gravar() {
  fs.mkdirSync(META_DIR, { recursive: true })
  const tmp = INDEX_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 2))
  fs.renameSync(tmp, INDEX_PATH)
}

const normalizar = (entrada) => {
  const saida = entradaVazia()
  CAMPOS.forEach((campo) => {
    if (entrada && entrada[campo] !== undefined) saida[campo] = entrada[campo]
  })
  if (!Array.isArray(saida.tags)) saida.tags = []
  return saida
}

const dominioDe = (url) => {
  try {
    return new URL(url).hostname
  } catch (error) {
    return ''
  }
}

function derivar(nome) {
  const filePath = path.join(LIB_DIR, nome)
  let date = dateFromName(nome)
  if (!date) {
    // arquivo que o usuario trouxe de fora: sem timestamp no nome
    try {
      date = fs.statSync(filePath).mtime
    } catch (error) {
      date = new Date(0)
    }
  }
  const entrada = dados[nome]
  return {
    name: nome,
    filePath,
    category: categoryOf(nome),
    date,
    domain: dominioDe(entrada.url),
    ...entrada,
  }
}

const arquivosDeMidia = () => {
  try {
    return fs.readdirSync(LIB_DIR).filter((nome) => categoryOf(nome))
  } catch (error) {
    return []
  }
}

// §4: roda so na abertura. Sem watcher. A pasta sempre vence.
function reconcile() {
  dados = ler()
  const naPasta = arquivosDeMidia()
  let adotados = 0
  let podados = 0

  naPasta.forEach((nome) => {
    if (!dados[nome]) {
      // orfao: adota com url vazia. NAO recebe tag automatica — o app nunca
      // escreve em tags, senao o usuario apagar a tag viraria disputa.
      dados[nome] = entradaVazia()
      adotados++
    } else {
      dados[nome] = normalizar(dados[nome])
    }
  })

  const conhecidos = new Set(naPasta)
  Object.keys(dados).forEach((nome) => {
    if (!conhecidos.has(nome)) {
      delete dados[nome]
      podados++
    }
  })

  if (adotados || podados) gravar()
  return { adotados, podados }
}

// nome > antigo primeiro na comparacao invertida: o nome e timestamp, entao
// ordenar por nome descendente ja e "mais novo primeiro" para os arquivos do app.
// Para os de fora usamos a data derivada, que cobre os dois casos.
const getAll = () =>
  Object.keys(dados)
    .map(derivar)
    .sort((a, b) => b.date - a.date || b.name.localeCompare(a.name))

const get = (nome) => (dados[nome] ? derivar(nome) : undefined)

function setEntry(nome, patch) {
  if (!dados[nome]) dados[nome] = entradaVazia()
  CAMPOS.forEach((campo) => {
    if (patch && patch[campo] !== undefined) dados[nome][campo] = patch[campo]
  })
  gravar()
  return derivar(nome)
}

function addEntry(nome) {
  if (!dados[nome]) {
    dados[nome] = entradaVazia()
    gravar()
  }
  return derivar(nome)
}

function removeEntry(nome) {
  if (!dados[nome]) return
  delete dados[nome]
  gravar()
}

module.exports = {
  INDEX_PATH,
  reconcile,
  getAll,
  get,
  setEntry,
  addEntry,
  removeEntry,
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node scripts/check-media-index.js
```

Esperado: `check-media-index: OK`. Se algo falhar, o `assert` diz qual invariante quebrou — conserte a implementação, não a asserção.

- [ ] **Step 5: Verificar contra a pasta real do usuário, sem escrever nela**

O `~/veditbox` real tem ~91 arquivos e é um symlink para uma pasta sincronizada. Copie só os **nomes** para uma pasta descartável e reconcilie lá:

```bash
node -e "
const fs=require('fs'),os=require('os'),path=require('path')
const real=require('os').homedir()+'/veditbox'
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veditbox-real-'))
fs.readdirSync(real).forEach(n=>{ try{ fs.writeFileSync(path.join(dir,n),'') }catch(e){} })
process.env.VEDITBOX_DIR=dir
const s=require('./src/renderer/lib/media-index')
console.log(s.reconcile())
const all=s.getAll()
console.log('itens:',all.length)
console.log('sem data derivada do nome:',all.filter(i=>!/^\d{8}T/.test(i.name)).map(i=>i.name))
console.log('categorias:',[...new Set(all.map(i=>i.category))])
console.log('3 mais novos:',all.slice(0,3).map(i=>i.name))
fs.rmSync(dir,{recursive:true,force:true})
"
```

Esperado: `adotados` igual ao número de arquivos de mídia, `podados: 0`, nenhuma categoria `undefined`, e os mais novos no topo. Se aparecer nome inesperado na lista "sem data derivada", confira se é mesmo arquivo de fora — se for arquivo gerado pelo app, o regex da Task 1 está errado.

- [ ] **Step 6: Confirmar que a pasta real não foi tocada**

```bash
/bin/ls -1 "$HOME/veditbox/.veditbox" 2>&1
```

Esperado: `No such file or directory`. Nenhum passo até aqui pode ter criado nada em `~/veditbox`.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/lib/media-index.js scripts/check-media-index.js
git commit -m "feat: store do index.json com escrita atomica e reconciliacao na abertura"
```

---

### Task 3: Ligar o índice ao boot e gravar a url de origem

**Files:**
- Modify: `src/renderer/index.js:5` (logo depois do `create-download-directory`)
- Modify: `src/renderer/lib/file/index.js:68-71` (dentro do `try` de `handlePaste`)

**Interfaces:**
- Consumes: `reconcile()`, `addEntry()`, `setEntry()` da Task 2.
- Produces: garante que, quando a Task 5 rodar, `getAll()` já esteja povoado. Nenhuma API nova.

**Por que aqui e não em `ImageFile`/`VideoFile`:** a url que interessa é **a que o usuário colou** (`https://www.facebook.com/reel/…`), não a url de mídia intermediária. Na rota `ytDlp`, `handlers.mp4(filePath)` substitui a url pelo caminho local, e no fallback `findPageMedia` ela vira a url do `og:image`. Em ambos os casos a url de origem já se perdeu quando chega no model. `handlePaste` é o único ponto por onde as três rotas passam com a url original em mãos — um lugar só, em vez de um remendo por rota.

- [ ] **Step 1: Reconciliar no boot**

Em `src/renderer/index.js`, logo após a linha `require('../utils/create-download-directory').create()`:

```js
// indice de metadados: reconcilia com a pasta antes de qualquer UI montar (§4)
require('./lib/media-index').reconcile()
```

- [ ] **Step 2: Registrar a url de origem depois da colagem**

Em `src/renderer/lib/file/index.js`, adicione o require no topo:

```js
const mediaIndex = require('../media-index.js')
```

e troque o corpo do `try` em `handlePaste`:

```js
  try {
    setTab('download')
    showStatus('Baixando...')
    const result = await getHandlers(url)[handlerName]()
    const handle = await processHandler(result)
    // A url que vale e a que o usuario colou. Nas rotas ytDlp/findPageMedia ela
    // ja foi trocada por caminho local ou por url de og:image la dentro, entao
    // gravar aqui e o unico ponto que ve a origem verdadeira.
    if (handle && handle.name) {
      mediaIndex.setEntry(require('path').basename(handle.name), { url })
    }
    // o handler pode corrigir a aba (ex: url de video que na verdade era imagem)
    setTab(result.tab || tab)
  } catch (error) {
```

Mova o `require('path')` para o topo do arquivo em vez de inline:

```js
const path = require('path')
```

e use `path.basename(handle.name)`.

- [ ] **Step 3: Adotar arquivo colado sem url**

Ainda em `handlePaste`, no ramo de arquivo colado (sem url):

```js
  if (typeof urlOrFile !== 'string') {
    setTab('image')
    const handle = await processHandler(getHandlers(null).image(urlOrFile))
    if (handle && handle.name) mediaIndex.addEntry(path.basename(handle.name))
    return
  }
```

`processHandler` já retorna `handle.generate()`, que resolve com o próprio handle — confira que a linha `return handle.generate()` continua no fim de `processHandler`.

- [ ] **Step 4: Verificar rodando o app com instrumentação**

Adicione **temporariamente** ao final de `src/main/index.js`:

```js
// INSTRUMENTACAO TEMPORARIA — REMOVER
if (process.env.VEDITBOX_PROBE) {
  app.whenReady().then(async () => {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
    const out = await win.webContents.executeJavaScript(`
      (() => {
        const s = require('./lib/media-index')
        const all = s.getAll()
        return JSON.stringify({
          total: all.length,
          semCategoria: all.filter(i => !i.category).length,
          topo: all.slice(0, 3).map(i => i.name),
          comUrl: all.filter(i => i.url).length,
        })
      })()
    `)
    console.log('PROBE', out)
  })
}
```

Rode:

```bash
VEDITBOX_PROBE=1 yarn start
```

Esperado no terminal: `PROBE {"total":91,...}` (ou o número real de arquivos de mídia em `~/veditbox`), `semCategoria: 0`.

- [ ] **Step 5: Verificar que o índice real foi criado corretamente**

```bash
/bin/ls -la "$HOME/veditbox/.veditbox/"
node -e "const d=require(require('os').homedir()+'/veditbox/.veditbox/index.json'); const k=Object.keys(d); console.log('entradas:',k.length); console.log(k[0], d[k[0]])"
```

Esperado: existe `index.json`, **não existe** `index.json.tmp`, e a primeira entrada tem exatamente os 6 campos do schema com `url: ''`.

- [ ] **Step 6: Verificar a gravação da url colando de verdade**

Com o app aberto (`yarn start`), cole uma url de vídeo (ex: um reel do Facebook ou um link do Pexels). Depois:

```bash
node -e "
const d=require(require('os').homedir()+'/veditbox/.veditbox/index.json')
const comUrl=Object.entries(d).filter(([,v])=>v.url)
console.log(comUrl)
"
```

Esperado: aparece a entrada do arquivo recém-baixado com a **url que você colou** — não o caminho `/Users/…/veditbox/….mp4`, não uma url de `og:image`. Se aparecer um caminho local, a gravação ficou no lugar errado.

- [ ] **Step 7: Reverter a instrumentação**

```bash
git diff src/main/index.js
```

Remova o bloco `VEDITBOX_PROBE` inteiro. Confirme:

```bash
git diff --stat src/main/index.js
```

Esperado: sem saída (arquivo idêntico ao HEAD).

- [ ] **Step 8: Commit**

```bash
git add src/renderer/index.js src/renderer/lib/file/index.js
git commit -m "feat: reconcilia indice no boot e grava url de origem da colagem"
```

---

### Task 4: Cache de thumbnails com ffmpeg

**Files:**
- Create: `src/renderer/lib/thumbs.js`

**Interfaces:**
- Consumes: `MediaItem` da Task 2 (usa `name`, `filePath`, `category`). `require('@ffmpeg-installer/ffmpeg').path`.
- Produces: `thumbPath(nome) -> string`, `getThumb(item) -> Promise<string>`, `deleteThumb(nome) -> void`. A Task 5 consome; a Fase 2 chama `deleteThumb` ao apagar.

**Decisões que o executor não deve reabrir:**
- `execFile` no binário direto, não `fluent-ffmpeg`. `fluent-ffmpeg` já está no projeto, mas para *um* comando fixo ele só adiciona uma camada — `execFile` é a rung mais alta que resolve.
- Filtro `thumbnail` em vez de `-ss N`. `-ss 1` produz saída vazia em clipe de menos de 1s, e `-ss 0` costuma pegar frame preto. O filtro `thumbnail` escolhe um frame representativo entre os primeiros e nunca falha por duração.
- `getThumb` **nunca rejeita**. Em qualquer erro devolve `item.filePath`. SVG e AVIF podem não passar pelo ffmpeg, e o `<img>` do Chromium renderiza os dois nativamente — o fallback resolve os dois casos com um `catch`.

- [ ] **Step 1: Medir o custo real antes de escrever o módulo**

O design mediu 0,02s/arquivo. O filtro `thumbnail` decodifica mais frames que um seek. Meça antes de assumir:

```bash
node -e "
const {execFileSync}=require('child_process')
const fs=require('fs'),path=require('path'),os=require('os')
const ff=require('@ffmpeg-installer/ffmpeg').path
const dir=os.homedir()+'/veditbox'
const out=fs.mkdtempSync(path.join(os.tmpdir(),'thumbcheck-'))
const files=fs.readdirSync(dir).filter(n=>/\.(mp4|webm|mov|png|jpe?g|gif|webp)$/i.test(n))
const t=Date.now()
let ok=0, fail=[]
files.forEach(n=>{
  try{
    execFileSync(ff,['-v','error','-i',path.join(dir,n),'-vf','thumbnail,scale=320:-1','-frames:v','1','-y',path.join(out,n+'.jpg')],{stdio:'pipe'})
    ok++
  }catch(e){ fail.push(n) }
})
console.log('arquivos:',files.length,'ok:',ok,'falhas:',fail)
console.log('total:',((Date.now()-t)/1000).toFixed(1)+'s','media:',((Date.now()-t)/files.length/1000).toFixed(3)+'s')
const bytes=fs.readdirSync(out).reduce((a,f)=>a+fs.statSync(path.join(out,f)).size,0)
console.log('tamanho medio:',(bytes/ok/1024).toFixed(0)+'KB')
fs.rmSync(out,{recursive:true,force:true})
"
```

Anote o resultado. Se a média passar de ~0,15s por arquivo, troque `thumbnail` por `-ss 1` **antes** do `-i`, com retry sem `-ss` quando a saída sair vazia, e registre o motivo num comentário. Se as falhas incluírem só `.svg`/`.avif`, está previsto — é o que o fallback cobre.

- [ ] **Step 2: Implementar**

Create `src/renderer/lib/thumbs.js`:

```js
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile } = require('child_process')

const { path: ffmpegPath } = require('@ffmpeg-installer/ffmpeg')

// §5: fora de ~/veditbox de proposito. A biblioteca e sincronizada e thumb e
// regeneravel — nao vale gastar cota sincronizando ~42MB que o ffmpeg refaz.
// O macOS limpa /tmp periodicamente; aceito, geracao e preguicosa e barata.
const CACHE_DIR = path.join(os.tmpdir(), 'veditbox')

const MAX_SIMULTANEOS = 4

let rodando = 0
const fila = []
const emVoo = new Map() // nome -> Promise, evita gerar o mesmo thumb duas vezes

const thumbPath = (nome) => path.join(CACHE_DIR, nome + '.jpg')

// §5: thumb mais velho que o arquivo -> regenera. Usa mtime, sem guardar estado.
function estaFresco(item) {
  try {
    return fs.statSync(thumbPath(item.name)).mtimeMs >= fs.statSync(item.filePath).mtimeMs
  } catch (error) {
    return false
  }
}

function proximo() {
  if (rodando >= MAX_SIMULTANEOS || !fila.length) return
  rodando++
  const { item, resolver } = fila.shift()
  const destino = thumbPath(item.name)

  // filtro `thumbnail` em vez de `-ss N`: -ss 1 devolve saida vazia em clipe
  // curto e -ss 0 costuma pegar frame preto. Aqui nunca falha por duracao.
  // ponytail: decodifica ~100 frames; se doer em video 4K, trocar por seek.
  const args = [
    '-v', 'error',
    '-i', item.filePath,
    '-vf', 'thumbnail,scale=320:-1',
    '-frames:v', '1',
    '-y', destino,
  ]

  execFile(ffmpegPath, args, (erro) => {
    rodando--
    // Falha e esperada em svg/avif, que o ffmpeg pode nao decodificar mas o
    // Chromium renderiza nativamente. Um fallback cobre os dois casos.
    const deuCerto = !erro && fs.existsSync(destino) && fs.statSync(destino).size > 0
    resolver(deuCerto ? destino : item.filePath)
    proximo()
  })
}

function getThumb(item) {
  // audio nao tem quadro; a celula usa o icone ♪ (§6)
  if (!item || item.category === 'audio') return Promise.resolve('')

  if (estaFresco(item)) return Promise.resolve(thumbPath(item.name))
  if (emVoo.has(item.name)) return emVoo.get(item.name)

  fs.mkdirSync(CACHE_DIR, { recursive: true })

  const promessa = new Promise((resolver) => {
    fila.push({ item, resolver })
    proximo()
  }).then((caminho) => {
    emVoo.delete(item.name)
    return caminho
  })

  emVoo.set(item.name, promessa)
  return promessa
}

function deleteThumb(nome) {
  try {
    fs.unlinkSync(thumbPath(nome))
  } catch (error) {
    // thumb nao existia: nada a fazer
  }
}

module.exports = { CACHE_DIR, thumbPath, getThumb, deleteThumb }
```

- [ ] **Step 3: Verificar geração, limite de 4 e invalidação — rodando no app**

`thumbs.js` requer `@ffmpeg-installer`, que só resolve no contexto do Electron empacotado; rode via instrumentação. Adicione **temporariamente** ao final de `src/main/index.js` o mesmo bloco `VEDITBOX_PROBE` da Task 3, com este corpo de `executeJavaScript`:

```js
      (async () => {
        const store = require('./lib/media-index')
        const thumbs = require('./lib/thumbs')
        const fs = require('fs')

        const itens = store.getAll().filter(i => i.category !== 'audio')
        const t = Date.now()
        const caminhos = await Promise.all(itens.map(i => thumbs.getThumb(i)))
        const gerados = caminhos.filter(c => c.startsWith(thumbs.CACHE_DIR))
        const fallback = caminhos.filter(c => !c.startsWith(thumbs.CACHE_DIR))

        // invalidacao: envelhece um thumb e confere que regenera
        const alvo = itens.find(i => i.category === 'video')
        const p = thumbs.thumbPath(alvo.name)
        fs.utimesSync(p, new Date(0), new Date(0))
        const antes = fs.statSync(p).mtimeMs
        await thumbs.getThumb(alvo)
        const depois = fs.statSync(p).mtimeMs

        return JSON.stringify({
          itens: itens.length,
          gerados: gerados.length,
          fallback: fallback.map(c => c.split('/').pop()),
          segundos: ((Date.now() - t) / 1000).toFixed(1),
          regenerou: depois > antes,
        })
      })()
```

```bash
rm -rf /tmp/veditbox
VEDITBOX_PROBE=1 yarn start
```

Esperado: `gerados` cobre quase tudo, `fallback` só com `.svg`/`.avif` (ou vazio), `regenerou: true`. Se `regenerou` for `false`, a checagem de `mtime` está invertida.

- [ ] **Step 4: Confirmar o limite de 4 processos**

Com o app rodando o probe do Step 3 (e o cache limpo), num outro terminal:

```bash
rm -rf /tmp/veditbox
VEDITBOX_PROBE=1 yarn start &
for i in $(seq 1 40); do pgrep -f 'ffmpeg' | wc -l; sleep 0.1; done
```

Esperado: a contagem nunca passa de 4. Se passar, `rodando` não está sendo incrementado antes do `execFile`.

- [ ] **Step 5: Conferir onde o cache ficou**

```bash
/bin/ls /tmp/veditbox | head -3
du -sh /tmp/veditbox
/bin/ls -a "$HOME/veditbox" | grep -i thumb
```

Esperado: thumbs em `/tmp/veditbox`, e **nada** de thumb em `~/veditbox` (o último comando não retorna nada).

- [ ] **Step 6: Reverter a instrumentação**

```bash
git diff --stat src/main/index.js
```

Esperado: sem saída.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/lib/thumbs.js
git commit -m "feat: cache de thumbnails 320px em /tmp via ffmpeg, max 4 processos"
```

---

### Task 5: Reescrever o grid

**Files:**
- Modify: `src/renderer/lib/library.js` (reescrita completa)
- Modify: `src/renderer/styles/index.css:207-253` (adiciona overlay de hover e sentinel)

**Interfaces:**
- Consumes: `getAll`, `get` (Task 2); `getThumb` (Task 4); `categoryOf` (Task 1).
- Produces: `showLibrary(tab)`, `showHome()`, `renderGrid(items, tab)`, `getRenderedItems() -> Map<name, {el, item}>`, `cellHooks: Array<(el, item) => void>`, `refresh()`. Assinaturas na seção "Contrato de integração". **A Fase 2 e a Fase 3 codificam contra isto.**

**O que muda e por quê (§6):** hoje cada vídeo vira `<video preload="metadata">` — N decoders instanciados, e é isso que trava. Agora toda célula é `<img>` do thumb; o `<video>` só nasce no item sob o cursor, um por vez. O lote é de 60 itens, com um `IntersectionObserver` único que atende dois alvos: a sentinela no fim (pede o próximo lote) e cada célula (gera o thumb). Uma peça, duas necessidades.

- [ ] **Step 1: Reescrever `library.js`**

Substitua `src/renderer/lib/library.js` inteiro:

```js
const { ipcRenderer } = require('electron')

const { ELEMENTS } = require('../../utils/elements')
const { CONSTANTS } = require('../../utils/constants')
const { showStatus } = require('../../utils/show-status')
const { setTab } = require('../../utils/set-tab')
const mediaIndex = require('./media-index')
const { getThumb } = require('./thumbs')

const mainArea = ELEMENTS.mainArea

const LOTE = 60

// Gancho de extensao: roda uma vez por celula, logo apos ela entrar no DOM.
// Fase 2 empurra o checkbox de selecao aqui; Fase 3 empurra os pills de tag.
// Ficam num array em vez de um callback so porque ja sao dois consumidores.
const cellHooks = []

// Estado do grid montado. getRenderedItems() expoe isto para as fases 2 e 3.
let renderedItems = new Map()
let abaAtual = null
let observer = null
let hoverEl = null

const getRenderedItems = () => renderedItems

function pararObserver() {
  if (observer) observer.disconnect()
  observer = null
}

function trocarHoverPorImagem() {
  if (!hoverEl) return
  hoverEl.pause()
  hoverEl.remove()
  hoverEl = null
}

// §6: um <video> por vez, so no item sob o cursor. Padrao YouTube.
function ligarHover(el, item) {
  if (item.category !== 'video') return

  el.onmouseenter = () => {
    trocarHoverPorImagem()
    const video = document.createElement('video')
    video.src = `file://${item.filePath}`
    video.muted = true
    video.loop = true
    video.className = 'library-hover'
    el.appendChild(video)
    hoverEl = video
    video.play().catch(() => {})
  }

  el.onmouseleave = trocarHoverPorImagem
}

function criarCelula(item) {
  const el = document.createElement('div')
  el.className = 'library-item'
  el.dataset.name = item.name
  el.draggable = true
  el.title = item.name

  if (item.category === 'audio') {
    const icone = document.createElement('div')
    icone.className = 'library-audio'
    icone.textContent = '\u266a'
    el.appendChild(icone)
  } else {
    // §6: toda celula e <img>, inclusive video. Um tipo de elemento,
    // zero decodificacao no grid. src so entra quando o thumb chega.
    const img = new Image()
    img.className = 'library-thumb'
    el.appendChild(img)
  }

  el.ondragstart = (event) => {
    event.preventDefault()
    ipcRenderer.send('dragfile', item.filePath)
  }
  el.onclick = () => showPreview(item)

  ligarHover(el, item)

  renderedItems.set(item.name, { el, item })
  cellHooks.forEach((hook) => hook(el, item))
  return el
}

function renderGrid(items, tab) {
  pararObserver()
  trocarHoverPorImagem()
  resetActiveThing()
  mainArea.innerHTML = ''
  renderedItems = new Map()
  abaAtual = tab

  if (!items.length) {
    mainArea.innerHTML =
      '<p class="library-empty">Nada aqui ainda. Cole um link ou grave algo.</p>'
    showStatus('Paste image, url or use shortcuts do record audio/video')
    return
  }

  const grid = document.createElement('div')
  grid.className = 'library-grid'

  const sentinela = document.createElement('div')
  sentinela.className = 'library-sentinel'

  mainArea.appendChild(grid)
  grid.appendChild(sentinela)

  let proximo = 0

  // §6: um observer so. A sentinela pede o proximo lote, a celula pede o thumb.
  // Uma peca, duas necessidades — nao ha motivo para dois observers.
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return

        if (entry.target === sentinela) {
          montarLote()
          return
        }

        observer.unobserve(entry.target)
        const registro = renderedItems.get(entry.target.dataset.name)
        if (!registro || registro.item.category === 'audio') return

        getThumb(registro.item).then((caminho) => {
          const img = registro.el.querySelector('.library-thumb')
          if (img && caminho) img.src = `file://${caminho}`
        })
      })
    },
    { root: grid, rootMargin: '200px' },
  )

  function montarLote() {
    const fatia = items.slice(proximo, proximo + LOTE)
    proximo += fatia.length

    fatia.forEach((item) => {
      const el = criarCelula(item)
      grid.insertBefore(el, sentinela)
      observer.observe(el)
    })

    // Sem virtualizacao (§6, §11): carregamento incremental resolve. Quando
    // acabar, para de observar a sentinela para nao ficar disparando a toa.
    if (proximo >= items.length) observer.unobserve(sentinela)
  }

  observer.observe(sentinela)
  montarLote()

  showStatus(`${items.length} arquivo(s) em ${CONSTANTS.destDownloadFolder}`)
}

function showLibrary(tab) {
  setTab(tab)
  const items = mediaIndex
    .getAll()
    .filter((item) => tab === 'download' || item.category === tab)
  renderGrid(items, tab)
}

const refresh = () => {
  const scroll = mainArea.querySelector('.library-grid')?.scrollTop || 0
  showLibrary(abaAtual)
  const grid = mainArea.querySelector('.library-grid')
  if (grid) grid.scrollTop = scroll
}

// Logo = voltar pra home (tela vazia de paste), nenhuma aba ativa
function showHome() {
  pararObserver()
  trocarHoverPorImagem()
  resetActiveThing()
  mainArea.innerHTML = ''
  setTab(null)
  abaAtual = null
  renderedItems = new Map()
  showStatus('Paste image, url or use shortcuts do record audio/video')
}

document.querySelector('#menu h2').onclick = showHome

document.querySelectorAll('#menu li').forEach((li) => {
  li.onclick = () => showLibrary(li.dataset.tab)
})

function createPlayer(item) {
  const src = `file://${item.filePath}`

  if (item.category === 'audio') {
    const el = document.createElement('audio')
    el.src = src
    el.controls = true
    return el
  }

  if (item.category === 'video') {
    const el = document.createElement('video')
    el.src = src
    el.controls = true
    el.autoplay = true
    el.loop = true
    return el
  }

  const el = new Image()
  el.src = src
  return el
}

function showPreview(item) {
  const tab = abaAtual
  pararObserver()
  trocarHoverPorImagem()
  resetActiveThing()
  mainArea.innerHTML = ''

  const back = document.createElement('button')
  back.className = 'library-back'
  back.textContent = '\u2190 voltar'
  back.onclick = () => showLibrary(tab)

  const player = createPlayer(item)
  player.draggable = true
  player.ondragstart = (event) => {
    event.preventDefault()
    ipcRenderer.send('dragfile', item.filePath)
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'library-preview'
  wrapper.append(back, player)
  mainArea.appendChild(wrapper)

  showStatus(`${item.name} — arraste pra fora ou volte pra lista`)
}

module.exports = {
  showLibrary,
  showHome,
  renderGrid,
  getRenderedItems,
  refresh,
  cellHooks,
  showPreview,
}
```

- [ ] **Step 2: Estilos do overlay e da sentinela**

Em `src/renderer/styles/index.css`, logo depois do bloco `.library-audio` (linha ~252), adicione:

```css
/* o <video> de hover cobre o <img> em vez de substitui-lo: trocar o src
   causaria um flash branco entre o pause e o primeiro frame */
.library-hover {
  z-index: 1;
}

/* a sentinela ocupa a largura toda para o observer enxerga-la
   independentemente de quantas colunas o grid tiver */
.library-sentinel {
  grid-column: 1 / -1;
  height: 1px;
}
```

A regra existente `.library-item > *` (`position: absolute; inset: 0; object-fit: cover; pointer-events: none`) já cobre `.library-thumb` e `.library-hover` — não a duplique.

- [ ] **Step 3: Verificar o grid rodando — DOM real**

Adicione **temporariamente** ao final de `src/main/index.js` o bloco `VEDITBOX_PROBE` com este corpo:

```js
      (async () => {
        const lib = require('./lib/library')
        const espera = (ms) => new Promise(r => setTimeout(r, ms))

        lib.showLibrary('download')
        await espera(1500)

        const grid = document.querySelector('.library-grid')
        const conta = () => ({
          celulas: document.querySelectorAll('.library-item').length,
          videos: document.querySelectorAll('.library-item video').length,
          imgs: document.querySelectorAll('.library-thumb').length,
          comSrc: [...document.querySelectorAll('.library-thumb')].filter(i => i.src).length,
          registrados: lib.getRenderedItems().size,
        })

        const inicial = conta()

        // rola ate o fim para forcar os proximos lotes
        grid.scrollTop = grid.scrollHeight
        await espera(1500)
        const aposScroll = conta()

        // hover: um <video> aparece, e so um
        const alvo = [...document.querySelectorAll('.library-item')]
          .find(el => /\.(mp4|webm|mov)$/i.test(el.dataset.name))
        alvo.dispatchEvent(new MouseEvent('mouseenter'))
        await espera(300)
        const noHover = conta()
        alvo.dispatchEvent(new MouseEvent('mouseleave'))
        await espera(300)
        const posHover = conta()

        return JSON.stringify({ inicial, aposScroll, noHover, posHover })
      })()
```

```bash
rm -rf /tmp/veditbox
VEDITBOX_PROBE=1 yarn start
```

Critérios de aceite, todos obrigatórios:

| Medida | Esperado |
|---|---|
| `inicial.celulas` | ≤ 60 (o primeiro lote, ou o total se for menor) |
| `inicial.videos` | **0** — nenhum decoder no grid em repouso |
| `inicial.comSrc` | > 0 — thumbs chegaram e entraram no `<img>` |
| `aposScroll.celulas` | > `inicial.celulas` (se houver mais de 60 arquivos), até o total |
| `aposScroll.videos` | **0** |
| `noHover.videos` | **1** |
| `posHover.videos` | **0** |
| `registrados` | igual a `celulas` em toda medição |

Se `inicial.videos` for diferente de 0, a reescrita falhou no ponto central da §6.

Se a máquina tiver menos de 60 arquivos em `~/veditbox`, o lote incremental não é exercitado. Nesse caso, baixe `LOTE` para `5` temporariamente, repita a medição, e devolva para `60`.

- [ ] **Step 4: Verificar a mão**

```bash
yarn start
```

Confira, clicando de verdade:

1. Clicar em cada aba (image/gif/video/audio/download) filtra e o grid aparece sem travar.
2. Passar o mouse por cima de um vídeo → ele toca; sair → volta a ser imagem estática. Passar rápido por vários vídeos não deixa dois tocando.
3. Arrastar uma célula para o Finder cria o arquivo lá.
4. Clicar numa célula abre o preview; "voltar" retorna à mesma aba.
5. Rolar até o fim carrega mais itens sem gap visível.
6. Voltar para a home pelo logo e depois para uma aba não deixa vídeo tocando escondido.

- [ ] **Step 5: Reverter a instrumentação**

```bash
git diff --stat src/main/index.js
```

Esperado: sem saída.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/lib/library.js src/renderer/styles/index.css
git commit -m "feat: grid so de <img> com lote incremental e hover de video sob o cursor"
```

---

### Task 6: Gravar dimensões onde elas já estão em mãos

**Files:**
- Modify: `src/renderer/lib/file/ImageFile.js:42-50` (dentro de `el.onload`)
- Modify: `src/renderer/lib/file/VideoFile.js:54-62` (dentro de `el.onloadeddata`)
- Modify: `src/renderer/lib/library.js` (dentro de `showPreview`)

**Interfaces:**
- Consumes: `setEntry` (Task 2), `get` (Task 2).
- Produces: nada novo. Preenche `largura`/`altura` no schema do §3.

**Por que assim:** o design armazena dimensões porque "exige abrir o arquivo" — e `@ffmpeg-installer` **não** embarca `ffprobe`, então medir depois custaria uma dependência nova, o que a §2.2 proíbe. Mas há três pontos onde o arquivo **já está aberto num elemento** com as dimensões prontas: os dois handlers de status (que já imprimem `[LxA]`) e o preview. Gravar ali é uma linha em cada, zero custo. Arquivo legado ganha as dimensões na primeira vez que for aberto no preview.

- [ ] **Step 1: `ImageFile`**

Adicione ao topo de `src/renderer/lib/file/ImageFile.js`:

```js
const path = require('path')
const mediaIndex = require('../media-index.js')
```

e dentro de `el.onload`, depois do `showStatus(...)`:

```js
      // as dimensoes ja estao em maos aqui; medir depois exigiria ffprobe,
      // que o @ffmpeg-installer nao embarca (§2.2: sem dependencia nova)
      mediaIndex.setEntry(path.basename(this.name), {
        largura: this.el.naturalWidth,
        altura: this.el.naturalHeight,
      })
```

- [ ] **Step 2: `VideoFile`**

Adicione ao topo de `src/renderer/lib/file/VideoFile.js`:

```js
const path = require('path')
const mediaIndex = require('../media-index.js')
```

e dentro de `el.onloadeddata`, depois do `showStatus(...)`:

```js
      mediaIndex.setEntry(path.basename(this.name), {
        largura: this.el.videoWidth,
        altura: this.el.videoHeight,
      })
```

- [ ] **Step 3: Backfill no preview, para os arquivos legados**

Em `showPreview` de `src/renderer/lib/library.js`, logo depois de `const player = createPlayer(item)`:

```js
  // arquivo antigo entrou no indice sem dimensoes; o preview e a primeira vez
  // que ele e aberto de verdade, entao aproveita
  if (!item.largura) {
    const medir = () => {
      const l = player.naturalWidth || player.videoWidth || 0
      const a = player.naturalHeight || player.videoHeight || 0
      if (l && a) mediaIndex.setEntry(item.name, { largura: l, altura: a })
    }
    player.onload = medir
    player.onloadedmetadata = medir
  }
```

- [ ] **Step 4: Verificar rodando**

```bash
node -e "
const d=require(require('os').homedir()+'/veditbox/.veditbox/index.json')
console.log('com dimensoes:',Object.values(d).filter(v=>v.largura).length,'/',Object.keys(d).length)
"
yarn start
```

No app: abra a aba `video`, clique num item para abrir o preview, volte, abra outro. Depois feche e rode o mesmo `node -e` de novo.

Esperado: a contagem de "com dimensoes" subiu exatamente pelo número de previews que você abriu, e os valores batem com o que a barra de status mostrou.

Cole também uma imagem nova e confira que ela nasce com dimensões já preenchidas, sem passar pelo preview.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/lib/file/ImageFile.js src/renderer/lib/file/VideoFile.js src/renderer/lib/library.js
git commit -m "feat: grava dimensoes no indice onde o elemento ja as expoe"
```

---

### Task 7: Regressão do app inteiro e registro da mudança

**Files:**
- Modify: `version.md`

**Interfaces:**
- Consumes: tudo das Tasks 1–6.
- Produces: nada.

- [ ] **Step 1: Rodar os dois scripts de verificação**

```bash
node scripts/check-media-kinds.js && node scripts/check-media-index.js
```

Esperado: as duas linhas `OK`.

- [ ] **Step 2: Confirmar que nenhuma instrumentação sobrou**

```bash
git diff HEAD --stat src/main/index.js
grep -rn "VEDITBOX_PROBE" src/ || echo "limpo"
```

Esperado: nenhuma alteração em `src/main/index.js` e `limpo`.

- [ ] **Step 3: Regressão manual dos fluxos que já existiam**

```bash
yarn start
```

Todos precisam continuar funcionando — esta fase não deveria ter quebrado nenhum:

1. Colar url de imagem → aparece, arrasta para fora, e entra na aba `image` com a url gravada.
2. Colar url de gif do Giphy → idem, aba `gif`.
3. Colar url de vídeo direto (`.mp4`) → idem, aba `video`.
4. Colar url de página (Facebook/YouTube) → yt-dlp baixa, e o `index.json` guarda a **url da página**.
5. Colar um arquivo de imagem do Finder → entra no índice com `url: ''`.
6. Gravar áudio com `r` → o `.wav` aparece na aba `audio` com ícone `♪`, e o índice o adota na próxima abertura.
7. Gravar tela com `Alt+Shift+Ctrl+S` → o `.mp4` aparece na aba `video`.
8. Fechar e reabrir o app → nada foi perdido, nada duplicado.

- [ ] **Step 4: Testar o caso "usuário mexeu na pasta por fora"**

Com o app **fechado**:

```bash
/bin/mv "$HOME/veditbox/$(ls -1 "$HOME/veditbox" | head -1)" /tmp/
yarn start
```

Depois de abrir, feche e:

```bash
node -e "
const d=require(require('os').homedir()+'/veditbox/.veditbox/index.json')
console.log('entradas:',Object.keys(d).length)
"
```

Esperado: a entrada do arquivo movido sumiu (podada), as outras estão intactas. Devolva o arquivo:

```bash
/bin/mv "/tmp/<nome-do-arquivo>" "$HOME/veditbox/"
```

Reabra o app e confirme que ele foi re-adotado — **com `url` vazia**, pois o metadado foi podado junto. Esse é o comportamento correto por §2.1 (filesystem vence), não um bug.

- [ ] **Step 5: Registrar em `version.md`**

Acrescente uma entrada seguindo o formato que já existe no arquivo, cobrindo: índice `index.json` com escrita atômica e reconciliação na abertura; cache de thumbnails em `/tmp/veditbox`; grid reescrito para `<img>` com carregamento incremental.

- [ ] **Step 6: Commit**

```bash
git add version.md
git commit -m "docs: registra indice, thumbnails e grid da fase 1 em version.md"
```

---

## Self-Review

**Cobertura do spec:**

| Seção | Requisito | Task |
|---|---|---|
| §2.1 | filesystem vence | 2 (Steps 1, 5, 6), 7 (Step 4) |
| §2.2 | um JSON, zero dependência nova | 2, 4 |
| §2.3 | chave é o nome do arquivo | 2 |
| §2.4 | não armazenar o derivável | 1, 2 (asserção do schema) |
| §3 | schema de 6 campos; derivação de data | 1, 2, 6 |
| §4 | reconciliação só na abertura; adota órfão; poda morto; escrita atômica | 2, 3 |
| §5 | ffmpeg, `/tmp/veditbox`, 320px, máx 4, sob demanda, invalidação por mtime | 4 |
| §6 | toda célula `<img>`; ♪ para áudio; hover com um `<video>`; lote de 60 com `IntersectionObserver` | 5 |
| §12 | lógica pura por script Node; UI por instrumentação revertida | 1, 2 (script); 3, 4, 5, 6 (instrumentação + reversão explícita) |

**Fora de escopo desta fase, deliberadamente:** seleção/delete/undo (§7, Fase 2), busca/tags/sheet/pills e a correção de atalhos do §8.1 (Fase 3), Franken UI (§9, Fase 0), virtualização e waveform (§11).

---

## Riscos e objeções (não resolvidos aqui — para o Maestro)

1. **`~/veditbox` é um symlink para o Google Drive nesta máquina.** Verificado:
   `/Users/maykbrito/veditbox -> .../CloudStorage/GoogleDrive-…/My Drive/MacbookProMax/veditbox`.
   O `df` resolve para o APFS local (`disk3s5`), então `rename` continua atômico
   e a §4 se sustenta. Mas o Drive **vai sincronizar `.veditbox/index.json` a
   cada gravação**, e `setEntry` grava a cada chamada. Na Fase 3, editar tags
   item a item vira uma escrita (e um upload) por tecla. Se isso doer, a correção
   é um debounce de escrita dentro do store — mudança local, não muda a API.
   Não implementei porque na Fase 1 as escritas são esparsas.
2. **`largura`/`altura` não têm consumidor nesta fase.** Implementei porque a §3
   é explícita, e da forma mais barata possível (as dimensões já estavam em mãos
   nos três pontos). Mas nada as lê ainda. Se a intenção era `aspect-ratio` real
   no grid em vez do quadrado atual, isso não está no §6 e eu não adicionei.
3. **`@ffmpeg-installer` não embarca `ffprobe`.** Por isso as dimensões vêm de
   elementos DOM, não de sonda. Consequência aceita: arquivo legado só ganha
   dimensões quando alguém abre o preview dele. Se a Fase 3 precisar das
   dimensões de todos os itens para ordenar ou filtrar, isso vira uma lacuna real.
4. **A poda leva o metadado junto.** Se o usuário mover um arquivo para fora,
   abrir o app e devolver, título/tags/notes se perderam. É o que §2.1 e §4
   determinam, e implementei literalmente — mas vale registrar que é uma forma
   de perda de dado silenciosa. Uma lixeira de entradas podadas resolveria; não
   está no contrato e não inventei.
5. **`Task 3` toca `src/renderer/lib/file/index.js`, que é a rota de colagem.**
   É o único ponto que vê a url original (nas rotas `ytDlp` e `findPageMedia` ela
   já foi substituída antes de chegar no model). Se outra fase for dona desse
   arquivo, há conflito — mas nenhuma das fases 0/2/3 lista rota de colagem no
   escopo.
6. **`Task 4 Step 1` pode invalidar a escolha do filtro `thumbnail`.** O design
   mediu 0,02s/arquivo, provavelmente com seek. O filtro `thumbnail` decodifica
   mais frames em troca de nunca falhar em clipe curto nem entregar frame preto.
   O passo de medição existe justamente para isso não passar por suposição — se
   medir mal, o próprio passo diz o que trocar.
7. **Dependência da Fase 0.** O §10 diz que a Fase 1 depende dos tokens da Fase 0.
   Este plano não usa nenhum componente Franken UI e só toca `.library-*` no CSS,
   consumindo as variáveis (`--gray-200`, `--pink`) que já existem. Se a Fase 0
   renomear tokens, o ajuste no meu CSS é de duas linhas.
