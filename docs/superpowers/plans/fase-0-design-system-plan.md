# Fase 0 — Design System (Franken UI vendorizado) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** colocar o Franken UI dentro do repo (offline, sem CDN), ligar os tokens
de cor que já existem em `index.css` aos tokens do Franken, e migrar o chrome
existente (sidebar, topBar, dialog de ajuda) para o design system — sem tocar no
grid.

**Architecture:** o Franken UI 2.x compila para CSS com `@layer theme, base,
components, utilities`. **Todo CSS sem layer vence qualquer layer**, então
`index.css` (que não usa layers) continua ganhando de tudo que o Franken traz.
Isso é o alicerce da fase: o Franken entra por baixo, não por cima. A migração
vira opt-in classe por classe, e o CSS do grid fica intocado por construção, não
por disciplina. Um arquivo novo `styles/theme.css` reescreve os tokens do Franken
com a paleta que já existe (`--gray-100`, `--pink`, …) convertida para o formato
de triplete HSL que o Franken usa.

**Tech Stack:** Franken UI 2.1.2 (UIkit 3 + Lit, IIFE), CSS custom properties,
`<dialog>` nativo, lucide (já instalado). Zero dependência nova no
`package.json`.

**Spec:** `docs/superpowers/specs/2026-09-05-veditbox-gerenciador-midias-design.md`
(§9 Design system, §9.1, §10 Fases, §10.1 Protocolo de merge, §12 Testes)

---

## Emendas ao plano (contrato venceu)

O contrato ganhou §8.0, §9.1 e §10.1 depois que este plano foi escrito. Três
coisas mudaram, o contrato venceu nas três:

1. **§10.1 — `src/main/index.js` é append-only.** O plano original enfiava um
   bloco de probe dentro de `createWindow()` e o revertia na Task 7. Proibido
   agora: quatro fases compartilham o arquivo e é onde os merges explodem.
   **Novo desenho:** o probe vira `src/main/probe.js`, um módulo que se pendura
   em `app.on('browser-window-created')` — não precisa da variável `win`, que não
   é exportada — e `src/main/index.js` recebe **uma única linha** de `require` no
   fim. Fica permanente, inerte sem `VEDITBOX_PROBE`, e as Fases 1–3 reusam.
   Some a Task 7 Step 4 (reversão): não há o que reverter.

2. **§9.1 — nova responsabilidade da Fase 0:** `src/utils/elements.js:12` usa
   `querySelector('dialog')`, que sequestra o botão de ajuda assim que a Fase 3
   criar o `<dialog>` do Cmd+K. Vira **Task 4b**: `id="helpDialog"` no HTML e
   seletor por id. §10.1 dá a Fase 0 como dona única de `elements.js`.

3. **§9.1 — o dialog de ajuda continua `<dialog>` nativo.** Era objeção minha,
   respondida: `uk-modal` não é usado em lugar nenhum do app, e confirmação
   destrutiva (Fase 2) usa `dialog.showMessageBox` do main. A Task 5 já estava
   certa; agora é norma, não escolha local.

Também herdado de §10.1: `src/renderer/styles/index.css` tem **dono único: Fase
0**. Mas as regras do grid continuam intocadas — a Fase 1 é quem as move para
`styles/grid.css`.

E de §8.0: nenhuma fase pode fazer `window.onkeydown = ...`. A Fase 0 não
registra teclado, mas o probe passa a conferir que o handler do gravador de áudio
continua vivo.

---

## Global Constraints

Valores copiados do contrato e do código atual. Valem para **todas** as tasks.

- **JS puro, CommonJS (`require`), sem bundler, sem framework, sem TypeScript,
  sem framework de teste.** Nada disso entra nesta fase.
- **Sem ponto e vírgula, aspas simples/backticks** (`.prettierrc`).
- **Nenhuma dependência nova em `package.json`.** Franken UI entra como arquivo
  versionado, não como pacote npm — `"files"` do electron-builder inclui
  `node_modules/**/*`, então instalar o pacote colocaria ~3 MB de fonte
  TypeScript/CLI dentro do `.dmg` para usar 2 arquivos.
- **Vendorizar local, nunca CDN.** `index.html` tem
  `Content-Security-Policy: script-src 'self' 'unsafe-inline'` e o app precisa
  funcionar offline.
- **Não trazer `utilities.min.css`.** (Ver §9 do contrato. Nota: o contrato diz
  "~91 kB"; no 2.1.2 o arquivo tem **617 KB**. A decisão de não trazer não muda —
  ver "Objeções" no fim.)
- **Não trazer `icon.iife.js`** (386 KB de ícones Lucide). O repo já tem o pacote
  `lucide` e `src/utils/lucide-icons.js`. Rung 2 da escada: já existe aqui.
- **Nenhuma fonte web.** O Franken pede `Geist Sans`/`Geist Mono` e cai em
  `ui-sans-serif`/`ui-monospace` quando não existem. Baixar fonte é peso e
  `index.css` já define `font: 10px monospace` no `body`.
- **FRONTEIRA — não tocar no grid.** É proibido editar:
  - `src/renderer/lib/library.js` (arquivo inteiro — dono é a Fase 1)
  - `src/utils/set-tab.js`
  - as regras `.library-grid`, `.library-item`, `.library-item::before`,
    `.library-item > *`, `.library-audio`, `.library-empty`,
    `.library-preview`, `.library-back` em `index.css`
  - o contrato de seletor `#menu li[data-tab]` — `library.js` e `set-tab.js`
    fazem `document.querySelectorAll('#menu li')`. Os `<li>` **continuam sendo
    `<li>`**, com o mesmo `data-tab` e a mesma classe `active`. Só ganham
    classes a mais.
- **Medidas do frame são contrato com o processo main.** `src/main/index.js` usa
  `titleBarStyle: 'hiddenInset'` com `trafficLightPosition: { x: 13, y: 12 }`.
  As fórmulas são:
  - `y = (altura do #topBar − 12) / 2` → `(36 − 12) / 2 = 12`
  - `x = (largura do #menu − 52) / 2` → `(78 − 52) / 2 = 13`
  (12 px é a altura dos botões; 52 px é a largura do grupo de três.)
  Se `#topBar` deixar de medir 36 px ou `#menu` deixar de medir 78 px, **os dois
  números têm que ser recalculados por essas fórmulas** e o resultado conferido
  no screenshot do probe. A Task 7 é o portão que verifica isso.
- **Registrar a mudança em `version.md`** (convenção do `AGENTS.md`).

---

## File Structure

**Criados:**

| Arquivo | Responsabilidade |
|---|---|
| `src/renderer/lib/vendor/franken-ui/core.min.css` | CSS do Franken, cópia literal do pacote npm. Nunca editar à mão. |
| `src/renderer/lib/vendor/franken-ui/core.iife.js` | JS do Franken (UIkit + Lit + custom elements). Cópia literal. Nunca editar à mão. |
| `src/renderer/lib/vendor/franken-ui/VENDOR.md` | Procedência: versão, comando exato pra re-baixar, o que foi omitido e por quê. |
| `src/renderer/styles/theme.css` | Ponte de tokens: paleta do veditbox → variáveis do Franken. Único lugar onde cor vira token. |
| `tools/probes/chrome-metrics.js` | Probe de DOM: mede topBar, menu, tokens, custom elements. |
| `tools/probes/grid-snapshot.js` | Probe de regressão: computed style do grid, pra provar que a Fase 1 não foi invadida. |
| `tools/check-theme-tokens.js` | Script Node com asserções: hex → triplete HSL bate de volta no hex. |

**Modificados:**

| Arquivo | O que muda |
|---|---|
| `src/renderer/index.html` | `class="dark"` no `<html>`, links de CSS na ordem certa, `<script>` do Franken, classes `uk-*` no chrome e no dialog. |
| `src/renderer/styles/index.css` | Só as regras de chrome (`#menu`, `#topBar`, `dialog`). Regras do grid: intocadas. |
| `src/main/index.js` | **Temporário.** Bloco de probe entre marcadores, revertido na Task 7. |
| `version.md` | Entrada da fase. |

**Ordem das tasks:** 1 vendoriza, 2 constrói o aparato de verificação, 3 liga o
Franken e prova que nada mudou, 4 mapeia tokens, 5–6 migram chrome, 7 fecha e
reverte a instrumentação.

---

### Task 1: Vendorizar o Franken UI

Só arquivos e procedência. Nada é carregado ainda — o app tem que continuar
idêntico ao fim desta task.

**Files:**
- Create: `src/renderer/lib/vendor/franken-ui/core.min.css`
- Create: `src/renderer/lib/vendor/franken-ui/core.iife.js`
- Create: `src/renderer/lib/vendor/franken-ui/VENDOR.md`

**Interfaces:**
- Consumes: nada.
- Produces: os dois caminhos de arquivo acima, usados pela Task 3. Depois de
  carregados, `window.UIkit` (objeto global) e os custom elements
  `uk-command`, `uk-input-tag`, `uk-select`, `uk-calendar`, `uk-input-date`,
  `uk-input-time`, `uk-input-range`, `uk-input-pin`, `uk-keyval`,
  `uk-theme-switcher`, `uk-lsh` — verificado no bundle 2.1.2.

- [ ] **Step 1: Baixar o pacote num diretório temporário**

`npm pack` baixa o tarball publicado sem instalar nada no projeto.

```bash
mkdir -p /tmp/fu-vendor && cd /tmp/fu-vendor
npm pack franken-ui@2.1.2
tar xzf franken-ui-2.1.2.tgz
ls -la package/dist/css package/dist/js
```

Esperado: `css/core.min.css`, `css/utilities.min.css`, `js/core.iife.js`,
`js/icon.iife.js`, `js/chart.iife.js`, `js/rte.iife.js`.

- [ ] **Step 2: Copiar só os dois arquivos que a fase usa**

```bash
cd /Users/maykbrito/Developer/2506/veditbox-fase0
mkdir -p src/renderer/lib/vendor/franken-ui
cp /tmp/fu-vendor/package/dist/css/core.min.css src/renderer/lib/vendor/franken-ui/
cp /tmp/fu-vendor/package/dist/js/core.iife.js   src/renderer/lib/vendor/franken-ui/
```

- [ ] **Step 3: Verificar integridade e ausência de armadilhas**

O `core.iife.js` roda com `nodeIntegration: true`. Duas coisas precisam ser
verdade: não pode usar `eval`/`new Function` (CSP `script-src 'self'
'unsafe-inline'` não libera `unsafe-eval`), e não pode ser UMD — se detectasse
`module.exports` ele exportaria em vez de setar `window.UIkit`.

```bash
cd src/renderer/lib/vendor/franken-ui
shasum -a 256 core.min.css core.iife.js
grep -c 'new Function\|eval(' core.iife.js || echo "0 ocorrencias — ok"
grep -c 'typeof exports\|typeof module' core.iife.js || echo "0 ocorrencias — ok (IIFE puro)"
grep -o 'window.UIkit=' core.iife.js | head -1
```

Esperado: as duas buscas de `eval` e de UMD retornam **0**; `window.UIkit=`
aparece. Anotar os dois SHA-256 — eles vão para o `VENDOR.md` no próximo passo.

- [ ] **Step 4: Escrever a procedência**

Crie `src/renderer/lib/vendor/franken-ui/VENDOR.md` (substitua `<sha…>` pelos
valores impressos no Step 3):

```markdown
# Franken UI — vendorizado

Versão: **2.1.2** (npm `franken-ui`)

## Como re-baixar / atualizar

    mkdir -p /tmp/fu-vendor && cd /tmp/fu-vendor
    npm pack franken-ui@<versao>
    tar xzf franken-ui-<versao>.tgz
    cp package/dist/css/core.min.css <repo>/src/renderer/lib/vendor/franken-ui/
    cp package/dist/js/core.iife.js  <repo>/src/renderer/lib/vendor/franken-ui/

Depois rode o probe da Fase 0 (`tools/probes/chrome-metrics.js`) e confira as
medidas do chrome antes de commitar.

## Arquivos aqui

| Arquivo | Tamanho | SHA-256 |
|---|---|---|
| core.min.css | 191 KB | <sha> |
| core.iife.js | 233 KB | <sha> |

Cópias literais do pacote publicado. **Nunca editar à mão** — customização vai
em `src/renderer/styles/theme.css`.

## O que NÃO foi trazido, e por quê

- `css/utilities.min.css` (617 KB) — utilitários Tailwind pré-extraídos. É o que
  mais briga com o CSS existente. Decisão do design doc §9.
- `js/icon.iife.js` (386 KB) — ícones Lucide. O repo já depende do pacote
  `lucide` via `src/utils/lucide-icons.js`.
- `js/chart.iife.js`, `js/rte.iife.js` — gráficos e editor de texto rico. O app
  não tem nenhum dos dois no roadmap.
- Fontes `Geist Sans` / `Geist Mono` — o CSS pede, e cai em
  `ui-sans-serif`/`ui-monospace` sozinho. O app usa `font: 10px monospace`.

## Por que vendorizado e não `npm install`

1. CDN é impossível: CSP `script-src 'self'` e o app funciona offline.
2. `package.json` → `build.files` inclui `node_modules/**/*`. Instalar o pacote
   empacotaria ~3 MB de fonte TypeScript e CLI no `.dmg` para usar 2 arquivos.
```

- [ ] **Step 5: Verificar que o app não mudou nada**

Nenhum dos arquivos novos está referenciado ainda. Este passo prova isso.

```bash
grep -rn "franken" src/renderer/index.html || echo "nao referenciado — ok"
yarn start
```

Esperado: o app abre exatamente como antes. Cole uma imagem, clique numa aba,
abra o `?` — tudo funciona. Feche o app.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/lib/vendor/franken-ui
git commit -m "chore: vendoriza franken-ui 2.1.2 (core css + core js)"
```

---

### Task 2: Aparato de verificação (probe + check de tokens)

O contrato §12 exige verificar **rodando**, não compilando. O repo não tem
framework de teste e não vai ganhar um. Esta task constrói as duas ferramentas
que todas as tasks seguintes usam: um script Node para lógica pura e um probe de
DOM disparado pelo processo main.

Os probes ficam versionados em `tools/probes/` (as Fases 1–3 reaproveitam). O
**gancho** dentro de `src/main/index.js` é a única coisa temporária, e a Task 7 o
remove.

**Files:**
- Create: `tools/check-theme-tokens.js`
- Create: `tools/probes/chrome-metrics.js`
- Modify: `src/main/index.js` (bloco temporário depois de `win.loadFile(...)`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `node tools/check-theme-tokens.js` → sai com código 0 e imprime `OK`, ou
    lança `AssertionError`.
  - `VEDITBOX_PROBE=chrome-metrics yarn start` → imprime um JSON no stdout,
    salva `/tmp/veditbox-probe.png` e fecha o app sozinho.
  - `tools/probes/*.js` são expressões JS avaliadas por `executeJavaScript`. Cada
    arquivo é **uma IIFE que retorna um objeto serializável**. Se retornar
    Promise, o main faz `await`.

- [ ] **Step 1: Escrever o check de lógica pura**

A conversão hex → triplete HSL é a única lógica de verdade nesta fase, e um erro
aqui vira "a cor está quase certa" — o tipo de bug que ninguém vê e todo mundo
convive. O check converte e reconverte, e falha se o round-trip não bater.

Crie `tools/check-theme-tokens.js`:

```js
// Verifica a conversao hex -> triplete HSL usada em src/renderer/styles/theme.css.
// Rode: node tools/check-theme-tokens.js
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const PALETA = {
  'gray-100': '#121214',
  'gray-200': '#191622',
  'gray-300': '#272234',
  white: '#e1e1e6',
  'gray-500': '#41414d',
  purple: '#5a4b81',
  'light-purple': '#988bc7',
  green: '#67e480',
  orange: '#e89e64',
  pink: '#ff79c6',
  blue: '#78d1e1',
  red: '#e96379',
  yellow: '#e7de79',
}

const hexParaHsl = (hex) => {
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  let h = 0
  let s = 0
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

const hslParaHex = (triplete) => {
  const [h, s, l] = triplete.replace(/%/g, '').split(' ').map(Number)
  const sn = s / 100
  const ln = l / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ln - c / 2
  const seg = Math.floor(h / 60) % 6
  const rgb = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg]
  return '#' + rgb.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')
}

// 1. round-trip: arredondar pra inteiro nao pode mover mais que 2/255 por canal
for (const [nome, hex] of Object.entries(PALETA)) {
  const volta = hslParaHex(hexParaHsl(hex))
  for (let i = 1; i < 7; i += 2) {
    const a = parseInt(hex.slice(i, i + 2), 16)
    const b = parseInt(volta.slice(i, i + 2), 16)
    assert.ok(
      Math.abs(a - b) <= 2,
      `${nome}: ${hex} -> ${hexParaHsl(hex)} -> ${volta} (canal off por ${Math.abs(a - b)})`,
    )
  }
}

// 2. theme.css declara exatamente os tripletes que essa conversao produz
const css = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/styles/theme.css'), 'utf8')
for (const [nome, hex] of Object.entries(PALETA)) {
  const esperado = hexParaHsl(hex)
  assert.ok(
    css.includes(esperado),
    `theme.css nao contem o triplete de --${nome} (${hex}): esperado "${esperado}"`,
  )
}

console.log(`OK — ${Object.keys(PALETA).length} tokens conferidos`)
```

- [ ] **Step 2: Rodar e ver falhar**

`theme.css` ainda não existe.

```bash
node tools/check-theme-tokens.js
```

Esperado: **FALHA** com `ENOENT ... src/renderer/styles/theme.css`. É a falha
certa — a asserção 1 (round-trip) passou em silêncio antes de chegar no arquivo.
Para confirmar isso, comente temporariamente o bloco `// 2.` e rode de novo:
esperado `OK — 13 tokens conferidos`. Descomente.

- [ ] **Step 3: Escrever o probe de DOM**

Crie `tools/probes/chrome-metrics.js`:

```js
// Probe de chrome: medidas que o trafficLightPosition depende + estado do Franken.
// Rode: VEDITBOX_PROBE=chrome-metrics yarn start
;(() => {
  const alturaDe = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height)
  const larguraDe = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().width)
  const token = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
  const menu = document.querySelector('#menu')

  return {
    topBarHeight: alturaDe('#topBar'),
    menuWidth: larguraDe('#menu'),
    menuPaddingTop: Math.round(parseFloat(getComputedStyle(menu).paddingTop)),
    logoHeight: alturaDe('#menu h2'),
    tabHeight: alturaDe('#menu li'),
    bodyFont: getComputedStyle(document.body).font,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
    uikitLoaded: typeof window.UIkit !== 'undefined',
    ukCommandDefined: !!customElements.get('uk-command'),
    ukInputTagDefined: !!customElements.get('uk-input-tag'),
    tokenBackground: token('--background'),
    tokenForeground: token('--foreground'),
    tokenPrimary: token('--primary'),
    // trafficLightPosition que ESSAS medidas exigem (ver Global Constraints)
    trafficLightEsperado: {
      x: Math.round((larguraDe('#menu') - 52) / 2),
      y: Math.round((alturaDe('#topBar') - 12) / 2),
    },
  }
})()
```

- [ ] **Step 4: Instrumentar o main (temporário)**

Em `src/main/index.js`, dentro de `createWindow()`, **logo depois** da linha
`win.loadFile('src/renderer/index.html')`, insira o bloco abaixo. Os marcadores
`<<<`/`>>>` existem para a remoção na Task 7 ser mecânica.

```js
  // <<< PROBE FASE 0 — TEMPORARIO, REMOVER NA TASK 7
  if (process.env.VEDITBOX_PROBE) {
    const erros = []
    win.webContents.on('console-message', (_e, nivel, msg) => {
      if (nivel >= 2) erros.push(msg)
    })
    win.webContents.once('did-finish-load', async () => {
      const nome = process.env.VEDITBOX_PROBE
      const script = require('fs').readFileSync(
        path.join(__dirname, '..', '..', 'tools', 'probes', `${nome}.js`),
        'utf8',
      )
      // 300ms: da tempo do Lit registrar os custom elements e do layout assentar
      await new Promise((r) => setTimeout(r, 300))
      const resultado = await win.webContents.executeJavaScript(script)
      const img = await win.capturePage()
      require('fs').writeFileSync(`/tmp/veditbox-probe-${nome}.png`, img.toPNG())
      console.log('PROBE ' + nome + ' ' + JSON.stringify({ ...resultado, erros }, null, 2))
      app.quit()
    })
  }
  // >>> FIM PROBE FASE 0
```

- [ ] **Step 5: Rodar o probe na base atual e guardar a linha de base**

Isto roda **antes** do Franken entrar. O JSON daqui é a referência com que as
Tasks 3–7 se comparam.

```bash
VEDITBOX_PROBE=chrome-metrics yarn start
```

Esperado (o app abre, imprime e fecha sozinho):

```
topBarHeight: 36
menuWidth: 78
menuPaddingTop: 44
logoHeight: 50
tabHeight: 50
bodyBg: "rgb(18, 18, 20)"
bodyColor: "rgb(225, 225, 230)"
uikitLoaded: false
ukCommandDefined: false
tokenBackground: ""
trafficLightEsperado: { x: 13, y: 12 }
erros: []
```

`trafficLightEsperado` bate com o `{ x: 13, y: 12 }` que já está no
`src/main/index.js` — é a prova de que a fórmula das Global Constraints descreve
o código atual, e não uma racionalização.

Confira `/tmp/veditbox-probe-chrome-metrics.png`: os três botões do macOS
centrados na faixa da sidebar. **Guarde esse PNG** como `antes.png` fora do repo
(`cp /tmp/veditbox-probe-chrome-metrics.png /tmp/veditbox-antes.png`).

Se `topBarHeight` ou `menuWidth` vierem diferentes de 36/78, **pare** e reporte:
o contrato descreve outra coisa que não o código.

- [ ] **Step 6: Commit**

O gancho em `src/main/index.js` **não** entra neste commit — ele é temporário e
some na Task 7.

```bash
git add tools/
git commit -m "chore: probe de chrome e check de tokens para a fase 0"
```

---

### Task 3: Carregar o Franken e provar que nada quebrou

O passo de maior risco da fase, isolado sozinho de propósito: 424 KB de CSS+JS
entram na página e o app tem que continuar pixel a pixel igual. A garantia é a
cascata de layers — o `core.min.css` inteiro vive dentro de `@layer theme, base,
components, utilities`, e `index.css` não usa layer nenhum, então ganha de todos.

**Files:**
- Modify: `src/renderer/index.html:1-12` (tag `<html>` e bloco `<head>`)
- Modify: `src/renderer/index.html` (bloco `<script>` no fim do `<body>`)

**Interfaces:**
- Consumes: `src/renderer/lib/vendor/franken-ui/{core.min.css,core.iife.js}` da
  Task 1; o probe `chrome-metrics` da Task 2.
- Produces: `window.UIkit` disponível para as Fases 2 e 3; os custom elements
  `uk-command` (Cmd+K, §8) e `uk-input-tag` (editar tags, §8) registrados;
  `styles/theme.css` referenciado (arquivo criado na Task 4).

- [ ] **Step 1: Marcar o documento como tema escuro**

O Franken 2.x usa dark mode por classe (`.dark { … }` no CSS compilado). Sem a
classe, os tokens ficam nos valores claros. Em `src/renderer/index.html`, linha
2:

```html
<html class="dark">
```

- [ ] **Step 2: Colocar os CSS na ordem certa**

Ordem importa por dois motivos: `core.min.css` vem primeiro porque é o único
arquivo com layers (e layers perdem para tudo, independente da ordem — a ordem
aqui é legibilidade); `theme.css` vem antes de `index.css` porque só declara
tokens, e `index.css` é quem os consome.

Substitua o bloco de `<link>` no `<head>`:

```html
    <link rel="stylesheet" href="lib/vendor/franken-ui/core.min.css" />
    <link rel="stylesheet" href="styles/theme.css" />
    <link rel="stylesheet" href="styles/index.css" />
    <link rel="stylesheet" href="styles/ai-search.css" />
```

- [ ] **Step 3: Criar um `theme.css` vazio só para o link não dar 404**

O conteúdo de verdade é a Task 4. Crie `src/renderer/styles/theme.css`:

```css
/* Ponte de tokens: paleta do veditbox -> variaveis do Franken UI.
   Preenchido na Task 4 do plano da Fase 0. */
```

- [ ] **Step 4: Carregar o JS do Franken antes do `index.js`**

No fim do `<body>`, antes dos scripts existentes:

```html
    <script src="lib/vendor/franken-ui/core.iife.js"></script>
    <script src="lib/vendor/audiobuffer-to-wav.js"></script>
    <script src="index.js"></script>
```

- [ ] **Step 5: Rodar o probe e comparar com a linha de base**

```bash
VEDITBOX_PROBE=chrome-metrics yarn start
```

Esperado — **todas** as medidas idênticas ao Step 5 da Task 2, e só três campos
mudando:

| Campo | Antes | Agora |
|---|---|---|
| `topBarHeight` | 36 | **36** (inalterado) |
| `menuWidth` | 78 | **78** (inalterado) |
| `logoHeight` / `tabHeight` | 50 / 50 | **50 / 50** (inalterados) |
| `bodyBg` | `rgb(18, 18, 20)` | **igual** |
| `bodyFont` | 10px monospace | **igual** |
| `uikitLoaded` | false | **true** |
| `ukCommandDefined` | false | **true** |
| `ukInputTagDefined` | false | **true** |
| `tokenBackground` | `""` | `"0 0% 100%"` (valor de fábrica; a Task 4 muda) |
| `erros` | `[]` | **`[]`** |

`erros` não-vazio é falha: `core.iife.js` não pode logar nada. `topBarHeight`
diferente de 36 significa que o `@layer base` do Franken vazou por cima de algo
que `index.css` não declara — nesse caso, **não ajuste o
`trafficLightPosition`**; encontre a propriedade que vazou e ancore-a
explicitamente em `index.css`. O frame é o contrato; o CSS é que se ajusta.

- [ ] **Step 6: Verificar a olho, com o app aberto**

```bash
yarn start
```

Percorra o chrome inteiro: clicar em cada aba (`download`, `image`, `gif`,
`video`, `audio`) lista arquivos; clicar num item abre o preview e `← voltar`
retorna; clicar no logo volta pra home; `?` abre o dialog e `OK` fecha; o
checkbox "Always on top" continua marcável e a janela responde. Colar uma URL de
imagem ainda baixa e mostra.

Compare `/tmp/veditbox-probe-chrome-metrics.png` com `/tmp/veditbox-antes.png` —
os três botões do macOS no mesmo lugar.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/index.html src/renderer/styles/theme.css
git commit -m "feat: carrega franken-ui local (css em layer, js iife)"
```

---

### Task 4: Ponte de tokens

O contrato §9 é explícito: "não parte do zero — mapear para os tokens do Franken
em vez de descartar". Esta task é esse mapeamento. Uma cor é declarada **uma**
vez, em hex, e todo o resto deriva.

O Franken guarda cor como triplete HSL sem `hsl()` (`--background: 0 0% 100%`),
para poder compor alfa (`hsl(var(--background) / 0.5)`). Por isso o mapeamento
não é copiar hex.

**Files:**
- Modify: `src/renderer/styles/theme.css` (substitui o placeholder da Task 3)
- Test: `tools/check-theme-tokens.js` (já existe, da Task 2)

**Interfaces:**
- Consumes: `theme.css` referenciado no `index.html` (Task 3); a lista `PALETA`
  de `tools/check-theme-tokens.js`.
- Produces: para as Fases 1–3, estes tokens ficam disponíveis em qualquer
  componente `uk-*` sem nenhuma configuração extra:
  `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`,
  `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`,
  `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`,
  `--accent-foreground`, `--border`, `--input`, `--ring`, `--destructive`,
  `--destructive-foreground`. Os tokens antigos (`--gray-100`… `--yellow`)
  **continuam existindo** e viram a fonte única de cada um.

- [ ] **Step 1: Escrever a ponte**

Substitua o conteúdo de `src/renderer/styles/theme.css`:

```css
/* Ponte de tokens: a paleta do veditbox alimenta os tokens do Franken UI.
 *
 * O Franken guarda cor como triplete HSL sem hsl(), pra poder compor alfa:
 *   hsl(var(--background) / 0.5)
 * Por isso cada cor aparece duas vezes: o hex que index.css ja usa, e o
 * triplete equivalente. tools/check-theme-tokens.js falha se os dois divergirem.
 *
 * Este arquivo nao tem @layer de proposito: CSS sem layer vence qualquer layer,
 * entao ele sobrepoe o @layer theme do core.min.css sem depender de ordem. */

:root,
.dark {
  /* --- paleta (fonte unica; hex, como index.css sempre usou) --- */
  --gray-100: #121214;
  --gray-200: #191622;
  --gray-300: #272234;
  --white: #e1e1e6;
  --gray-500: #41414d;
  --purple: #5a4b81;
  --light-purple: #988bc7;
  --green: #67e480;
  --orange: #e89e64;
  --pink: #ff79c6;
  --blue: #78d1e1;
  --red: #e96379;
  --yellow: #e7de79;

  /* --- a mesma paleta em triplete HSL, pro Franken --- */
  --hsl-gray-100: 240 5% 7%;
  --hsl-gray-200: 255 21% 11%;
  --hsl-gray-300: 257 21% 17%;
  --hsl-white: 240 9% 89%;
  --hsl-gray-500: 240 8% 28%;
  --hsl-purple: 257 26% 40%;
  --hsl-light-purple: 253 35% 66%;
  --hsl-green: 132 70% 65%;
  --hsl-orange: 26 74% 65%;
  --hsl-pink: 326 100% 74%;
  --hsl-blue: 189 64% 68%;
  --hsl-red: 350 75% 65%;
  --hsl-yellow: 55 70% 69%;

  /* --- tokens do Franken --- */
  /* fundo da app = gray-100, texto = white: exatamente o que body ja faz */
  --background: var(--hsl-gray-100);
  --foreground: var(--hsl-white);

  /* superficies elevadas = gray-200, igual a sidebar e a topBar de hoje */
  --card: var(--hsl-gray-200);
  --card-foreground: var(--hsl-white);
  --popover: var(--hsl-gray-200);
  --popover-foreground: var(--hsl-white);

  /* pink e a cor de acao do app (logo, outline de hover); texto por cima e
     escuro porque o pink e claro demais pra texto claro */
  --primary: var(--hsl-pink);
  --primary-foreground: var(--hsl-gray-100);

  --secondary: var(--hsl-gray-300);
  --secondary-foreground: var(--hsl-white);
  --accent: var(--hsl-purple);
  --accent-foreground: var(--hsl-white);

  --muted: var(--hsl-gray-300);
  --muted-foreground: var(--hsl-gray-500);

  --border: var(--hsl-gray-300);
  --input: var(--hsl-gray-300);
  --ring: var(--hsl-light-purple);

  /* destrutivo = delete da Fase 2 (§7). red da paleta, nao o vermelho de fabrica */
  --destructive: var(--hsl-red);
  --destructive-foreground: var(--hsl-gray-100);

  /* --- escala do Franken alinhada ao app --- *
   * O Franken assume 16px/1.5rem. O app roda em 10px monospace, e a altura da
   * topBar (36px) e contrato com o trafficLightPosition do main. Sem estes
   * overrides, qualquer componente uk-* no chrome estica a barra e desalinha os
   * botoes do macOS. */
  --uk-global-font-size: 10px;
  --uk-global-leading: 14px;
  --uk-global-font-size-s: 9px;
  --uk-global-leading-s: 12px;
  --uk-global-font-family-sans: monospace;
  --uk-global-font-family-mono: monospace;
  --uk-global-radius: 6px;
  --uk-global-radius-s: 4px;

  /* botao compacto: 20px e a altura que a topBar ja reserva pro conteudo */
  --uk-btn-font-size: 10px;
  --uk-btn-leading: 14px;
  --uk-btn-padding: 3px 10px;
  --uk-btn-height: 20px;
}
```

- [ ] **Step 2: Rodar o check de lógica pura**

```bash
node tools/check-theme-tokens.js
```

Esperado: `OK — 13 tokens conferidos`. Se falhar num triplete, o CSS mentiu sobre
uma cor — corrija o CSS pelo valor que o erro imprime, nunca o script.

- [ ] **Step 3: Rodar o probe**

```bash
VEDITBOX_PROBE=chrome-metrics yarn start
```

Esperado:

| Campo | Valor |
|---|---|
| `tokenBackground` | `"240 5% 7%"` |
| `tokenForeground` | `"240 9% 89%"` |
| `tokenPrimary` | `"326 100% 74%"` |
| `topBarHeight` | `36` |
| `menuWidth` | `78` |
| `trafficLightEsperado` | `{ x: 13, y: 12 }` |
| `erros` | `[]` |

As três primeiras provam que a ponte chegou no navegador; as três seguintes
provam que ela não mexeu no frame.

- [ ] **Step 4: Verificar que a paleta não regrediu**

`theme.css` agora declara `--gray-100` etc., e `index.css` também — duas
declarações da mesma variável. A de `index.css` ganha (vem depois). Isso é
duplicação, e duplicação de cor é como a paleta diverge em silêncio.

Remova o bloco de cores de `src/renderer/styles/index.css:2-15` (as 13 linhas de
`/* omni colors */` até `--yellow`), deixando o `:root` com apenas as
propriedades de renderização de texto:

```css
:root {
  /* cores: src/renderer/styles/theme.css */

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}
```

```bash
yarn start
```

Esperado: nada muda visualmente. Sidebar e topBar continuam `#191622`, o logo
continua pink, o hover do grid continua com outline pink, o botão do dialog
continua verde. Se alguma cor sumiu, é um token que `index.css` usava e
`theme.css` não declarou — adicione à `PALETA` do check **e** ao `theme.css`.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/styles/theme.css src/renderer/styles/index.css
git commit -m "feat: mapeia a paleta do veditbox nos tokens do franken"
```

---

### Task 5: Migrar o dialog de ajuda

**Decisão deliberada: o `<dialog>` continua nativo.** O Franken traz `uk-modal`,
mas trocar significaria abandonar `showModal()` (que dá foco, `::backdrop` e
`Esc` de graça), reescrever `src/renderer/lib/modal.js`, e trocar
`ELEMENTS.setElement('modal', 'dialog')` por outro seletor. O contrato §8 já
observa que "o app já usa `<dialog>` + `showModal()`" como argumento **a favor**
do que existe. Então: mantém o elemento, adota as classes de componente do
Franken por dentro, e apaga o CSS feito à mão que elas substituem.

Isto também deixa o padrão pronto para a confirmação de delete da Fase 2 (§7):
`<dialog>` + `showModal()` + classes `uk-*`.

**Files:**
- Modify: `src/renderer/index.html` (bloco `<dialog>`)
- Modify: `src/renderer/styles/index.css:162-206` (regras de `dialog`)
- Create: `tools/probes/dialog.js`

**Interfaces:**
- Consumes: tokens da Task 4; `ELEMENTS.modal` / `ELEMENTS.closeBtn` de
  `src/utils/elements.js` — os seletores `dialog` e `dialog button` **não podem
  mudar**, senão `src/renderer/lib/modal.js` quebra.
- Produces: o padrão `<dialog class="uk-card">` + `<button class="uk-btn
  uk-btn-primary">`, reusado pela Fase 2.

- [ ] **Step 1: Adotar as classes do Franken no markup**

Substitua o bloco `<dialog>` em `src/renderer/index.html`. O elemento continua
`<dialog>`, o botão continua sendo o **único** `<button>` dentro dele (contrato
do seletor `dialog button`):

```html
    <dialog class="uk-card uk-card-body">
      <h2 class="uk-h3">How to use</h2>
      <p>
        You can <span>paste</span> any <b>Image File</b>, <b>Giphy</b> or <b>Video URL</b> like Pexels, Instagram, Twitter, Youtube or any .mp4 file.
      </p>
      <p>
        <b>Record Audio</b>: Hit <span>R</span> to start record audio.
      </p>
      <p>
        <b>Record video</b>: Select the video source with <span>Alt+Shift+Control+A</span> and use <span>Alt+Shift+Control+S</span> to the record video
      </p>

      <p>
        <b>Then</b> when image, audio or video appears, you can <span>drag and drop</span> it in any program that accepts dropping. <b>OR</b> after dragging, you'll find the file in the <span>veditbox</span> folder in your operational system user's folder
      </p>

      <button class="uk-btn uk-btn-primary">OK</button>
    </dialog>
```

- [ ] **Step 2: Apagar o CSS que virou responsabilidade do design system**

Em `src/renderer/styles/index.css`, o bloco de `dialog` encolhe. O que some é
todo o botão feito à mão (`.uk-btn-primary` faz isso agora, com o pink de
`--primary`) e as cores fixas (viram token). O que fica é só o que o Franken não
tem opinião: largura, `::backdrop`, e as cores semânticas do texto de ajuda.

Substitua as regras de `dialog` (linhas ~162-206):

```css
dialog::backdrop {
  background-color: rgb(12 12 12 / 0.8);
}

dialog {
  width: 80%;
  margin: auto;
  border: none;
}

dialog h2,
dialog p {
  margin-bottom: 0.8rem;
}

dialog p b {
  color: var(--pink);
}

dialog p span {
  color: var(--green);
}

dialog button {
  margin-top: 1rem;
  margin-left: auto;
  display: block;
}
```

`background-color`, `color`, `border-radius`, `box-shadow` e `padding` do dialog
agora vêm de `.uk-card.uk-card-body` (que lê `--card`, `--card-foreground`,
`--border`, `--uk-global-radius` — todos definidos na Task 4). O
`left: 94%; transform: translateX(-50%)` do botão virou `margin-left: auto`, que
é o que aquilo tentava fazer.

- [ ] **Step 3: Escrever o probe do dialog**

Crie `tools/probes/dialog.js`:

```js
// Probe do dialog de ajuda: abre, mede, fecha.
// Rode: VEDITBOX_PROBE=dialog yarn start
;(async () => {
  const dialog = document.querySelector('dialog')
  const helpBtn = document.querySelector('#helpBtn')
  const closeBtn = document.querySelector('dialog button')

  const abriuSozinho = dialog.open
  helpBtn.click()
  await new Promise((r) => setTimeout(r, 100))
  const cs = getComputedStyle(dialog)
  const csBtn = getComputedStyle(closeBtn)
  const caixa = dialog.getBoundingClientRect()
  const abriu = dialog.open

  closeBtn.click()
  await new Promise((r) => setTimeout(r, 100))

  return {
    abriuSozinho,
    abriu,
    fechou: !dialog.open,
    dialogBg: cs.backgroundColor,
    dialogColor: cs.color,
    dialogRadius: cs.borderRadius,
    dialogPadding: cs.padding,
    dialogLargura: Math.round(caixa.width),
    janelaLargura: window.innerWidth,
    btnBg: csBtn.backgroundColor,
    btnColor: csBtn.color,
    btnAltura: Math.round(closeBtn.getBoundingClientRect().height),
    btnAlinhadoDireita:
      Math.round(closeBtn.getBoundingClientRect().right) <= Math.round(caixa.right),
  }
})()
```

- [ ] **Step 4: Rodar o probe**

```bash
VEDITBOX_PROBE=dialog yarn start
```

Esperado:

| Campo | Valor |
|---|---|
| `abriuSozinho` | `false` |
| `abriu` | `true` |
| `fechou` | `true` |
| `dialogBg` | `rgb(25, 22, 34)` (= `--gray-200`, via `--card`) |
| `dialogColor` | `rgb(225, 225, 230)` (= `--white`) |
| `dialogRadius` | `6px` (= `--uk-global-radius`) |
| `dialogPadding` | não-zero em todos os lados (o `uk-card-body` entregou) |
| `dialogLargura` | ≈ `janelaLargura * 0.8` |
| `btnBg` | `rgb(255, 121, 198)` (= `--pink`, via `--primary`) |
| `btnColor` | `rgb(18, 18, 20)` (= `--gray-100`) |
| `btnAltura` | `20` (= `--uk-btn-height`) |
| `btnAlinhadoDireita` | `true` |

`dialogPadding` zerado significa que `.uk-card-body` não aplicou — verifique se a
classe está no elemento certo. `btnBg` errado significa que `--primary` não
chegou: volte à Task 4.

Nota: o botão era verde (`--green`) antes e agora é pink. É a mudança **desejada**
— o botão de ação primária passa a usar o token primário do app. O verde continua
na paleta e continua marcando teclas no texto de ajuda (`dialog p span`).

- [ ] **Step 5: Verificar rodando**

```bash
yarn start
```

Clique no `?`: o dialog abre centrado, fundo `#191622`, cantos arredondados,
botão pink alinhado à direita. `Esc` fecha (comportamento nativo, que o `uk-modal`
custaria para reproduzir). `OK` fecha. Reabra — nada de estado preso.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/index.html src/renderer/styles/index.css tools/probes/dialog.js
git commit -m "feat: dialog de ajuda usa uk-card e uk-btn do franken"
```

---

### Task 6: Migrar sidebar e topBar

Última migração de chrome. É onde o risco de mexer no frame mora: qualquer
componente do Franken no `#topBar` que traga sua própria altura estica a barra e
desalinha os botões do macOS.

**Restrição herdada, repetida aqui porque é onde ela morde:** os `<li>` do menu
continuam `<li>`, com o mesmo `data-tab` e a mesma classe `active`.
`src/renderer/lib/library.js:96` e `src/utils/set-tab.js:5` fazem
`document.querySelectorAll('#menu li')`, e os dois arquivos são de outra fase.

**Files:**
- Modify: `src/renderer/index.html` (`<nav id="menu">` e `<div id="topBar">`)
- Modify: `src/renderer/styles/index.css` (regras `#menu`, `.button`, `#topBar`,
  `#settingsForm`)
- Modify: `tools/probes/chrome-metrics.js` (acrescenta campos)

**Interfaces:**
- Consumes: tokens da Task 4.
- Produces: `#topBar` continua com altura **36px** e `#menu` com largura **78px**
  — contrato com `trafficLightPosition` em `src/main/index.js:26`. O `#statusText`
  continua sendo o alvo de `src/utils/show-status.js`, e o `#topBar` continua com
  espaço livre à direita do status para a barra de seleção "N selecionados" da
  Fase 2 (§7).

- [ ] **Step 1: Adotar classes do Franken na sidebar**

Em `src/renderer/index.html`, substitua o `<nav id="menu">`. Elementos e
atributos preservados; só entram classes:

```html
      <nav id="menu" class="uk-background-card">
        <h2 class="uk-btn uk-btn-primary"><i data-lucide="box"></i></h2>
        <ul>
          <li class="uk-btn uk-btn-ghost active" data-tab="download"><i data-lucide="hard-drive-download"></i></li>
          <li class="uk-btn uk-btn-ghost" data-tab="image"><i data-lucide="image"></i></li>
          <li class="uk-btn uk-btn-ghost" data-tab="gif"><span class="tab-label">GIF</span></li>
          <li class="uk-btn uk-btn-ghost" data-tab="video"><i data-lucide="video"></i></li>
          <li class="uk-btn uk-btn-ghost" data-tab="audio"><i data-lucide="music-2"></i></li>
        </ul>
        <button class="button uk-btn uk-btn-ghost" id="helpBtn"><i data-lucide="help-circle"></i></button>
      </nav>
```

Atenção ao `#helpBtn`: a classe `button` **fica**, porque `index.css` usa `.button`
no mesmo grupo de regras dos `li`.

- [ ] **Step 2: Ancorar as medidas da sidebar**

`.uk-btn` traz `--uk-btn-height: 20px` (Task 4) e o menu precisa de 50px. As
regras que já existem em `index.css` usam `all: unset`, que **apaga** as classes
`uk-*` inteiras — o `all: unset` tem que sair para as classes valerem, e a altura
tem que ser reafirmada.

Substitua o bloco de `#menu ul li, .button` (linhas ~81-100):

```css
#menu ul li,
.button {
  display: grid;
  place-content: center;

  width: 100%;
  height: 50px;

  /* .uk-btn traz --uk-btn-height (20px, do theme.css); o menu quer 50px */
  min-height: 50px;
  padding: 0;

  border: none;
  border-radius: var(--uk-global-radius);
  background: transparent;
  color: inherit;
  cursor: pointer;
  list-style: none;
}

.button:hover,
.button.active,
#menu ul li:hover,
#menu ul li.active {
  backdrop-filter: brightness(210%);
}
```

Mantido `backdrop-filter: brightness(210%)` de propósito: é o hover que o app tem
hoje e ele funciona sobre qualquer conteúdo. Trocar por `--accent` seria mudar
aparência sem pedido — fora do escopo desta fase.

Ajuste também o logo, que virou `.uk-btn` e ganharia altura de botão:

```css
#menu h2 {
  display: grid;
  place-items: center;
  text-align: center;
  gap: 4px;
  height: 50px;
  min-height: 50px;
  padding: 0;
  color: var(--gray-100);
  background: var(--pink);
  border-radius: var(--uk-global-radius);
  cursor: pointer;
}
```

E remova o bloco duplicado `#menu h2 { cursor: pointer }` do fim do arquivo
(linhas ~315-317), mantendo o `#menu h2:active { transform: scale(0.96) }`.

- [ ] **Step 3: Migrar o topBar**

Em `src/renderer/index.html`, o `<div id="topBar">`. O checkbox ganha
`uk-checkbox`; o status ganha `uk-text-muted` só quando não tem cor própria —
mas `src/utils/show-status.js` escreve `style.color` inline, que sempre ganha de
classe. Então o status **não** recebe classe de cor:

```html
      <div id="topBar" class="uk-background-card">
        <div id="statusText"></div>
        <form id="settingsForm">
          <label>
            <input type="checkbox" class="uk-checkbox" name="alwaysOnTop" /> Always on top
          </label>
        </form>
      </div>
```

Em `index.css`, o `#topBar` mantém as medidas explicitamente. **Este bloco é o
contrato com o `trafficLightPosition`:**

```css
#topBar {
  /* 8px + 20px + 8px = 36px. main/index.js depende disso:
     trafficLightPosition.y = (36 - 12) / 2 = 12 */
  padding: 8px;
  height: 36px;
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: space-between;
  box-shadow: 1rem 0 1rem 0rem black;
  background: var(--gray-200);
}

#settingsForm,
#settingsForm label {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  height: 20px;
}

/* .uk-checkbox nasce 16px; 12px cabe nos 20px de conteudo da topBar */
#topBar .uk-checkbox {
  width: 12px;
  height: 12px;
  margin: 0;
}
```

`height: 36px` explícito onde antes era altura implícita: a barra deixa de
depender do que estiver dentro dela, e a Fase 2 pode colocar botões de seleção
ali sem quebrar o frame.

- [ ] **Step 4: Acrescentar as novas medidas ao probe**

Em `tools/probes/chrome-metrics.js`, dentro do objeto retornado, antes de
`trafficLightEsperado`:

```js
    helpBtnHeight: alturaDe('#helpBtn'),
    checkboxLargura: Math.round(
      document.querySelector('#topBar input[type=checkbox]').getBoundingClientRect().width,
    ),
    formAltura: alturaDe('#settingsForm'),
    statusTextExiste: !!document.querySelector('#statusText'),
    tabsComDataTab: document.querySelectorAll('#menu li[data-tab]').length,
    tabAtiva: document.querySelector('#menu li.active')?.dataset.tab ?? null,
```

- [ ] **Step 5: Rodar o probe**

```bash
VEDITBOX_PROBE=chrome-metrics yarn start
```

Esperado:

| Campo | Valor | Por quê |
|---|---|---|
| `topBarHeight` | `36` | contrato com `trafficLightPosition.y = 12` |
| `menuWidth` | `78` | contrato com `trafficLightPosition.x = 13` |
| `menuPaddingTop` | `44` | espaço dos botões do macOS |
| `logoHeight` | `50` | `.uk-btn` não encolheu o logo |
| `tabHeight` | `50` | `.uk-btn` não encolheu as abas |
| `helpBtnHeight` | `50` | idem |
| `formAltura` | `20` | o `uk-checkbox` não esticou a barra |
| `checkboxLargura` | `12` | |
| `tabsComDataTab` | `5` | contrato de seletor com a Fase 1 preservado |
| `tabAtiva` | `"download"` | classe `active` preservada |
| `trafficLightEsperado` | `{ x: 13, y: 12 }` | **igual ao que está no main** |
| `erros` | `[]` | |

**Se `trafficLightEsperado` divergir de `{ x: 13, y: 12 }`:** o CSS mudou uma
medida que não devia. A regra é reverter o CSS, não editar o main — o frame é a
restrição, o design system é que se acomoda. Se, e só se, a mudança de medida for
deliberada e aprovada, aí `src/main/index.js:26` recebe os valores que o probe
imprimiu, e a Task 7 confere no screenshot.

- [ ] **Step 6: Verificar rodando**

```bash
yarn start
```

- os três botões do macOS centrados vertical e horizontalmente na faixa da sidebar
- arrastar a janela pela `#topBar` funciona (`-webkit-app-region: drag`)
- clicar no checkbox funciona e **não** arrasta a janela (`no-drag`); marcar
  "Always on top" põe a janela sobre as outras de verdade
- cada uma das 5 abas responde ao clique e fica com o hover claro; a aba clicada
  fica marcada
- o logo volta pra home e faz o `scale(0.96)` ao pressionar
- o `?` continua abrindo o dialog
- colar uma URL escreve status no `#statusText`, com cor (verde/vermelho) quando
  é o caso

Compare `/tmp/veditbox-probe-chrome-metrics.png` com `/tmp/veditbox-antes.png`.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/index.html src/renderer/styles/index.css tools/probes/chrome-metrics.js
git commit -m "feat: sidebar e topBar usam componentes do franken"
```

---

### Task 7: Portão de fronteira, reversão da instrumentação e fechamento

Duas coisas que só podem acontecer no fim: provar que o grid não foi tocado, e
tirar o gancho de probe do `src/main/index.js`.

**Files:**
- Create: `tools/probes/grid-snapshot.js`
- Modify: `src/main/index.js` (**remove** o bloco temporário da Task 2)
- Modify: `version.md`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: `main` limpo, sem código de teste. `tools/probes/` fica versionado
  para as Fases 1–3 — reinstrumentar é recolar o bloco documentado abaixo.

- [ ] **Step 1: Escrever o probe de grid**

Crie `tools/probes/grid-snapshot.js`. Ele abre a aba `download`, que é a única
que lista tudo:

```js
// Probe de fronteira: prova que o grid (territorio da Fase 1) nao mudou.
// Rode: VEDITBOX_PROBE=grid-snapshot yarn start
;(async () => {
  document.querySelector('#menu li[data-tab="download"]').click()
  await new Promise((r) => setTimeout(r, 400))

  const grid = document.querySelector('.library-grid')
  if (!grid) return { erro: 'grid nao renderizou — a pasta ~/veditbox esta vazia?' }

  const item = grid.querySelector('.library-item')
  const csGrid = getComputedStyle(grid)
  const csItem = getComputedStyle(item)

  return {
    itens: grid.children.length,
    gridColunas: csGrid.gridTemplateColumns.split(' ').length,
    gridGap: csGrid.gap,
    gridPadding: csGrid.padding,
    itemLargura: Math.round(item.getBoundingClientRect().width),
    itemAltura: Math.round(item.getBoundingClientRect().height),
    itemQuadrado:
      Math.abs(item.getBoundingClientRect().width - item.getBoundingClientRect().height) <= 1,
    itemBg: csItem.backgroundColor,
    itemRadius: csItem.borderRadius,
    itemCursor: csItem.cursor,
    itemDraggable: item.draggable,
    tagsDeThumb: [...grid.children].map((c) => c.firstElementChild?.tagName).slice(0, 8),
  }
})()
```

- [ ] **Step 2: Rodar e conferir contra a linha de base**

```bash
VEDITBOX_PROBE=grid-snapshot yarn start
```

Esperado (a pasta `~/veditbox` tem ~90 arquivos):

| Campo | Valor |
|---|---|
| `itens` | > 0 |
| `gridColunas` | `3` |
| `gridGap` | `8px` |
| `gridPadding` | `8px` |
| `itemQuadrado` | `true` (o `::before` com `padding-top: 100%`) |
| `itemBg` | `rgb(25, 22, 34)` (= `--gray-200`) |
| `itemRadius` | `6px` |
| `itemCursor` | `grab` |
| `itemDraggable` | `true` |
| `tagsDeThumb` | mistura de `IMG`, `VIDEO`, `DIV` |

Qualquer divergência é invasão de escopo: reverta a mudança de CSS que causou.
`itemBg` é o teste mais sensível — se a Task 4 tivesse errado `--gray-200`, ele
mudaria aqui.

```bash
git diff --stat main...HEAD -- src/renderer/lib/library.js src/utils/set-tab.js
```

Esperado: **saída vazia**. Se não estiver, um arquivo da Fase 1 foi tocado —
reverta antes de seguir.

- [ ] **Step 3: Guardar o screenshot final e comparar**

```bash
open /tmp/veditbox-antes.png /tmp/veditbox-probe-chrome-metrics.png
```

Confirme a olho: botões do macOS no mesmo lugar, sidebar do mesmo tom, topBar da
mesma altura.

- [ ] **Step 4: Reverter a instrumentação do main**

Remova de `src/main/index.js` tudo entre `// <<< PROBE FASE 0` e
`// >>> FIM PROBE FASE 0`, inclusive os marcadores.

```bash
grep -n "PROBE" src/main/index.js || echo "limpo — ok"
git diff main...HEAD -- src/main/index.js
```

Esperado: o `grep` não acha nada, e o `git diff` do `src/main/index.js` sai
**vazio** — o processo main termina a fase byte a byte igual a como começou.

- [ ] **Step 5: Documentar como reinstrumentar**

Sem isso, a Fase 1 refaz o gancho do zero. Acrescente ao fim de
`tools/probes/README.md` (crie o arquivo):

```markdown
# Probes

Scripts avaliados dentro do renderer para medir o app **rodando** — o repo não
tem framework de teste e não vai ganhar um (design doc §12).

Cada arquivo é uma IIFE que retorna um objeto serializável. Pode ser `async`.

## Como rodar

O gancho vive fora do repo de propósito: `src/main/index.js` não carrega código
de teste. Cole o bloco abaixo em `createWindow()`, logo depois de
`win.loadFile('src/renderer/index.html')`, rode, e **remova antes de commitar**.

    // <<< PROBE — TEMPORARIO, REMOVER ANTES DO COMMIT
    if (process.env.VEDITBOX_PROBE) {
      const erros = []
      win.webContents.on('console-message', (_e, nivel, msg) => {
        if (nivel >= 2) erros.push(msg)
      })
      win.webContents.once('did-finish-load', async () => {
        const nome = process.env.VEDITBOX_PROBE
        const script = require('fs').readFileSync(
          path.join(__dirname, '..', '..', 'tools', 'probes', `${nome}.js`),
          'utf8',
        )
        await new Promise((r) => setTimeout(r, 300))
        const resultado = await win.webContents.executeJavaScript(script)
        const img = await win.capturePage()
        require('fs').writeFileSync(`/tmp/veditbox-probe-${nome}.png`, img.toPNG())
        console.log('PROBE ' + nome + ' ' + JSON.stringify({ ...resultado, erros }, null, 2))
        app.quit()
      })
    }
    // >>> FIM PROBE

Depois:

    VEDITBOX_PROBE=chrome-metrics yarn start

O JSON sai no stdout e o screenshot em `/tmp/veditbox-probe-<nome>.png`.

## Probes existentes

| Probe | Mede |
|---|---|
| `chrome-metrics` | altura da topBar, largura do menu, tokens, custom elements do Franken, `trafficLightPosition` exigido |
| `dialog` | abre/fecha o dialog de ajuda e mede cores e botão |
| `grid-snapshot` | computed style do grid — portão de fronteira contra invasão de escopo |

`chrome-metrics` calcula `trafficLightEsperado` a partir das medidas reais. Ele
tem que bater com `trafficLightPosition` em `src/main/index.js`. Se não bater, o
CSS moveu o frame.
```

- [ ] **Step 6: Registrar em `version.md`**

Insira abaixo de `# Versions`, antes de `## 1.1.0`:

```markdown
## Em desenvolvimento

### New

* Design system: Franken UI 2.1.2 vendorizado em
  `src/renderer/lib/vendor/franken-ui` (local, sem CDN — o app funciona offline
  e a CSP bloqueia script externo)
* `src/renderer/styles/theme.css` liga a paleta existente (`--gray-100`,
  `--pink`, …) aos tokens do Franken
* Probes de UI em `tools/probes/` para verificar o app rodando

### Update

* Dialog de ajuda, sidebar e topBar usam componentes do Franken (`uk-card`,
  `uk-btn`, `uk-checkbox`)
* `#topBar` tem altura fixa de 36px, declarada — o `trafficLightPosition` do
  processo main depende dela
```

- [ ] **Step 7: Verificação final, app rodando**

```bash
node tools/check-theme-tokens.js
yarn start
```

Percorra tudo sem o probe: as 5 abas, um preview e o `← voltar`, o logo, o `?`
com `Esc` e com `OK`, o "Always on top", arrastar a janela pela topBar, arrastar
um item do grid para o Finder, colar uma URL de imagem, `R` para gravar áudio.

E a verificação de que a fase não pesou o boot: nenhum erro no DevTools
(`Cmd+Alt+I` → Console limpo).

- [ ] **Step 8: Commit**

```bash
git add tools/probes src/main/index.js version.md
git commit -m "chore: portao de fronteira do grid, reverte instrumentacao, version.md"
```

---

## Objeções e riscos (para o Maestro)

Registrados aqui em vez de decididos sozinho, como o briefing pede.

1. **O contrato diz "~91 kB de utilitários Tailwind"; no 2.1.2 são 617 KB.**
   `utilities.min.css` cresceu muito desde a medição. A decisão de não trazer
   fica **mais** justificada, não menos — só o número do doc está velho.

2. **O custo honesto ficou maior que o §9 sugere.** Vendorizamos 424 KB
   (191 CSS + 233 JS) para, nesta fase, usar `uk-card`, `uk-btn` e `uk-checkbox`
   — coisas que 30 linhas de CSS já fazem. O retorno é todo futuro: `uk-command`
   (§8 Cmd+K), `uk-input-tag` (§8) e `Offcanvas` (§8 sheet) são os componentes
   que pagam a conta, e são da Fase 3. **A Fase 0 é um investimento que só se
   paga se a Fase 3 acontecer.** Se a Fase 3 for cortada, esta fase deve ser
   revertida, não mantida.

3. **Não converti o `<dialog>` de ajuda para `uk-modal`.** Justificado na Task 5:
   `showModal()` dá foco, `::backdrop` e `Esc` de graça, e trocar exigiria mexer
   em `modal.js` e no seletor de `elements.js`. Se a intenção do §9 ao listar
   "Confirmação → Modal" era que a Fase 2 usasse `uk-modal` de verdade, isso é
   uma divergência real e vale decidir agora — a Fase 2 vai herdar o padrão que
   eu deixar aqui.

4. **`--uk-global-font-size: 10px` é uma escolha com consequência.** Ela obriga
   todo componente Franken futuro à escala compacta do app. Componentes densos
   (`uk-command`, `uk-input-tag`) podem ficar apertados demais em 10px monospace.
   A alternativa seria deixar a escala de fábrica (16px) e o app ficar com duas
   tipografias. Escolhi consistência; se a Fase 3 achar a palette ilegível, a
   correção é local (subir a escala dentro do componente).

5. **Dependência da Fase 1 em mim:** ela precisa dos tokens da Task 4
   (`--background`, `--card`, `--primary`, `--muted-foreground`) para estilizar o
   grid novo. Task 4 é a única coisa que ela precisa esperar; as Tasks 5–7 são
   independentes dela.

6. **Onde eu dependo de outra fase:** em nada para executar, mas o probe
   `grid-snapshot` (Task 7) fixa o comportamento **atual** do grid. Quando a Fase
   1 reescrever o grid, esse probe vai falhar **por bom motivo** — ela deve
   atualizar os valores esperados, não deletar o probe.

7. **`~/veditbox` é um symlink para o Google Drive** nesta máquina
   (`GoogleDrive-…/MacbookProMax/veditbox`). Não afeta a Fase 0, mas confirma a
   preocupação do §4 com escrita atômica: a pasta é sincronizada de verdade. Vale
   avisar a Fase 1.
