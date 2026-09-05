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
| `dialog` | abre/fecha o dialog de ajuda pelo `#helpBtn` e mede cores e botão |
| `grid-snapshot` | computed style do grid — portão de fronteira contra invasão de escopo |

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
