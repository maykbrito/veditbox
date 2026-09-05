# Franken UI — vendorizado

Versão: **2.1.2** (npm `franken-ui`)

## Como re-baixar / atualizar

    mkdir -p /tmp/fu-vendor && cd /tmp/fu-vendor
    npm pack franken-ui@<versao>
    tar xzf franken-ui-<versao>.tgz
    cp package/dist/css/core.min.css <repo>/src/renderer/lib/vendor/franken-ui/
    cp package/dist/js/core.iife.js  <repo>/src/renderer/lib/vendor/franken-ui/

Depois rode `VEDITBOX_PROBE=chrome-metrics yarn start` e confira as medidas do
chrome antes de commitar — em especial `trafficLightEsperado`.

## Arquivos aqui

| Arquivo | Tamanho | SHA-256 |
|---|---|---|
| core.min.css | 192 KB | `9577607f8fc992f1346cae12cce05c5214f5b2ea3828a8d7f29b9bac420909fe` |
| core.iife.js | 236 KB | `d2c3cae2e4b2b9d8116112124a8e8ef0a492efd3dd3afff13fa585050be07ba4` |

Cópias literais do pacote publicado. **Nunca editar à mão** — customização vai em
`src/renderer/styles/theme.css`.

Verificado no bundle 2.1.2:

- zero ocorrências de `eval(` / `new Function` — a CSP do `index.html`
  (`script-src 'self' 'unsafe-inline'`) não libera `unsafe-eval`
- zero ocorrências de `typeof exports` / `typeof module` — é IIFE puro, não UMD.
  Importa porque o renderer roda com `nodeIntegration: true`: um bundle UMD
  detectaria `module.exports` e exportaria em vez de setar `window.UIkit`
- `window.UIkit=` presente

## O que NÃO foi trazido, e por quê

- `css/utilities.min.css` (617 KB) — utilitários Tailwind pré-extraídos. É o que
  mais briga com o CSS existente. Decisão do design doc §9. (O doc estima
  "~91 kB"; no 2.1.2 são 617 KB. A decisão fica mais justificada, não menos.)
- `js/icon.iife.js` (386 KB) — ícones Lucide. O repo já depende do pacote
  `lucide` via `src/utils/lucide-icons.js`.
- `js/chart.iife.js`, `js/rte.iife.js` — gráficos e editor de texto rico. O app
  não tem nenhum dos dois no roadmap.
- Fontes `Geist Sans` / `Geist Mono` — o CSS pede, e cai em
  `ui-sans-serif`/`ui-monospace` sozinho. O app usa `font: 10px monospace`.

## Por que vendorizado e não `npm install`

1. CDN é impossível: CSP `script-src 'self'` e o app funciona offline (design doc
   §9).
2. `package.json` → `build.files` inclui `node_modules/**/*`. Instalar o pacote
   empacotaria ~3 MB de fonte TypeScript e CLI no `.dmg` para usar 2 arquivos.

## Como o CSS convive com o `index.css`

`core.min.css` inteiro vive dentro de `@layer theme, base, components,
utilities`. `index.css` não usa layer nenhum, e **CSS sem layer vence qualquer
layer**. O Franken entra por baixo: nada do app é sobrescrito, e a migração vira
opt-in classe por classe. É essa propriedade que protege o grid da Fase 1 por
construção, não por disciplina — preservar ao atualizar.
