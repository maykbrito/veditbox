# Probes

Scripts avaliados dentro do renderer para medir o app **rodando** — o repo não
tem framework de teste e não vai ganhar um (design doc §12).

Cada arquivo é uma IIFE que retorna um objeto serializável. Pode ser `async`.

## Como rodar

```
VEDITBOX_PROBE=chrome-metrics yarn start
```

O JSON sai no stdout, o screenshot em `/tmp/veditbox-probe-<nome>.png`, e o app
fecha sozinho.

O gancho vive em `src/main/probe.js`, que se pendura em
`app.on('browser-window-created')` e é **inerte** sem a variável de ambiente.
Não é instrumentação temporária: o §10.1 do contrato torna
`src/main/index.js` append-only, então o probe é módulo próprio com **uma linha**
de `require` no fim do main. Nada a reverter.

## Probes existentes

| Probe | Mede |
|---|---|
| `chrome-metrics` | altura da topBar, largura do menu, tokens, custom elements do Franken, `trafficLightPosition` exigido |
| `chrome-func` | clica em tudo (abas, logo, preview, checkbox, ajuda) e confere o comportamento |
| `dialog` | abre/fecha o dialog de ajuda pelo `#helpBtn` e mede cores e padding |
| `grid-snapshot` | computed style do grid — portão de fronteira contra invasão de escopo |

## Comparar screenshots

`compare` vem do ImageMagick, que o app já usa. Diferença de poucas centenas de
pixels em bordas arredondadas e traços de ícone é antialiasing de subpixel, não
regressão:

```
compare -metric AE /tmp/veditbox-antes.png /tmp/veditbox-probe-chrome-metrics.png /tmp/diff.png
magick /tmp/diff.png -trim -format "regiao: %wx%h em +%X+%Y\n" info:
```

## O invariante mais importante

`chrome-metrics` calcula `trafficLightEsperado` a partir das medidas reais do
DOM:

```
y = (altura do #topBar − 12) / 2      x = (largura do #menu − 52) / 2
```

Tem que bater com `trafficLightPosition` em `src/main/index.js`. **Se não bater,
o CSS moveu o frame** — a regra é reverter o CSS, não editar o main. O frame é a
restrição; o design system é que se acomoda.

## Linha de base (antes da Fase 0)

```
topBarHeight 36   menuWidth 78   menuPaddingTop 44
logoHeight 50   tabHeight 50   helpBtnHeight 50
formAltura 20   checkboxLargura 13
bodyFont "10px monospace"   bodyBg "rgb(18, 18, 20)"
tabsComDataTab 5   tabAtiva "download"   onkeydownVivo true
trafficLightEsperado { x: 13, y: 12 }   erros []
```

## Nota para a Fase 1

`grid-snapshot` fixa o comportamento **atual** do grid. Quando a Fase 1
reescrever, ele vai falhar **por bom motivo**: atualize os valores esperados,
não delete o probe (§10.1).

Valores fixados pela Fase 0, com 90 arquivos em `~/veditbox`:

```
itens 90   gridColunas "158.328px 158.336px 158.328px"   gridGap 8px
gridPadding 8px   item 158x158 (quadrado)   itemBg "rgb(25, 22, 34)"
itemRadius 6px   itemCursor grab   itemOverflow hidden   itemDraggable true
tagsDeThumb [IMG, IMG, DIV, IMG, VIDEO, IMG, IMG, VIDEO]
```

## Armadilha que a Fase 0 pagou (leia antes de usar componente do Franken)

O `core.min.css` inteiro vive em `@layer theme, base, components, utilities`, e
**CSS sem layer vence qualquer layer**. Isso é o que protege o app do Franken —
mas corta dos dois lados: qualquer regra sem layer no `index.css` também vence o
Franken, inclusive sem querer.

O `index.css` tinha um `* { margin: 0; padding: 0; box-sizing: border-box }` sem
layer. Ele zerava o padding de **todo** componente `uk-*`: o `.uk-card-body` do
dialog media `0px`. A regra era redundante — o `@layer base` do Franken traz
exatamente o mesmo reset — então a correção foi deletá-la.

Padrão que sobrou: se um componente `uk-*` vier sem espaçamento ou com tamanho
errado, procure a regra sem layer no `index.css` que está ganhando dele. Foi
assim também com os ícones (`.uk-btn` dimensiona `svg` filho em 1rem e encolheu
os ícones lucide de 24px para 16px — medido, corrigido com `#menu svg`).
