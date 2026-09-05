# Fase 2 — Seleção múltipla, delete e undo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir selecionar vários itens do grid, mandá-los para a Lixeira do sistema em lote, e desfazer o último lote com `Cmd+Z`.

**Architecture:** Um módulo de estado puro (`selection.js`) que só guarda nomes de arquivo e sabe calcular intervalos; um módulo de UI que pinta checkbox/`.selected` e a barra de ação dentro da `#topBar` já existente; dois handlers `ipcMain.handle` novos (`trash-files`, `untrash-files`) porque `shell.trashItem` só existe no main; e um `store-adapter.js` — **arquivo único** onde toda a API da Fase 1 é consumida, para que uma divergência de assinatura custe um arquivo, não sete.

**Tech Stack:** Electron 33, JS puro CommonJS, sem bundler, sem framework, sem framework de teste. `shell.trashItem`, `dialog.showMessageBox`, `fs`.

**Spec:** `docs/superpowers/specs/2026-09-05-veditbox-gerenciador-midias-design.md` — §7 é o escopo desta fase. Leia §7 inteiro antes da Task 1.

---

## Global Constraints

Copiados do contrato e do `AGENTS.md`. Valem para toda task abaixo.

- **Sem ponto e vírgula, aspas simples/backticks.** Segue `.prettierrc`.
- **CommonJS (`require`), nunca ESM.**
- **Nenhuma dependência nova.** Nem de produção, nem de dev. Nem framework de teste (§12).
- **Verificar rodando, não compilando** (§12). Toda task termina com o app aberto ou um script Node executado, nunca com "o código parece certo".
- **Lógica pura → script Node com asserção.** Fluxo de UI → instrumentar `src/main/index.js` temporariamente com `executeJavaScript`, medir DOM e filesystem reais, **e reverter a instrumentação** (§12).
- **Delete manda para a Lixeira via `shell.trashItem()`** (§7). Nunca `fs.unlink` em arquivo da biblioteca.
- **Cada exclusão faz três coisas:** Lixeira + remove entrada do índice + apaga thumb em `/tmp` (§7).
- **Confirmação: 1 item sem confirmar; 2+ confirma mostrando a contagem** (§7).
- **Undo é pilha de UM nível** (último lote), não histórico (§7).
- **Undo é best-effort: se falhar, avisa. Nunca finge sucesso** (§7).
- **NÃO construir** detector de duplicados nem de arquivos vazios (§7, §11).
- **Fronteira desta fase:** não tocar em busca, tags, sheet de metadados, nem no design system. Não reescrever o grid (dono é a Fase 1).
- Pasta da biblioteca: `CONSTANTS.destDownloadFolder` = `~/veditbox`. Cache de thumbs: `/tmp/veditbox/` (§5).
- Mudança relevante → registrar em `version.md`.

---

## Preflight

Esta worktree está sem `node_modules` (verificado). Antes da Task 1:

```bash
yarn
rtk ls node_modules/electron/package.json
```

Todo `npx electron` deste plano precisa resolver para o **Electron 33 local**.
Se `node_modules/electron` não existir, `npx` baixa a última versão do
registry silenciosamente e você estará verificando outro runtime que não o do
app. Confirme a versão antes de confiar em qualquer resultado:

```bash
npx electron --version
```

Esperado: `v33.x`.

---

## Dependência da Fase 1 — API assumida

**Esta seção é a maior fonte de risco do plano.** A Fase 1 é dona do índice, dos
thumbnails e da reescrita do grid. Este plano foi escrito antes de a API dela
existir. Tudo abaixo é **suposição a confirmar**, e está isolada em um único
arquivo (`store-adapter.js`, Task 1) exatamente para que confirmar/corrigir seja
barato.

| # | Suposição | Como confirmar | Se estiver errado |
|---|---|---|---|
| S1 | Existe `src/renderer/lib/library/store.js` exportando `{ list(), get(name), remove(name), put(name, entry), save() }` — índice em memória sobre `~/veditbox/.veditbox/index.json` | `rtk grep -n "module.exports" src/renderer/lib/library/store.js` | corrigir só `store-adapter.js` |
| S2 | O grid renderiza uma `.library-item` por arquivo com `dataset.name` = nome do arquivo | inspecionar o DOM no app rodando | ajustar seletor em `selection-ui.js` |
| S3 | Existe uma função para repintar o grid com o filtro atual, e uma para ler a lista visível na ordem exibida | ler os exports do módulo de grid da Fase 1 | ver fallback abaixo |
| S4 | O thumbnail de `nome.mp4` vive em `/tmp/veditbox/nome.mp4.jpg` | `rtk ls /tmp/veditbox` com o app rodando | corrigir `thumbPath()` no adapter |
| S5 | O grid dispara um evento/callback quando termina de anexar um lote incremental (§6, `IntersectionObserver`) | ler o módulo de grid | ver fallback abaixo |

**Fallback se S3/S5 não existirem:** ler a ordem direto do DOM
(`[...grid.querySelectorAll('.library-item')].map(el => el.dataset.name)`) e
usar delegação de evento no container do grid em vez de callback por item.
Delegação já é a escolha deste plano justamente porque sobrevive a lotes
incrementais sem precisar de hook — então S5 é conveniência, não bloqueio.

**A Task 1 é a task de confirmação.** Ela não implementa nada de seleção: ela
abre o app da Fase 1, mede a realidade, e escreve o adapter contra o que
encontrou. Nenhuma task posterior pode começar antes dela.

---

## Estrutura de arquivos

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `src/renderer/lib/selection/store-adapter.js` | **Única** ponte para a API da Fase 1. Toda suposição S1–S5 mora aqui. |
| `src/renderer/lib/selection/selection.js` | Estado puro da seleção: Set de nomes + âncora + cálculo de intervalo. Zero DOM, zero fs. |
| `src/renderer/lib/selection/selection-ui.js` | Checkbox no hover, classe `.selected`, delegação de clique no grid. |
| `src/renderer/lib/selection/action-bar.js` | Troca o conteúdo da `#topBar` por "N selecionados" + ações. |
| `src/renderer/lib/selection/trash.js` | Orquestra delete e undo no renderer: confirma, chama ipc, mexe no índice, apaga thumb, guarda o lote para undo. |
| `src/renderer/lib/selection/shortcuts.js` | `Cmd+A`, `Esc`, `Cmd+Delete`, `Cmd+Z`. |
| `src/renderer/lib/selection/index.js` | Boot: liga os módulos acima. É o único `require` novo em `src/renderer/index.js`. |
| `src/renderer/styles/selection.css` | CSS do checkbox, `.selected` e da barra de ação. Arquivo próprio para não brigar com a Fase 0 no `index.css`. |
| `scripts/check-selection-range.js` | Script Node de asserção da lógica pura. |
| `scripts/check-trash-roundtrip.js` | Instrumentação Electron que verifica Lixeira + undo com arquivos reais. |

**Modificar:**

| Arquivo | O que muda | Risco de conflito |
|---|---|---|
| `src/main/index.js` | +2 `ipcMain.handle` no final do arquivo | **médio** — a Fase 1 provavelmente adiciona ipc de thumbnail no mesmo arquivo. Adicionar **no fim**, nunca no meio. |
| `src/renderer/index.js` | +1 linha de `require` no fim | baixo |
| `src/renderer/index.html` | +1 `<link>` para `selection.css` | baixo |
| `version.md` | entrada da fase | baixo |

**Não modificar nesta fase:** `src/renderer/styles/index.css` (Fase 0),
`src/renderer/lib/library*` (Fase 1), qualquer coisa de busca/tags (Fase 3),
`src/renderer/lib/recorder/audio/index.js` (a guarda de foco de §8.1 é da Fase 3 —
ver Task 6 para por que esta fase não precisa dela).

---

## Decisões desta fase que o contrato não fixou

Registradas aqui para não virarem discussão durante a execução.

**1. Confirmação usa `dialog.showMessageBox` do main, não um `<dialog>` HTML.**
§9 lista "Confirmação → Modal (Franken UI)". Esta fase desvia, por duas razões
mecânicas: (a) `src/utils/elements.js:13` faz
`ELEMENTS.setElement('modal', 'dialog')` — um `querySelector('dialog')` sem id.
Adicionar um segundo `<dialog>` antes do de ajuda no HTML **quebra o modal de
ajuda**; (b) depender do Franken UI acoplaria a Fase 2 ao término da Fase 0, e o
contrato (§10) diz que 2 e 3 são paralelizáveis após a **1**, não após a 0.
`showMessageBox` é nativo, zero código de UI, zero dependência, e é a
affordance correta de macOS para confirmação destrutiva. **Objeção registrada
no relatório ao Maestro.**

**2. Delegação de evento no container do grid, não handler por item.**
O grid da Fase 1 anexa itens em lotes incrementais (§6). Um `onclick` por item
exigiria reanexar a cada lote. Um listener no container cobre itens que ainda
nem existem.

**3. Undo mora no main, junto do trash.** `shell.trashItem` é main-only. O undo é
`fs.rename`, que rodaria no renderer (`nodeIntegration: true`), mas separar as
duas metades da mesma semântica em processos diferentes é como se perde a
simetria. Um arquivo, dois handlers.

**4. Esta fase não precisa da guarda de foco de §8.1.** Verificado no código:
o único handler de teclado do renderer é `window.onkeydown` em
`src/renderer/lib/recorder/audio/index.js:15`, e ele **já** faz bail em
`if (!e.altKey && !e.ctrlKey && !e.metaKey)`. Todos os atalhos desta fase usam
`metaKey`, exceto `Esc` — e o handler de áudio só reage a `r` e espaço. Sem
colisão. A guarda continua obrigatória para a Fase 3 (campo de busca), que é
onde §8.1 a coloca.

**5. `addEventListener`, nunca `window.onkeydown =`.** O handler do gravador de
áudio é uma **atribuição de propriedade**. Um segundo `window.onkeydown =` o
apagaria silenciosamente e quebraria a gravação por atalho.

---

## Task 1: Confirmar a API da Fase 1 e escrever o adapter

Esta task não entrega funcionalidade. Ela troca cinco suposições por cinco
fatos medidos, e é por isso que existe: as seis tasks seguintes assumem que
este arquivo está correto.

**Files:**
- Create: `src/renderer/lib/selection/store-adapter.js`

**Interfaces:**
- Consumes: a API da Fase 1 (ver tabela S1–S5 acima)
- Produces:
  - `visibleNames() -> string[]` — nomes na ordem exibida no grid, respeitando o filtro/aba atual
  - `gridEl() -> HTMLElement | null` — o container do grid, ou `null` se não há grid na tela
  - `itemEl(name) -> HTMLElement | null`
  - `filePath(name) -> string` — caminho absoluto em `~/veditbox`
  - `thumbPath(name) -> string` — caminho absoluto em `/tmp/veditbox`
  - `indexGet(name) -> object | undefined` — entrada do índice
  - `indexRemove(name) -> void`
  - `indexPut(name, entry) -> void` — `entry` pode ser `undefined` (arquivo adotado sem entrada)
  - `indexSave() -> Promise<void>`
  - `repaint() -> void` — repinta o grid com o filtro atual

- [ ] **Step 1: Rodar o app e medir a realidade**

```bash
yarn start
```

Com o app aberto, clique numa aba que tenha arquivos e abra o DevTools
(`Cmd+Alt+I`). No console, rode:

```js
const grid = document.querySelector('.library-grid')
console.log('grid:', grid)
console.log('primeiro item:', grid && grid.firstElementChild)
console.log('dataset do primeiro:', grid && grid.firstElementChild.dataset)
console.log('total de itens:', grid && grid.querySelectorAll('.library-item').length)
```

Anote: a classe real do container, a classe real do item, e **se
`dataset.name` existe**. Se o grid da Fase 1 usar outro nome de atributo
(`data-file`, `data-id`), é esse que vale.

- [ ] **Step 2: Ler os exports reais dos módulos da Fase 1**

```bash
rtk grep -rn "module.exports" src/renderer/lib/library src/renderer/lib/index src/renderer/lib/store 2>/dev/null
rtk ls -la /tmp/veditbox
```

Confirme os nomes de `list/get/remove/put/save` e o padrão de nome do thumb.
Se o thumb de `x.mp4` for `x.mp4.jpg`, `x.jpg` ou um hash, é o que você viu
que vale — não o que este plano supôs.

- [ ] **Step 3: Escrever o adapter contra o que foi medido**

Abaixo está a versão escrita contra as suposições S1–S5. **Ajuste cada linha
marcada `AJUSTAR` para bater com os Steps 1 e 2.** Se a Fase 1 bateu com a
suposição, não muda nada.

```js
// Única ponte para a API da Fase 1. Se a assinatura de lá mudar, muda só aqui.
const path = require('path')

const { CONSTANTS } = require('../../../utils/constants')

// AJUSTAR: caminho e nome do módulo de índice da Fase 1
const store = require('../library/store')

const THUMB_DIR = '/tmp/veditbox'
const GRID_SELECTOR = '.library-grid' // AJUSTAR conforme Step 1
const ITEM_SELECTOR = '.library-item' // AJUSTAR conforme Step 1
const NAME_ATTR = 'name' // dataset.name — AJUSTAR conforme Step 1

const gridEl = () => document.querySelector(GRID_SELECTOR)

const nameOf = (el) => el && el.dataset[NAME_ATTR]

// Ordem exibida lida do DOM: sobrevive a lotes incrementais sem hook da Fase 1
const visibleNames = () => {
  const grid = gridEl()
  if (!grid) return []
  return [...grid.querySelectorAll(ITEM_SELECTOR)].map(nameOf).filter(Boolean)
}

const itemEl = (name) => {
  const grid = gridEl()
  if (!grid) return null
  return [...grid.querySelectorAll(ITEM_SELECTOR)].find((el) => nameOf(el) === name) || null
}

const filePath = (name) => path.join(CONSTANTS.destDownloadFolder, name)

// AJUSTAR: padrão real do thumb, medido no Step 2
const thumbPath = (name) => path.join(THUMB_DIR, `${name}.jpg`)

const indexGet = (name) => store.get(name)
const indexRemove = (name) => store.remove(name)
const indexPut = (name, entry) => store.put(name, entry)
const indexSave = () => store.save()

// AJUSTAR: nome real da função de repintar da Fase 1
const repaint = () => store.repaint && store.repaint()

module.exports = {
  ITEM_SELECTOR,
  nameOf,
  gridEl,
  visibleNames,
  itemEl,
  filePath,
  thumbPath,
  indexGet,
  indexRemove,
  indexPut,
  indexSave,
  repaint,
}
```

- [ ] **Step 4: Verificar o adapter no app rodando**

Com `yarn start` aberto numa aba com arquivos, no console do DevTools:

```js
const A = require('./src/renderer/lib/selection/store-adapter')
const nomes = A.visibleNames()
console.log('nomes visiveis:', nomes.length, nomes.slice(0, 3))
console.log('itemEl bate:', A.itemEl(nomes[0]) === document.querySelector(A.ITEM_SELECTOR))
console.log('filePath:', A.filePath(nomes[0]))
console.log('thumbPath:', A.thumbPath(nomes[0]))
console.log('indice:', A.indexGet(nomes[0]))
```

Esperado: `nomes.length` igual à contagem de itens do grid; `itemEl bate: true`;
`filePath` apontando para um arquivo que existe; `thumbPath` apontando para um
arquivo que existe em `/tmp/veditbox`; `indexGet` retornando um objeto (ou
`undefined` se for arquivo adotado, o que também é válido).

Se `thumbPath` apontar para arquivo inexistente, volte ao Step 2 — o padrão de
nome está errado, e o Task 6 apagaria o thumb errado (ou nenhum).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/lib/selection/store-adapter.js
git commit -m "feat(selecao): adapter para a API de indice/grid da fase 1"
```

---

## Task 2: Estado puro da seleção

**Files:**
- Create: `src/renderer/lib/selection/selection.js`
- Test: `scripts/check-selection-range.js`

**Interfaces:**
- Consumes: nada. Este módulo não importa nada, não toca DOM, não toca fs.
- Produces:
  - `has(name) -> boolean`
  - `count() -> number`
  - `names() -> string[]`
  - `toggle(name) -> void` — alterna e fixa `name` como âncora
  - `extendTo(name, orderedNames) -> void` — seleciona o intervalo da âncora até `name`; sem âncora, comporta-se como `toggle`
  - `selectAll(orderedNames) -> void`
  - `clear() -> void`
  - `onChange(fn) -> void` — registra callback chamado após qualquer mutação
  - `rangeBetween(a, b, orderedNames) -> string[]` — exportado só para o teste

- [ ] **Step 1: Escrever o teste que falha**

Crie `scripts/check-selection-range.js`:

```js
// Verificacao da logica pura de selecao. Roda com: node scripts/check-selection-range.js
const assert = require('assert')

const sel = require('../src/renderer/lib/selection/selection')

const ordem = ['a', 'b', 'c', 'd', 'e']

// rangeBetween e inclusivo nas duas pontas e independe da direcao
assert.deepStrictEqual(sel.rangeBetween('b', 'd', ordem), ['b', 'c', 'd'], 'range pra frente')
assert.deepStrictEqual(sel.rangeBetween('d', 'b', ordem), ['b', 'c', 'd'], 'range pra tras')
assert.deepStrictEqual(sel.rangeBetween('c', 'c', ordem), ['c'], 'range de um item so')
assert.deepStrictEqual(sel.rangeBetween('z', 'c', ordem), [], 'ancora fora da lista')
assert.deepStrictEqual(sel.rangeBetween('c', 'z', ordem), [], 'alvo fora da lista')

// toggle alterna e fixa ancora
sel.clear()
sel.toggle('b')
assert.strictEqual(sel.has('b'), true, 'toggle seleciona')
assert.strictEqual(sel.count(), 1, 'contagem apos toggle')
sel.toggle('b')
assert.strictEqual(sel.has('b'), false, 'toggle desseleciona')
assert.strictEqual(sel.count(), 0, 'contagem apos destoggle')

// shift+clique estende a partir da ancora
sel.clear()
sel.toggle('b')
sel.extendTo('d', ordem)
assert.deepStrictEqual(sel.names().sort(), ['b', 'c', 'd'], 'extendTo cobre o intervalo')

// extender de novo, mais curto, NAO deixa lixo do intervalo anterior (Finder)
sel.extendTo('c', ordem)
assert.deepStrictEqual(sel.names().sort(), ['b', 'c'], 'extendTo encolhe sem deixar residuo')

// extendTo sem ancora se comporta como toggle
sel.clear()
sel.extendTo('c', ordem)
assert.deepStrictEqual(sel.names(), ['c'], 'extendTo sem ancora vira toggle')

// selectAll respeita a ordem/filtro recebido, nao a biblioteca inteira
sel.clear()
sel.selectAll(['b', 'c'])
assert.deepStrictEqual(sel.names().sort(), ['b', 'c'], 'selectAll usa a lista filtrada')

// clear zera ancora tambem: extendTo depois nao ressuscita intervalo antigo
sel.clear()
assert.strictEqual(sel.count(), 0, 'clear zera')
sel.extendTo('e', ordem)
assert.deepStrictEqual(sel.names(), ['e'], 'clear zerou a ancora')

// onChange dispara em toda mutacao
let disparos = 0
sel.onChange(() => disparos++)
sel.clear()
sel.toggle('a')
sel.selectAll(ordem)
sel.clear()
assert.strictEqual(disparos, 4, `onChange disparou ${disparos}x, esperado 4`)

console.log('ok: logica de selecao')
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
node scripts/check-selection-range.js
```

Esperado: FALHA com `Cannot find module '../src/renderer/lib/selection/selection'`.

- [ ] **Step 3: Implementar o mínimo**

Crie `src/renderer/lib/selection/selection.js`:

```js
// Estado puro da selecao. Sem DOM, sem fs — por isso da pra testar com node.
const selecionados = new Set()
const ouvintes = []

let ancora = null

const has = (name) => selecionados.has(name)
const count = () => selecionados.size
const names = () => [...selecionados]

const notificar = () => ouvintes.forEach((fn) => fn())
const onChange = (fn) => ouvintes.push(fn)

// Inclusivo nas duas pontas, indiferente a direcao. Ponta fora da lista = vazio.
const rangeBetween = (a, b, orderedNames) => {
  const i = orderedNames.indexOf(a)
  const j = orderedNames.indexOf(b)
  if (i === -1 || j === -1) return []
  return orderedNames.slice(Math.min(i, j), Math.max(i, j) + 1)
}

// Guarda o que havia antes do shift atual, pra encolher o intervalo sem deixar residuo
let baseDaExtensao = null

const toggle = (name) => {
  if (selecionados.has(name)) {
    selecionados.delete(name)
  } else {
    selecionados.add(name)
  }
  ancora = name
  baseDaExtensao = null
  notificar()
}

const extendTo = (name, orderedNames) => {
  if (ancora === null) return toggle(name)

  if (baseDaExtensao === null) baseDaExtensao = new Set(selecionados)

  selecionados.clear()
  baseDaExtensao.forEach((n) => selecionados.add(n))
  rangeBetween(ancora, name, orderedNames).forEach((n) => selecionados.add(n))
  notificar()
}

const selectAll = (orderedNames) => {
  orderedNames.forEach((n) => selecionados.add(n))
  baseDaExtensao = null
  notificar()
}

const clear = () => {
  selecionados.clear()
  ancora = null
  baseDaExtensao = null
  notificar()
}

module.exports = {
  has,
  count,
  names,
  toggle,
  extendTo,
  selectAll,
  clear,
  onChange,
  rangeBetween,
}
```

Nota sobre `baseDaExtensao`: sem ele, `extendTo` grande seguido de `extendTo`
pequeno deixaria os itens do intervalo maior selecionados. É o caso
"extendTo encolhe sem deixar resíduo" do teste, e é o comportamento do Finder.

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
node scripts/check-selection-range.js
```

Esperado: `ok: logica de selecao`, saída com código 0.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/lib/selection/selection.js scripts/check-selection-range.js
git commit -m "feat(selecao): estado puro com intervalo por shift"
```

---

## Task 3: ipc de Lixeira e restauração no main

Entrega o lado do sistema operacional inteiro, verificado com arquivos reais,
antes de qualquer UI existir. Se `trashItem` ou o restore não funcionarem como
§7 afirma, é melhor descobrir agora do que depois de três tasks de UI.

**Files:**
- Modify: `src/main/index.js` (adicionar **no fim do arquivo**, depois de `createShortcuts`)
- Test: `scripts/check-trash-roundtrip.js`

**Interfaces:**
- Consumes: nada da Fase 1.
- Produces (canais ipc, consumidos pelas Tasks 6 e 7):
  - `ipcRenderer.invoke('trash-files', filePaths: string[]) -> Promise<{ ok: string[], fail: {path, error}[] }>`
  - `ipcRenderer.invoke('untrash-files', names: string[], destDir: string) -> Promise<{ ok: string[], fail: {name, error}[] }>`

Nenhum dos dois lança. Ambos relatam por item, porque um lote pode falhar pela
metade e a UI precisa saber exatamente quais.

Também produz, do mesmo `src/main/trash.js`, as funções por trás dos handlers —
é o que o script de verificação chama, para não precisar simular um renderer
nem tocar em API privada do Electron:

- `trashFiles(filePaths: string[]) -> Promise<{ ok, fail }>`
- `untrashFiles(names: string[], destDir: string) -> Promise<{ ok, fail }>`

- [ ] **Step 1: Escrever a verificação que falha**

Crie `scripts/check-trash-roundtrip.js`. É um app Electron mínimo e efêmero —
não precisa da janela do veditbox, só do processo main, que é onde
`shell.trashItem` vive:

```js
// Verifica Lixeira + restauracao com arquivos REAIS. Roda com:
//   npx electron scripts/check-trash-roundtrip.js
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { app } = require('electron')

// Chama as funcoes puras direto, sem passar por ipc: sao elas que tem a logica,
// e o handler ipc e' so um wrapper. Evita depender de API privada do Electron.
const { trashFiles, untrashFiles } = require('../src/main/trash')

const destDir = path.join(os.homedir(), 'veditbox')
const trashDir = path.join(os.homedir(), '.Trash')

app.whenReady().then(async () => {
  try {
    fs.mkdirSync(destDir, { recursive: true })

    const nome = `check-trash-${Date.now()}.txt`
    const alvo = path.join(destDir, nome)
    const conteudo = 'conteudo que precisa sobreviver ao roundtrip'
    fs.writeFileSync(alvo, conteudo)

    // 1. vai pra Lixeira
    const r1 = await trashFiles([alvo])
    assert.deepStrictEqual(r1.fail, [], `trash falhou: ${JSON.stringify(r1.fail)}`)
    assert.strictEqual(fs.existsSync(alvo), false, 'arquivo ainda esta na pasta')
    assert.strictEqual(
      fs.existsSync(path.join(trashDir, nome)),
      true,
      'arquivo nao apareceu em ~/.Trash com o mesmo nome',
    )

    // 2. volta intacto
    const r2 = await untrashFiles([nome], destDir)
    assert.deepStrictEqual(r2.fail, [], `untrash falhou: ${JSON.stringify(r2.fail)}`)
    assert.strictEqual(fs.existsSync(alvo), true, 'arquivo nao voltou pra pasta')
    assert.strictEqual(fs.readFileSync(alvo, 'utf8'), conteudo, 'conteudo corrompido')

    // 3. undo de arquivo que nao esta na Lixeira FALHA, nao finge sucesso
    const r3 = await untrashFiles(['nao-existe-na-lixeira-999.txt'], destDir)
    assert.strictEqual(r3.ok.length, 0, 'reportou ok pra arquivo inexistente')
    assert.strictEqual(r3.fail.length, 1, 'nao reportou a falha')

    // 4. undo nao sobrescreve arquivo existente na pasta
    const ocupado = path.join(destDir, `check-ocupado-${Date.now()}.txt`)
    fs.writeFileSync(ocupado, 'original')
    const nomeOcupado = path.basename(ocupado)
    fs.writeFileSync(path.join(trashDir, nomeOcupado), 'da lixeira')
    const r4 = await untrashFiles([nomeOcupado], destDir)
    assert.strictEqual(r4.fail.length, 1, 'sobrescreveu arquivo existente')
    assert.strictEqual(fs.readFileSync(ocupado, 'utf8'), 'original', 'original foi sobrescrito')

    // limpeza do que este script criou
    fs.unlinkSync(alvo)
    fs.unlinkSync(ocupado)
    fs.unlinkSync(path.join(trashDir, nomeOcupado))

    console.log('ok: lixeira e restauracao')
    app.exit(0)
  } catch (erro) {
    console.error('FALHOU:', erro.message)
    app.exit(1)
  }
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npx electron scripts/check-trash-roundtrip.js
```

Esperado: FALHA com `Cannot find module '../src/main/trash'`.

- [ ] **Step 3: Implementar os handlers**

Crie `src/main/trash.js` — arquivo próprio de propósito: o `src/main/index.js`
é o ponto mais provável de conflito com a Fase 1, então o corpo da lógica fica
fora dele e o `index.js` só ganha uma linha.

```js
// Lixeira do sistema e restauracao. Vive no main porque shell.trashItem e main-only.
const fs = require('fs')
const os = require('os')
const path = require('path')

const { ipcMain, shell } = require('electron')

const TRASH_DIR = path.join(os.homedir(), '.Trash')

// Relata por item: um lote pode falhar pela metade e a UI precisa saber quais.
const trashFiles = async (filePaths) => {
  const ok = []
  const fail = []

  for (const filePath of filePaths) {
    try {
      await shell.trashItem(filePath)
      ok.push(filePath)
    } catch (erro) {
      fail.push({ path: filePath, error: erro.message })
    }
  }

  return { ok, fail }
}

// Undo best-effort: Lixeira esvaziada ou arquivo renomeado la dentro => falha e avisa.
const untrashFiles = async (names, destDir) => {
  const ok = []
  const fail = []

  for (const name of names) {
    const origem = path.join(TRASH_DIR, name)
    const destino = path.join(destDir, name)

    try {
      if (!fs.existsSync(origem)) {
        throw new Error('nao esta mais na Lixeira')
      }
      if (fs.existsSync(destino)) {
        throw new Error('ja existe um arquivo com esse nome na pasta')
      }

      try {
        fs.renameSync(origem, destino)
      } catch (erro) {
        // ~/.Trash em outro volume que ~/veditbox: rename nao atravessa, copia atravessa
        if (erro.code !== 'EXDEV') throw erro
        fs.copyFileSync(origem, destino)
        fs.unlinkSync(origem)
      }

      ok.push(name)
    } catch (erro) {
      fail.push({ name, error: erro.message })
    }
  }

  return { ok, fail }
}

// Os handlers ipc sao wrappers finos. A logica fica nas funcoes acima pra que o
// script de verificacao possa chama-las sem simular um renderer.
ipcMain.handle('trash-files', (_event, filePaths) => trashFiles(filePaths))
ipcMain.handle('untrash-files', (_event, names, destDir) => untrashFiles(names, destDir))

module.exports = { trashFiles, untrashFiles }
```

Agora, em `src/main/index.js`, adicione **na última linha do arquivo**, depois
de `app.whenReady().then(createWindow).then(createShortcuts)`:

```js
require('./trash')
```

Adicionar no fim, e não junto dos outros `require` do topo, é deliberado: a
Fase 1 vai editar o topo desse arquivo, e um merge de duas linhas adjacentes
no mesmo bloco de imports é conflito garantido.

- [ ] **Step 4: Rodar e ver passar**

```bash
npx electron scripts/check-trash-roundtrip.js
```

Esperado: `ok: lixeira e restauracao`, código de saída 0.

Se o Step falhar em "arquivo nao apareceu em ~/.Trash com o mesmo nome", **pare
e reporte**: §7 afirma que isso foi verificado experimentalmente, e o undo
inteiro depende disso. Não improvise outro mecanismo.

Depois de passar, confirme com os próprios olhos que a Lixeira do Finder está
limpa do lixo do teste — o script limpa o que criou, mas vale conferir:

```bash
rtk ls ~/.Trash | grep check- || echo "limpo"
```

- [ ] **Step 5: Commit**

```bash
git add src/main/trash.js src/main/index.js scripts/check-trash-roundtrip.js
git commit -m "feat(selecao): ipc de lixeira e restauracao best-effort"
```

---

## Task 4: Checkbox no hover e clique de seleção

**Files:**
- Create: `src/renderer/lib/selection/selection-ui.js`
- Create: `src/renderer/styles/selection.css`
- Create: `src/renderer/lib/selection/index.js`
- Modify: `src/renderer/index.html` (adicionar `<link>`, ver Step 3)
- Modify: `src/renderer/index.js` (adicionar `require`, ver Step 3)

**Interfaces:**
- Consumes: `selection.js` (Task 2), `store-adapter.js` (Task 1)
- Produces:
  - `mount() -> void` — instala a delegação de clique no `document` e o repaint reativo
  - `paint() -> void` — sincroniza classes `.selected` e checkboxes com o estado atual
  - `setPreviewHandler(fn) -> void` — recebe a função que abre o preview; chamada só quando não há seleção

- [ ] **Step 1: CSS**

Crie `src/renderer/styles/selection.css`:

```css
/* Checkbox e' a unica parte descobrivel da selecao (secao 7 do design) */
.select-box {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 20px;
  height: 20px;
  margin: 0;
  z-index: 2;
  opacity: 0;
  cursor: pointer;
  accent-color: var(--purple);
  /* .library-item > * tem pointer-events:none no index.css — precisa reverter */
  pointer-events: auto;
}

/* aparece no hover do item, ou permanentemente quando ja ha selecao ativa */
.library-item:hover .select-box,
.library-item.selected .select-box,
body.selecting .select-box {
  opacity: 1;
}

.library-item.selected {
  outline: 2px solid var(--purple);
  outline-offset: -2px;
}

.library-item.selected::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgb(139 92 246 / 25%);
  pointer-events: none;
  z-index: 1;
}

/* em modo selecao o cursor de arrastar mente sobre o que o clique faz */
body.selecting .library-item {
  cursor: pointer;
}

.selection-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.selection-bar .selection-count {
  font-weight: 600;
  margin-right: auto;
}

.selection-bar button {
  background: none;
  border: 1px solid var(--gray-100);
  border-radius: 4px;
  color: inherit;
  padding: 2px 10px;
  cursor: pointer;
  font: inherit;
}

.selection-bar button:hover {
  backdrop-filter: brightness(210%);
}

.selection-bar button.danger {
  border-color: var(--pink);
  color: var(--pink);
}
```

Se `--purple` ou `--pink` não existirem com esses nomes após a Fase 0, use os
tokens que existirem — não invente cor literal nova.

- [ ] **Step 2: Implementar a UI de seleção**

Crie `src/renderer/lib/selection/selection-ui.js`:

```js
const sel = require('./selection')
const adapter = require('./store-adapter')

let abrirPreview = () => {}

const setPreviewHandler = (fn) => {
  abrirPreview = fn
}

// Garante o checkbox no item. Idempotente: lotes incrementais reentram aqui.
const garantirCheckbox = (item) => {
  let box = item.querySelector('.select-box')
  if (box) return box

  box = document.createElement('input')
  box.type = 'checkbox'
  box.className = 'select-box'
  box.tabIndex = -1
  item.appendChild(box)
  return box
}

const paint = () => {
  const grid = adapter.gridEl()
  if (!grid) return

  grid.querySelectorAll(adapter.ITEM_SELECTOR).forEach((item) => {
    const name = adapter.nameOf(item)
    const marcado = sel.has(name)
    garantirCheckbox(item).checked = marcado
    item.classList.toggle('selected', marcado)
    // arrastar 40 arquivos nao e' o que esta fase entrega; em modo selecao, desliga
    item.draggable = sel.count() === 0
  })

  document.body.classList.toggle('selecting', sel.count() > 0)
}

const aoClicar = (event) => {
  const item = event.target.closest(adapter.ITEM_SELECTOR)
  if (!item) return

  const name = adapter.nameOf(item)
  if (!name) return

  const noCheckbox = event.target.classList.contains('select-box')

  // Clique simples sem selecao ativa e fora do checkbox: preview, como hoje
  if (!noCheckbox && !event.shiftKey && sel.count() === 0) {
    return abrirPreview(name)
  }

  event.preventDefault()
  event.stopPropagation()

  if (event.shiftKey) {
    sel.extendTo(name, adapter.visibleNames())
  } else {
    sel.toggle(name)
  }
}

const mount = () => {
  // Delegacao no document: cobre itens de lotes incrementais que ainda nao existem,
  // e sobrevive ao grid ser recriado do zero pela Fase 1.
  document.addEventListener('click', aoClicar, true)

  sel.onChange(paint)

  // O grid pode repintar sem passar por nos; reaplica quando isso acontecer.
  const observer = new MutationObserver(() => paint())
  observer.observe(document.querySelector('#mainArea'), { childList: true, subtree: true })
}

module.exports = { mount, paint, setPreviewHandler }
```

O `MutationObserver` existe porque a Fase 1 repinta o grid por conta própria
(troca de aba, lote incremental). Sem ele, os checkboxes sumiriam no primeiro
repaint. É a alternativa a exigir um hook da Fase 1 que talvez não exista (S5).

Crie `src/renderer/lib/selection/index.js`:

```js
// Boot da fase 2. Unico require novo no src/renderer/index.js.
const ui = require('./selection-ui')

ui.mount()

module.exports = {}
```

- [ ] **Step 3: Ligar no app**

Em `src/renderer/index.html`, ao lado do `<link>` de `index.css` já existente,
adicione:

```html
<link rel="stylesheet" href="styles/selection.css" />
```

Em `src/renderer/index.js`, adicione como **última linha** (depois do require
de library):

```js
require('./lib/selection')
```

- [ ] **Step 4: Verificar rodando**

```bash
yarn start
```

Com o app aberto, numa aba com pelo menos 4 arquivos, execute manualmente e
confirme cada um:

1. **Hover sobre um item** → um checkbox aparece no canto superior esquerdo.
   Tire o mouse → some.
2. **Clique no corpo do item (sem seleção ativa)** → abre o preview, como antes.
   Volte para o grid.
3. **Clique no checkbox** → item ganha borda roxa e overlay; checkbox fica
   marcado; **todos** os checkboxes do grid ficam visíveis (`body.selecting`).
4. **Clique no corpo de outro item (com seleção ativa)** → seleciona, **não**
   abre preview.
5. **Shift+clique num item 3 posições adiante** → seleciona o intervalo inteiro.
6. **Shift+clique num item 1 posição adiante** → o intervalo encolhe; os itens
   que saíram do intervalo perdem a marcação.
7. **Troque de aba e volte** → a seleção some da tela junto com o grid, e os
   checkboxes reaparecem no hover (o `MutationObserver` reaplicou).

No console do DevTools, confirme que o estado bate com a tela:

```js
const sel = require('./src/renderer/lib/selection/selection')
console.log(sel.count(), sel.names())
```

Esperado: a contagem igual ao número de itens com borda roxa na tela.

**Se o item 1 falhar** (checkbox não aparece), verifique se
`.library-item > * { pointer-events: none }` do `index.css` está vencendo o
`pointer-events: auto` do `.select-box` — é a armadilha mais provável aqui.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/lib/selection/selection-ui.js src/renderer/lib/selection/index.js src/renderer/styles/selection.css src/renderer/index.html src/renderer/index.js
git commit -m "feat(selecao): checkbox no hover, clique e shift+clique no grid"
```

---

## Task 5: Barra de ação na #topBar

**Files:**
- Create: `src/renderer/lib/selection/action-bar.js`
- Modify: `src/renderer/lib/selection/index.js`

**Interfaces:**
- Consumes: `selection.js` (Task 2)
- Produces:
  - `mount() -> void` — passa a reagir a mudanças de seleção
  - `setDeleteHandler(fn) -> void` — Task 6 injeta a função de apagar aqui

A barra **não** importa `trash.js`. Ela recebe a função por injeção, para não
criar ciclo de require (`trash` precisa da barra para mostrar status).

- [ ] **Step 1: Implementar**

Crie `src/renderer/lib/selection/action-bar.js`:

```js
const { ELEMENTS } = require('../../../utils/elements')

const sel = require('./selection')

// Guarda os filhos originais da topBar pra restaurar quando a selecao esvazia
const topBar = document.querySelector('#topBar')
const conteudoOriginal = [...topBar.children]

let apagar = () => {}

const setDeleteHandler = (fn) => {
  apagar = fn
}

let barra = null

const construirBarra = () => {
  const el = document.createElement('div')
  el.className = 'selection-bar'

  const contagem = document.createElement('span')
  contagem.className = 'selection-count'

  const botaoApagar = document.createElement('button')
  botaoApagar.className = 'danger'
  botaoApagar.textContent = 'Apagar'
  botaoApagar.onclick = () => apagar()

  const botaoCancelar = document.createElement('button')
  botaoCancelar.textContent = 'Cancelar'
  botaoCancelar.onclick = () => sel.clear()

  el.append(contagem, botaoApagar, botaoCancelar)
  el._contagem = contagem
  return el
}

const render = () => {
  const n = sel.count()

  if (n === 0) {
    if (barra) barra.remove()
    barra = null
    conteudoOriginal.forEach((el) => topBar.appendChild(el))
    return
  }

  if (!barra) {
    conteudoOriginal.forEach((el) => el.remove())
    barra = construirBarra()
    topBar.appendChild(barra)
  }

  barra._contagem.textContent = n === 1 ? '1 selecionado' : `${n} selecionados`
}

const mount = () => {
  sel.onChange(render)
}

module.exports = { mount, setDeleteHandler }
```

Guardar os filhos originais em vez de salvar `innerHTML` é deliberado:
`#settingsForm` tem um checkbox com estado e listeners; recriá-lo por HTML
perderia os dois.

Em `src/renderer/lib/selection/index.js`, passe a montar a barra:

```js
// Boot da fase 2. Unico require novo no src/renderer/index.js.
const ui = require('./selection-ui')
const actionBar = require('./action-bar')

ui.mount()
actionBar.mount()

module.exports = {}
```

- [ ] **Step 2: Verificar rodando**

```bash
yarn start
```

1. Sem seleção → a `#topBar` mostra o texto de status e o checkbox
   "always on top", como antes.
2. Selecione 1 item → a topBar troca para **"1 selecionado"** + botões
   "Apagar" e "Cancelar".
3. Selecione mais 2 → **"3 selecionados"**.
4. Clique em **Cancelar** → a seleção limpa e a topBar volta **com o checkbox
   "always on top" ainda funcionando**. Marque e desmarque ele para confirmar
   que o listener sobreviveu: a janela deve ir para frente/trás de verdade.
5. Repita o ciclo selecionar → cancelar 3 vezes seguidas e confirme, no
   DevTools, que a topBar não acumulou elementos duplicados:

```js
console.log(document.querySelector('#topBar').children.length)
```

Esperado: o mesmo número antes e depois dos 3 ciclos (2, com o `#statusText` e
o `#settingsForm`).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/lib/selection/action-bar.js src/renderer/lib/selection/index.js
git commit -m "feat(selecao): barra de acao reaproveitando a topBar"
```

---

## Task 6: Delete com confirmação

**Files:**
- Create: `src/renderer/lib/selection/trash.js`
- Modify: `src/renderer/lib/selection/index.js`

**Interfaces:**
- Consumes: `selection.js` (Task 2), `store-adapter.js` (Task 1), canal
  `trash-files` (Task 3), `action-bar.setDeleteHandler` (Task 5)
- Produces:
  - `deleteSelected() -> Promise<void>`
  - `lastBatch() -> { name, entry }[] | null` — consumido pela Task 7

- [ ] **Step 1: Implementar**

Crie `src/renderer/lib/selection/trash.js`:

```js
const fs = require('fs')

const { ipcRenderer } = require('electron')
const { dialog, getCurrentWindow } = require('@electron/remote')

const { showStatus } = require('../../../utils/show-status')
const { CONSTANTS } = require('../../../utils/constants')

const sel = require('./selection')
const adapter = require('./store-adapter')

// Pilha de UM nivel (secao 7): so o ultimo lote, nao historico
let ultimoLote = null

const lastBatch = () => ultimoLote

// 1 item nao confirma — a Lixeira ja e' o undo. 2+ confirma mostrando a contagem,
// porque e' onde um clique errado leva 40 arquivos.
const confirmar = async (n) => {
  if (n < 2) return true

  const { response } = await dialog.showMessageBox(getCurrentWindow(), {
    type: 'warning',
    buttons: ['Apagar', 'Cancelar'],
    defaultId: 0,
    cancelId: 1,
    message: `Mover ${n} arquivos para a Lixeira?`,
    detail: 'Da pra recuperar com Cmd+Z ou pelo Finder.',
  })

  return response === 0
}

const deleteSelected = async () => {
  const nomes = sel.names()
  if (!nomes.length) return

  if (!(await confirmar(nomes.length))) return

  // Snapshot ANTES de apagar: depois do trash a entrada do indice ja era
  const lote = nomes.map((name) => ({ name, entry: adapter.indexGet(name) }))

  const { ok, fail } = await ipcRenderer.invoke(
    'trash-files',
    nomes.map((name) => adapter.filePath(name)),
  )

  const apagados = new Set(ok.map((p) => p.split('/').pop()))

  // As outras duas coisas que cada exclusao faz (secao 7), so pros que foram mesmo
  lote
    .filter(({ name }) => apagados.has(name))
    .forEach(({ name }) => {
      adapter.indexRemove(name)
      try {
        fs.rmSync(adapter.thumbPath(name), { force: true })
      } catch (erro) {
        // thumb e' regeneravel: nao vale abortar a exclusao por causa dele
        console.warn('thumb nao apagado:', name, erro.message)
      }
    })

  await adapter.indexSave()

  ultimoLote = lote.filter(({ name }) => apagados.has(name))

  sel.clear()
  adapter.repaint()

  if (fail.length) {
    showStatus(
      `${ok.length} na Lixeira, ${fail.length} falharam: ${fail[0].error}`,
      'var(--pink)',
    )
    console.error('falhas ao apagar:', fail)
    return
  }

  const quantos = ok.length === 1 ? '1 arquivo' : `${ok.length} arquivos`
  showStatus(`${quantos} na Lixeira — Cmd+Z desfaz`)
}

module.exports = { deleteSelected, lastBatch, CONSTANTS }
```

Em `src/renderer/lib/selection/index.js`, ligue o botão "Apagar":

```js
// Boot da fase 2. Unico require novo no src/renderer/index.js.
const ui = require('./selection-ui')
const actionBar = require('./action-bar')
const trash = require('./trash')

ui.mount()
actionBar.mount()
actionBar.setDeleteHandler(trash.deleteSelected)

module.exports = {}
```

- [ ] **Step 2: Verificar rodando — com arquivos descartáveis**

**Não teste com a biblioteca real.** Crie iscas primeiro:

```bash
for i in 1 2 3; do cp build/icon.png ~/veditbox/isca-$i.png; done
rtk ls ~/veditbox | grep isca
```

Reinicie o app (`yarn start`) para o índice adotar as iscas.

1. Selecione **1** isca → clique "Apagar" → **não** deve aparecer confirmação.
   O arquivo some do grid, e o status diz "1 arquivo na Lixeira — Cmd+Z desfaz".
2. Selecione as **2** iscas restantes → clique "Apagar" → aparece um alerta
   nativo dizendo **"Mover 2 arquivos para a Lixeira?"**. Clique **Cancelar** →
   nada acontece, a seleção continua intacta.
3. Clique "Apagar" de novo → **Apagar** → as duas somem.

Agora meça o filesystem real, no terminal:

```bash
rtk ls ~/veditbox | grep isca || echo "saiu da pasta: ok"
rtk ls ~/.Trash | grep isca
rtk ls /tmp/veditbox | grep isca || echo "thumbs apagados: ok"
node -e "const i=require(require('os').homedir()+'/veditbox/.veditbox/index.json'); console.log(Object.keys(i).filter(k=>k.includes('isca')))"
```

Esperado, nesta ordem: nada em `~/veditbox`; **as 3 iscas em `~/.Trash`**; nada
em `/tmp/veditbox`; array **vazio** do índice. As três coisas de §7,
todas verificadas contra o disco.

4. Abra a Lixeira no Finder, confirme que as iscas estão lá, e **deixe-as lá** —
   a Task 7 vai precisar delas. Ainda não esvazie.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/lib/selection/trash.js src/renderer/lib/selection/index.js
git commit -m "feat(selecao): delete em lote pra Lixeira com confirmacao a partir de 2"
```

---

## Task 7: Undo de um nível

**Files:**
- Modify: `src/renderer/lib/selection/trash.js`

**Interfaces:**
- Consumes: canal `untrash-files` (Task 3), `lastBatch()` (Task 6)
- Produces: `undoLastDelete() -> Promise<void>`

- [ ] **Step 1: Implementar**

Em `src/renderer/lib/selection/trash.js`, adicione antes do `module.exports`:

```js
const undoLastDelete = async () => {
  if (!ultimoLote || !ultimoLote.length) {
    showStatus('Nada pra desfazer')
    return
  }

  const lote = ultimoLote

  const { ok, fail } = await ipcRenderer.invoke(
    'untrash-files',
    lote.map(({ name }) => name),
    CONSTANTS.destDownloadFolder,
  )

  const restaurados = new Set(ok)

  lote
    .filter(({ name }) => restaurados.has(name))
    .forEach(({ name, entry }) => {
      // entry undefined = arquivo adotado sem entrada no indice; nada a repor
      if (entry) adapter.indexPut(name, entry)
    })

  await adapter.indexSave()

  // Pilha de UM nivel: consumida, nao empilhada. Um segundo Cmd+Z nao faz nada.
  ultimoLote = null

  adapter.repaint()

  // Best-effort: falha e avisa, nunca finge sucesso (secao 7)
  if (fail.length) {
    showStatus(
      `${ok.length} restaurados, ${fail.length} nao: ${fail[0].error}`,
      'var(--pink)',
    )
    console.error('falhas ao restaurar:', fail)
    return
  }

  const quantos = ok.length === 1 ? '1 arquivo' : `${ok.length} arquivos`
  showStatus(`${quantos} restaurados da Lixeira`)
}
```

E atualize o export:

```js
module.exports = { deleteSelected, undoLastDelete, lastBatch, CONSTANTS }
```

- [ ] **Step 2: Verificar rodando — inclusive o caminho de falha**

O caminho feliz já foi verificado por asserção na Task 3. O que precisa de olho
humano aqui é o caminho de falha, que é onde "fingir sucesso" acontece.

```bash
yarn start
```

**Caminho feliz:**

1. Crie 2 iscas novas, reinicie o app, selecione as duas, apague (confirmando).
2. No console do DevTools:

```js
require('./src/renderer/lib/selection/trash').undoLastDelete()
```

3. Esperado: as duas voltam ao grid, e o status diz "2 arquivos restaurados da
   Lixeira". Confirme no disco:

```bash
rtk ls ~/veditbox | grep isca
node -e "const i=require(require('os').homedir()+'/veditbox/.veditbox/index.json'); console.log(Object.keys(i).filter(k=>k.includes('isca')))"
```

Esperado: os arquivos de volta na pasta **e** as chaves de volta no índice.

4. Chame `undoLastDelete()` de novo → esperado: **"Nada pra desfazer"**, e
   nada acontece. Pilha de um nível, consumida.

**Caminho de falha — este é o ponto da task:**

5. Apague 1 isca pelo app.
6. Esvazie a Lixeira (Finder → Esvaziar Lixeira), ou só o item:

```bash
rtk ls ~/.Trash | grep isca
rm ~/.Trash/isca-*.png
```

7. Chame `undoLastDelete()`.
8. Esperado: status **vermelho** dizendo `0 restaurados, 1 nao: nao esta mais
   na Lixeira`. **Nada de mensagem de sucesso.** O arquivo continua sem existir
   em `~/veditbox`, e o índice continua sem a chave:

```bash
rtk ls ~/veditbox | grep isca || echo "correto: nao voltou"
```

Se o app disser que restaurou algo aqui, o requisito de §7 ("falha e avisa em
vez de fingir sucesso") está violado — corrija antes de seguir.

9. Limpe as iscas restantes:

```bash
rm -f ~/veditbox/isca-*.png ~/.Trash/isca-*.png /tmp/veditbox/isca-*
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/lib/selection/trash.js
git commit -m "feat(selecao): undo de um nivel restaurando da Lixeira"
```

---

## Task 8: Atalhos de teclado

Deixado por último de propósito: cada peça já foi verificada pelo caminho do
mouse/console, então uma falha aqui é inequivocamente do teclado.

**Files:**
- Create: `src/renderer/lib/selection/shortcuts.js`
- Modify: `src/renderer/lib/selection/index.js`

**Interfaces:**
- Consumes: `selection.js`, `store-adapter.js`, `trash.js`
- Produces: `mount() -> void`

- [ ] **Step 1: Implementar**

Crie `src/renderer/lib/selection/shortcuts.js`:

```js
const sel = require('./selection')
const adapter = require('./store-adapter')
const trash = require('./trash')

// addEventListener, NUNCA window.onkeydown = : o gravador de audio usa a
// propriedade (recorder/audio/index.js), e uma segunda atribuicao o apagaria.
const mount = () => {
  window.addEventListener('keydown', (event) => {
    // Cmd+A: seleciona tudo dentro do filtro/aba atual (secao 7)
    if (event.metaKey && event.key === 'a') {
      const nomes = adapter.visibleNames()
      if (!nomes.length) return
      event.preventDefault()
      sel.selectAll(nomes)
      return
    }

    // Cmd+Z: undo do ultimo lote
    if (event.metaKey && event.key === 'z') {
      event.preventDefault()
      trash.undoLastDelete()
      return
    }

    // Cmd+Delete: apaga a selecao (secao 7). Backspace e' a tecla Delete do Mac.
    if (event.metaKey && (event.key === 'Backspace' || event.key === 'Delete')) {
      if (sel.count() === 0) return
      event.preventDefault()
      trash.deleteSelected()
      return
    }

    // Esc: limpa a selecao. So consome o evento se havia algo selecionado,
    // pra nao roubar o Esc de quem fecha modal.
    if (event.key === 'Escape' && sel.count() > 0) {
      event.preventDefault()
      sel.clear()
    }
  })
}

module.exports = { mount }
```

Sobre `Cmd+A` fora do grid: `visibleNames()` retorna `[]` quando não há grid na
tela (home, preview), e nesse caso o handler **não** chama `preventDefault` — o
select-all nativo continua funcionando onde faz sentido.

Em `src/renderer/lib/selection/index.js`:

```js
// Boot da fase 2. Unico require novo no src/renderer/index.js.
const ui = require('./selection-ui')
const actionBar = require('./action-bar')
const trash = require('./trash')
const shortcuts = require('./shortcuts')

ui.mount()
actionBar.mount()
actionBar.setDeleteHandler(trash.deleteSelected)
shortcuts.mount()

module.exports = {}
```

- [ ] **Step 2: Verificar rodando, com atenção à regressão do gravador**

Crie 4 iscas e reinicie o app.

1. Numa aba com arquivos, **`Cmd+A`** → todos os itens da aba ficam
   selecionados, e a topBar mostra a contagem certa.
2. **Confirme que é o filtro, não a biblioteca:** vá para a aba `image`,
   `Cmd+A`, e compare a contagem da topBar com o número de itens na tela. Devem
   bater. Se `Cmd+A` selecionar a biblioteca inteira, `visibleNames()` está
   lendo a fonte errada — §7 diz "dentro da aba/filtro atual".
3. **`Esc`** → limpa; topBar volta ao normal.
4. Selecione 2 iscas, **`Cmd+Delete`** → aparece a confirmação. Confirme →
   somem.
5. **`Cmd+Z`** → voltam.
6. Sem nada selecionado, aperte **`Cmd+Delete`** → **nada acontece**.
   Sem confirmação, sem erro no console.

**Regressão obrigatória — o handler do gravador de áudio:**

7. Aperte **`r`** (sem modificador) → a gravação de áudio deve começar, como
   sempre. Aperte `r` de novo para parar.
8. Abra um vídeo no preview e aperte **espaço** → play/pause deve funcionar.

Se 7 ou 8 falharem, algum `window.onkeydown =` foi introduzido em vez de
`addEventListener`. É a armadilha nomeada na decisão 5 desta fase.

9. Com uma seleção ativa, aperte **`Esc`** e confirme que o modal de ajuda
   (`#helpBtn`) ainda abre e fecha com `Esc` normalmente depois.

10. Limpe as iscas:

```bash
rm -f ~/veditbox/isca-*.png ~/.Trash/isca-*.png /tmp/veditbox/isca-*
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/lib/selection/shortcuts.js src/renderer/lib/selection/index.js
git commit -m "feat(selecao): Cmd+A, Esc, Cmd+Delete e Cmd+Z"
```

---

## Task 9: Verificação de fluxo completo instrumentada, e reversão

§12 é explícito: fluxo de UI se verifica instrumentando o main com
`executeJavaScript`, medindo DOM e filesystem reais, **e revertendo a
instrumentação**. As tasks anteriores verificaram com mouse e console; esta
fecha o ciclo sem humano no meio, e é a que pega o que a mão distraída deixa
passar.

**Files:**
- Create: `scripts/check-selection-flow.js`
- Modify (temporariamente): `src/main/index.js`

**Interfaces:**
- Consumes: tudo das Tasks 1–8.
- Produces: nada em produção. Este é o portão final da fase.

- [ ] **Step 1: Escrever o roteiro de instrumentação**

Crie `scripts/check-selection-flow.js`. Ele é `require`ado pelo main, recebe a
janela, e dirige o renderer de fora:

```js
// Verificacao de fluxo da fase 2. NAO faz parte do app — e' instrumentacao
// temporaria (secao 12). Removida no Step 5 desta task.
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const destDir = path.join(os.homedir(), 'veditbox')
const trashDir = path.join(os.homedir(), '.Trash')

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

const rodar = async (win) => {
  const js = (codigo) => win.webContents.executeJavaScript(codigo)

  const iscas = [1, 2, 3, 4].map((i) => `isca-flow-${i}.png`)

  try {
    // 1. iscas reais na pasta, e recarrega pra Fase 1 adotar
    iscas.forEach((nome) => fs.copyFileSync('build/icon.png', path.join(destDir, nome)))
    win.reload()
    await esperar(3000)

    // 2. entra na aba de imagens
    await js(`document.querySelector('#menu li[data-tab="image"]').click()`)
    await esperar(1000)

    const visiveis = await js(
      `require('./src/renderer/lib/selection/store-adapter').visibleNames().length`,
    )
    assert.ok(visiveis >= 4, `grid so tem ${visiveis} itens, esperado >= 4`)

    // 3. checkbox existe em todo item apos o hover-paint
    const comCheckbox = await js(
      `document.querySelectorAll('.library-item .select-box').length`,
    )
    assert.strictEqual(comCheckbox, visiveis, 'nem todo item tem checkbox')

    // 4. Cmd+A seleciona exatamente o que esta visivel na aba
    await js(`
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true }))
    `)
    await esperar(200)

    const selecionados = await js(`require('./src/renderer/lib/selection/selection').count()`)
    assert.strictEqual(selecionados, visiveis, 'Cmd+A nao bateu com o grid visivel')

    const pintados = await js(`document.querySelectorAll('.library-item.selected').length`)
    assert.strictEqual(pintados, visiveis, 'DOM nao refletiu a selecao')

    const textoBarra = await js(`document.querySelector('.selection-count').textContent`)
    assert.strictEqual(textoBarra, `${visiveis} selecionados`, `barra diz "${textoBarra}"`)

    // 5. Esc limpa, e a topBar volta ao estado original
    await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
    await esperar(200)

    assert.strictEqual(
      await js(`require('./src/renderer/lib/selection/selection').count()`),
      0,
      'Esc nao limpou',
    )
    assert.strictEqual(
      await js(`!!document.querySelector('#settingsForm')`),
      true,
      'topBar nao restaurou o settingsForm',
    )

    // 6. seleciona so as iscas e apaga (sem passar pela confirmacao nativa,
    //    que nao da pra clicar daqui — a confirmacao ja foi verificada na Task 6)
    await js(`
      const sel = require('./src/renderer/lib/selection/selection')
      sel.clear()
      sel.selectAll(${JSON.stringify(iscas)})
      require('./src/renderer/lib/selection/trash').deleteSelected()
    `)
    await esperar(2500)

    // 7. as TRES coisas da secao 7, medidas no disco
    iscas.forEach((nome) => {
      assert.strictEqual(fs.existsSync(path.join(destDir, nome)), false, `${nome} na pasta`)
      assert.strictEqual(fs.existsSync(path.join(trashDir, nome)), true, `${nome} fora da Lixeira`)
    })

    const indice = JSON.parse(
      fs.readFileSync(path.join(destDir, '.veditbox', 'index.json'), 'utf8'),
    )
    iscas.forEach((nome) => {
      assert.strictEqual(indice[nome], undefined, `${nome} ainda no indice`)
      assert.strictEqual(
        fs.existsSync(path.join('/tmp/veditbox', `${nome}.jpg`)),
        false,
        `thumb de ${nome} sobrou`,
      )
    })

    // 8. selecao limpou sozinha e a topBar voltou
    assert.strictEqual(
      await js(`require('./src/renderer/lib/selection/selection').count()`),
      0,
      'selecao nao limpou apos apagar',
    )

    // 9. Cmd+Z traz de volta, arquivo E indice
    await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))`)
    await esperar(2000)

    iscas.forEach((nome) => {
      assert.strictEqual(fs.existsSync(path.join(destDir, nome)), true, `${nome} nao voltou`)
    })

    // 10. segundo Cmd+Z nao faz nada (pilha de UM nivel)
    await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))`)
    await esperar(800)
    const status = await js(`document.querySelector('#statusText').textContent`)
    assert.ok(/nada pra desfazer/i.test(status), `segundo Cmd+Z disse: "${status}"`)

    console.log('ok: fluxo de selecao, delete e undo')
  } catch (erro) {
    console.error('FALHOU:', erro.message)
    process.exitCode = 1
  } finally {
    // limpa tudo que o script criou, passando ou falhando
    iscas.forEach((nome) => {
      fs.rmSync(path.join(destDir, nome), { force: true })
      fs.rmSync(path.join(trashDir, nome), { force: true })
      fs.rmSync(path.join('/tmp/veditbox', `${nome}.jpg`), { force: true })
    })
  }
}

module.exports = { rodar }
```

- [ ] **Step 2: Instrumentar o main temporariamente**

Em `src/main/index.js`, **anote a linha exata** que você vai adicionar, porque
o Step 5 a remove. No fim do arquivo:

```js
// INSTRUMENTACAO TEMPORARIA — remover (fase 2, task 9)
if (process.env.VEDITBOX_CHECK_FLOW) {
  app.whenReady().then(async () => {
    await new Promise((r) => win.webContents.once('did-finish-load', r))
    await require('../../scripts/check-selection-flow').rodar(win)
    app.exit(process.exitCode || 0)
  })
}
```

- [ ] **Step 3: Rodar**

```bash
VEDITBOX_CHECK_FLOW=1 npx electron .
```

Esperado: `ok: fluxo de selecao, delete e undo` e saída 0.

Se travar em algum `esperar`, aumente o tempo antes de suspeitar da lógica — a
Fase 1 gera thumbnails sob demanda e o primeiro paint pode demorar mais que os
3s do Step 1.

Se falhar em "thumb de X sobrou": o `thumbPath()` da Task 1 está errado.
Volte ao Step 2 da Task 1 e meça de novo o padrão de nome real.

- [ ] **Step 4: Confirmar que a máquina ficou limpa**

```bash
rtk ls ~/veditbox | grep isca-flow || echo "pasta limpa"
rtk ls ~/.Trash | grep isca-flow || echo "lixeira limpa"
rtk ls /tmp/veditbox | grep isca-flow || echo "tmp limpo"
```

Esperado: as três mensagens de "limpo".

- [ ] **Step 5: REVERTER a instrumentação**

Requisito de §12, não opcional.

Remova de `src/main/index.js` o bloco inteiro adicionado no Step 2, e confirme
que não sobrou nada:

```bash
rtk grep -n "VEDITBOX_CHECK_FLOW\|check-selection-flow" src/
```

Esperado: **zero resultados em `src/`**. O `scripts/check-selection-flow.js`
continua versionado — é a receita para rodar de novo —, mas o `src/` volta
limpo.

Confirme que o app normal ainda sobe:

```bash
yarn start
```

Esperado: janela abre, aba com arquivos funciona, seleção funciona, e **nada**
acontece automaticamente.

- [ ] **Step 6: Registrar em `version.md` e commitar**

Em `version.md`, adicione no topo da lista de mudanças:

```md
- Seleção múltipla no grid (checkbox no hover, Shift+clique, Cmd+A, Esc),
  delete em lote para a Lixeira do sistema (Cmd+Delete, confirma a partir de
  2 arquivos) e undo de um nível (Cmd+Z).
```

```bash
git add scripts/check-selection-flow.js version.md src/main/index.js
git commit -m "test(selecao): verificacao de fluxo instrumentada, instrumentacao revertida"
```

---

## Self-review contra o contrato

Checagem de cobertura de §7, feita depois de escrever o plano.

| Requisito de §7 | Task | Verificado por |
|---|---|---|
| clique simples → preview | 4 | Step 4.2, manual |
| checkbox no hover, única parte descobrível | 4 | Step 4.1, e Task 9 Step 3 conta os checkboxes no DOM |
| em modo seleção, clique alterna | 4 | Step 4.4 |
| `Shift+clique` estende intervalo | 2 (lógica) + 4 (UI) | `check-selection-range.js` + Step 4.5/4.6 |
| `Cmd+A` dentro da aba/filtro atual | 8 | Step 8.2 explicitamente compara com a aba, e Task 9 Step 4 |
| `Esc` limpa | 8 | Step 8.3 + Task 9 Step 5 |
| `#topBar` troca por "N selecionados" | 5 | Step 5.2 + Task 9 Step 4 |
| delete via `shell.trashItem()` | 3 | `check-trash-roundtrip.js` |
| Lixeira + índice + thumb, as três | 6 | Step 6.2 mede as três no disco; Task 9 Step 7 automatiza |
| 1 item sem confirmar | 6 | Step 6.2.1 |
| 2+ confirma com contagem | 6 | Step 6.2.2 |
| `Cmd+Delete` dispara | 8 | Step 8.4 |
| Undo `Cmd+Z` move de volta e restaura entradas | 3 + 7 | asserção na Task 3, fluxo na Task 9 Step 9 |
| Pilha de UM nível | 7 | Step 7.2.4 + Task 9 Step 10 |
| Best-effort: falha e avisa, não finge | 3 + 7 | asserções 3/4 do `check-trash-roundtrip` + Step 7.2, caminho de falha |
| **Não** construir detector de duplicados/vazios | — | nenhuma task menciona |

Fronteiras respeitadas: nenhuma task toca busca, tags, sheet ou design system.
O grid não é reescrito — apenas lido e decorado.

---

## Ordem e paralelismo interno

```
Task 1 (adapter, confirma Fase 1)
   |
   +--> Task 2 (estado puro)  ----+
   |                              |
   +--> Task 3 (ipc lixeira) -----+--> Task 4 (checkbox/UI)
                                       |
                                       v
                                    Task 5 (barra)
                                       |
                                       v
                                    Task 6 (delete)
                                       |
                                       v
                                    Task 7 (undo)
                                       |
                                       v
                                    Task 8 (atalhos)
                                       |
                                       v
                                    Task 9 (fluxo + reversão)
```

Tasks 2 e 3 não se tocam (uma é lógica pura, a outra é o main) e podem ser
feitas em qualquer ordem, ou em paralelo. Da 4 em diante é uma corrente: cada
uma verifica pelo caminho que a anterior abriu.
